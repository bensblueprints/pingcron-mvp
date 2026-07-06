const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb, genToken, getSettings, setSettings, DEFAULT_SETTINGS } = require('./db');
const { computeNextExpected, validateCron, cronPreview } = require('./schedule');
const { startEvaluator } = require('./evaluator');
const { sendAlerts, sendEmail } = require('./alerts');
const { badgeSvg } = require('./badge');

const SESSION_COOKIE = 'pc_session';
const BODY_LIMIT = 10 * 1024; // first 10KB of ping bodies stored as log

function createApp({ dbPath, adminPassword, autologinToken = null, evalIntervalMs = 15000 } = {}) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());

  const stopEvaluator = startEvaluator(db, evalIntervalMs);
  app.locals.db = db;
  app.locals.stopEvaluator = stopEvaluator;

  // ── helpers ────────────────────────────────────────────────────────────────
  const findByToken = db.prepare('SELECT * FROM checks WHERE token = ?');
  const findById = db.prepare('SELECT * FROM checks WHERE id = ?');

  function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    if (token && db.prepare('SELECT id FROM sessions WHERE token = ?').get(token)) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  function createSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, Date.now());
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  }

  // Light per-token rate limit so a runaway loop can't flood the DB.
  const rateMap = new Map(); // token -> [timestamps]
  function rateLimited(token) {
    const now = Date.now();
    const arr = (rateMap.get(token) || []).filter((t) => now - t < 10_000);
    if (arr.length >= 30) return true;
    arr.push(now);
    rateMap.set(token, arr);
    if (rateMap.size > 5000) rateMap.clear(); // safety valve
    return false;
  }

  function serializeCheck(c) {
    const recent = db
      .prepare("SELECT kind, received_at, duration_ms FROM pings WHERE check_id = ? AND kind != 'start' ORDER BY received_at DESC LIMIT 30")
      .all(c.id)
      .reverse();
    const total = recent.length;
    const okCount = recent.filter((p) => p.kind === 'success').length;
    return {
      ...c,
      uptime_pct: total ? Math.round((okCount / total) * 1000) / 10 : null,
      recent_pings: recent
    };
  }

  // ── ping endpoints (public, no auth, fast & forgiving) ─────────────────────
  // GET|POST|HEAD /ping/:token[/start|/fail], ?status=fail also accepted.
  function collectBody(req, cb) {
    if (req.method === 'GET' || req.method === 'HEAD') return cb('');
    let body = '';
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      body += chunk.toString('utf8');
      if (body.length >= BODY_LIMIT) {
        body = body.slice(0, BODY_LIMIT);
        done = true;
        cb(body);
      }
    });
    req.on('end', () => {
      if (!done) { done = true; cb(body); }
    });
    req.on('error', () => {
      if (!done) { done = true; cb(body); }
    });
  }

  function handlePing(req, res, action) {
    const check = findByToken.get(req.params.token);
    if (!check) return res.status(404).send('unknown token');
    if (rateLimited(check.token)) return res.status(429).send('rate limited');

    collectBody(req, (body) => {
      try {
        const now = Date.now();
        const ip = (req.ip || '').replace('::ffff:', '');
        const kind = action === 'start' ? 'start' : action === 'fail' || req.query.status === 'fail' ? 'fail' : 'success';
        const wasPaused = check.status === 'paused';

        if (kind === 'start') {
          db.prepare('INSERT INTO pings (check_id, kind, received_at, source_ip, body_excerpt) VALUES (?, ?, ?, ?, ?)')
            .run(check.id, 'start', now, ip, body || null);
          db.prepare('UPDATE checks SET last_started_at = ? WHERE id = ?').run(now, check.id);
          return res.send('OK');
        }

        if (kind === 'fail') {
          db.prepare('INSERT INTO pings (check_id, kind, received_at, source_ip, duration_ms, body_excerpt) VALUES (?, ?, ?, ?, ?, ?)')
            .run(check.id, 'fail', now, ip, check.last_started_at ? now - check.last_started_at : null, body || null);
          if (!wasPaused) {
            db.prepare('UPDATE checks SET status = ?, last_started_at = NULL WHERE id = ?').run('down', check.id);
            // explicit fail pings always alert
            sendAlerts(db, { ...check, status: 'down' }, 'fail').catch((e) => console.warn('[alerts]', e.message));
          }
          return res.send('OK');
        }

        // success
        const duration = check.last_started_at ? now - check.last_started_at : null;
        db.prepare('INSERT INTO pings (check_id, kind, received_at, source_ip, duration_ms, body_excerpt) VALUES (?, ?, ?, ?, ?, ?)')
          .run(check.id, 'success', now, ip, duration, body || null);
        const nextExpected = computeNextExpected(check, now);
        db.prepare(
          'UPDATE checks SET last_ping_at = ?, last_started_at = NULL, next_expected_at = ?, status = ? WHERE id = ?'
        ).run(now, nextExpected, wasPaused ? 'paused' : 'up', check.id);
        if (check.status === 'down') {
          sendAlerts(db, { ...check, status: 'up', last_ping_at: now, next_expected_at: nextExpected }, 'up')
            .catch((e) => console.warn('[alerts]', e.message));
        }
        res.send('OK');
      } catch (e) {
        console.error('[ping] error:', e.message);
        res.status(500).send('error');
      }
    });
  }

  app.all('/ping/:token', (req, res) => handlePing(req, res, null));
  app.all('/ping/:token/start', (req, res) => handlePing(req, res, 'start'));
  app.all('/ping/:token/fail', (req, res) => handlePing(req, res, 'fail'));

  // ── public badge + status (no auth by design) ──────────────────────────────
  app.get('/badge/:token.svg', (req, res) => {
    const check = findByToken.get(req.params.token);
    if (!check) return res.status(404).send('unknown token');
    const status = check.status === 'grace' ? 'up' : check.status; // grace still counts as up publicly
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'no-cache, max-age=30');
    res.send(badgeSvg('pingcron', status));
  });

  app.get('/status/:token.json', (req, res) => {
    const check = findByToken.get(req.params.token);
    if (!check) return res.status(404).json({ error: 'unknown token' });
    res.json({
      name: check.name,
      status: check.status,
      last_ping_at: check.last_ping_at ? new Date(check.last_ping_at).toISOString() : null
    });
  });

  // ── auth ───────────────────────────────────────────────────────────────────
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'pingcron' }));

  app.post('/api/login', (req, res) => {
    if ((req.body || {}).password !== adminPassword) return res.status(401).json({ error: 'wrong password' });
    createSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  // Desktop mode auto-login (Electron passes a one-shot token).
  app.get('/auth/auto', (req, res) => {
    if (autologinToken && req.query.token === autologinToken) createSession(res);
    res.redirect('/');
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

  // ── checks CRUD ────────────────────────────────────────────────────────────
  function validateCheckInput(body, res) {
    const name = String(body.name || '').trim();
    if (!name) { res.status(400).json({ error: 'name is required' }); return null; }
    const schedule_type = body.schedule_type === 'cron' ? 'cron' : 'interval';
    let interval_seconds = null;
    let cron_expr = null;
    const tz = String(body.tz || 'UTC');
    if (schedule_type === 'cron') {
      cron_expr = String(body.cron_expr || '').trim();
      if (!validateCron(cron_expr, tz)) { res.status(400).json({ error: 'invalid cron expression or timezone' }); return null; }
    } else {
      interval_seconds = Math.floor(Number(body.interval_seconds));
      if (!Number.isFinite(interval_seconds) || interval_seconds < 1) {
        res.status(400).json({ error: 'interval_seconds must be >= 1' }); return null;
      }
    }
    let grace_seconds = Math.floor(Number(body.grace_seconds));
    if (!Number.isFinite(grace_seconds) || grace_seconds < 0) {
      grace_seconds = Number(getSettings(db).default_grace_seconds) || 60;
    }
    return {
      name, schedule_type, interval_seconds, cron_expr, tz, grace_seconds,
      alert_webhook_url: String(body.alert_webhook_url || '').trim(),
      alert_email: String(body.alert_email || '').trim()
    };
  }

  app.get('/api/checks', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM checks ORDER BY created_at DESC').all();
    res.json(rows.map(serializeCheck));
  });

  app.post('/api/checks', requireAuth, (req, res) => {
    const v = validateCheckInput(req.body || {}, res);
    if (!v) return;
    const now = Date.now();
    const token = genToken();
    // populate next_expected_at up front (new checks don't alert until first ping)
    const nextExpected = computeNextExpected(v, now);
    const info = db.prepare(`
      INSERT INTO checks (name, token, schedule_type, interval_seconds, cron_expr, tz, grace_seconds,
                          status, next_expected_at, alert_webhook_url, alert_email, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
    `).run(v.name, token, v.schedule_type, v.interval_seconds, v.cron_expr, v.tz, v.grace_seconds,
           nextExpected, v.alert_webhook_url, v.alert_email, now);
    res.status(201).json(serializeCheck(findById.get(info.lastInsertRowid)));
  });

  app.get('/api/checks/:id', requireAuth, (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    res.json(serializeCheck(check));
  });

  app.put('/api/checks/:id', requireAuth, (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    const v = validateCheckInput({ ...check, ...(req.body || {}) }, res);
    if (!v) return;
    // recompute expectation from the last ping (or now) under the new schedule
    const anchor = check.last_ping_at || Date.now();
    const nextExpected = computeNextExpected(v, anchor);
    db.prepare(`
      UPDATE checks SET name = ?, schedule_type = ?, interval_seconds = ?, cron_expr = ?, tz = ?,
                        grace_seconds = ?, next_expected_at = ?, alert_webhook_url = ?, alert_email = ?
      WHERE id = ?
    `).run(v.name, v.schedule_type, v.interval_seconds, v.cron_expr, v.tz, v.grace_seconds,
           nextExpected, v.alert_webhook_url, v.alert_email, check.id);
    res.json(serializeCheck(findById.get(check.id)));
  });

  app.delete('/api/checks/:id', requireAuth, (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM pings WHERE check_id = ?').run(check.id);
    db.prepare('DELETE FROM alerts WHERE check_id = ?').run(check.id);
    db.prepare('DELETE FROM checks WHERE id = ?').run(check.id);
    res.json({ ok: true });
  });

  app.post('/api/checks/:id/pause', requireAuth, (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    if (check.status !== 'paused') {
      db.prepare('UPDATE checks SET status = ?, status_before_pause = ? WHERE id = ?')
        .run('paused', check.status, check.id);
    }
    res.json(serializeCheck(findById.get(check.id)));
  });

  app.post('/api/checks/:id/resume', requireAuth, (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    if (check.status === 'paused') {
      // re-anchor expectations so we don't instantly alert for the paused stretch
      const now = Date.now();
      const status = check.last_ping_at ? 'up' : 'new';
      const nextExpected = computeNextExpected(check, now);
      db.prepare('UPDATE checks SET status = ?, next_expected_at = ?, status_before_pause = NULL WHERE id = ?')
        .run(status, nextExpected, check.id);
    }
    res.json(serializeCheck(findById.get(check.id)));
  });

  app.post('/api/checks/:id/test-alert', requireAuth, async (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    if (!check.alert_webhook_url && !check.alert_email) {
      return res.status(400).json({ error: 'no alert channels configured on this check' });
    }
    const results = await sendAlerts(db, check, 'test');
    res.json({ ok: results.every((r) => r.ok), results });
  });

  app.get('/api/checks/:id/pings', requireAuth, (req, res) => {
    const check = findById.get(req.params.id);
    if (!check) return res.status(404).json({ error: 'not found' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const rows = db.prepare('SELECT * FROM pings WHERE check_id = ? ORDER BY received_at DESC LIMIT ?')
      .all(check.id, limit);
    res.json(rows);
  });

  app.get('/api/alerts', requireAuth, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const rows = req.query.check_id
      ? db.prepare('SELECT a.*, c.name AS check_name FROM alerts a LEFT JOIN checks c ON c.id = a.check_id WHERE a.check_id = ? ORDER BY a.sent_at DESC LIMIT ?').all(req.query.check_id, limit)
      : db.prepare('SELECT a.*, c.name AS check_name FROM alerts a LEFT JOIN checks c ON c.id = a.check_id ORDER BY a.sent_at DESC LIMIT ?').all(limit);
    res.json(rows);
  });

  // ── settings ───────────────────────────────────────────────────────────────
  app.get('/api/settings', requireAuth, (req, res) => {
    const s = getSettings(db);
    res.json({ ...s, smtp_pass: s.smtp_pass ? '********' : '' });
  });

  app.put('/api/settings', requireAuth, (req, res) => {
    const body = { ...(req.body || {}) };
    if (body.smtp_pass === '********') delete body.smtp_pass; // masked, unchanged
    setSettings(db, body);
    const s = getSettings(db);
    res.json({ ...s, smtp_pass: s.smtp_pass ? '********' : '' });
  });

  app.post('/api/settings/test-email', requireAuth, async (req, res) => {
    const to = String((req.body || {}).to || '').trim();
    if (!to) return res.status(400).json({ error: 'recipient required' });
    try {
      const soft = await sendEmail(getSettings(db), to, '🔔 Pingcron SMTP test', {
        check: 'SMTP test', event: 'test', status: 'up', last_ping_at: null, next_expected_at: null, url: null
      });
      if (soft) return res.status(400).json({ error: 'SMTP is not configured' });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/cron-preview', requireAuth, (req, res) => {
    try {
      res.json({ next: cronPreview(String(req.query.expr || ''), String(req.query.tz || 'UTC')) });
    } catch (e) {
      res.status(400).json({ error: 'invalid cron expression' });
    }
  });

  // ── static frontend ────────────────────────────────────────────────────────
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ping') ||
          req.path.startsWith('/badge') || req.path.startsWith('/status')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
