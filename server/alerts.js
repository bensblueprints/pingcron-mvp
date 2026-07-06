// Alert delivery: webhook (POST JSON) + SMTP email (nodemailer).
// SMTP unconfigured is a valid state — email no-ops with a logged warning.
const nodemailer = require('nodemailer');
const { getSettings } = require('./db');

const SUBJECTS = {
  down: (c) => `🔴 ${c.name} is DOWN — ping missing`,
  up: (c) => `🟢 ${c.name} is back UP`,
  fail: (c) => `🔴 ${c.name} reported a FAILURE`,
  test: (c) => `🔔 Pingcron test alert for ${c.name}`
};

function buildPayload(check, type, settings) {
  return {
    event: type,
    check: check.name,
    token: check.token,
    status: type === 'up' ? 'up' : type === 'test' ? check.status : 'down',
    last_ping_at: check.last_ping_at ? new Date(check.last_ping_at).toISOString() : null,
    next_expected_at: check.next_expected_at ? new Date(check.next_expected_at).toISOString() : null,
    url: settings.base_url ? `${settings.base_url.replace(/\/$/, '')}/ping/${check.token}` : null,
    at: new Date().toISOString()
  };
}

async function sendWebhook(url, payload) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Pingcron/1.0' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function sendEmail(settings, to, subject, payload) {
  if (!settings.smtp_host) {
    console.warn(`[alerts] SMTP not configured — skipping email to ${to}`);
    return 'smtp_not_configured';
  }
  const transport = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port) || 587,
    secure: Number(settings.smtp_port) === 465,
    auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_pass } : undefined
  });
  await transport.sendMail({
    from: settings.smtp_from || settings.smtp_user || 'pingcron@localhost',
    to,
    subject,
    text:
      `Check:         ${payload.check}\n` +
      `Event:         ${payload.event}\n` +
      `Status:        ${payload.status}\n` +
      `Last ping:     ${payload.last_ping_at || 'never'}\n` +
      `Next expected: ${payload.next_expected_at || '-'}\n` +
      (payload.url ? `Ping URL:      ${payload.url}\n` : '') +
      `\n— Pingcron (self-hosted, pay once)`
  });
  return null;
}

// Fires configured channels for a check; logs every attempt to the alerts table.
// Returns array of { channel, ok, error }.
async function sendAlerts(db, check, type) {
  const settings = getSettings(db);
  const payload = buildPayload(check, type, settings);
  const insert = db.prepare(
    'INSERT INTO alerts (check_id, type, channel, payload_json, sent_at, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const results = [];

  if (check.alert_webhook_url) {
    let ok = 1, error = null;
    try {
      await sendWebhook(check.alert_webhook_url, payload);
    } catch (e) {
      ok = 0;
      error = e.message || String(e);
      console.warn(`[alerts] webhook failed for "${check.name}": ${error}`);
    }
    insert.run(check.id, type, 'webhook', JSON.stringify(payload), Date.now(), ok, error);
    results.push({ channel: 'webhook', ok: !!ok, error });
  }

  if (check.alert_email) {
    let ok = 1, error = null;
    try {
      const soft = await sendEmail(settings, check.alert_email, SUBJECTS[type](check), payload);
      if (soft) { ok = 0; error = soft; }
    } catch (e) {
      ok = 0;
      error = e.message || String(e);
      console.warn(`[alerts] email failed for "${check.name}": ${error}`);
    }
    insert.run(check.id, type, 'email', JSON.stringify(payload), Date.now(), ok, error);
    results.push({ channel: 'email', ok: !!ok, error });
  }

  return results;
}

module.exports = { sendAlerts, sendEmail, buildPayload };
