// Pingcron smoke test — boots the real server, exercises the full ping → state
// machine → alert pipeline against a temp DB, and asserts rows land in SQLite.
// Kills ONLY the spawned server child (never broad-kills node processes).
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const TEST_PORT = 5390;
const WEBHOOK_PORT = 5393;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

let serverProc = null;
let webhookServer = null;
const webhookHits = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* retry */ }
    await sleep(delay);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function startWebhookReceiver() {
  return new Promise((resolve) => {
    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        webhookHits.push({ method: req.method, headers: req.headers, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    webhookServer.listen(WEBHOOK_PORT, '127.0.0.1', resolve);
  });
}

async function getCheckStatus(id) {
  const list = await api('/api/checks');
  return list.data.find((c) => c.id === id)?.status;
}

async function main() {
  console.log('1. Booting Pingcron on port', TEST_PORT, 'with temp DB + fast evaluator');
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      ADMIN_PASSWORD,
      DB_PATH,
      EVAL_INTERVAL_MS: '500'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));

  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('   Auth: wrong password → 401, unauthenticated /api/checks → 401, login → 200');
  const bad = await api('/api/login', { method: 'POST', body: { password: 'wrong' } });
  assert.strictEqual(bad.status, 401, 'wrong password must 401');
  cookie = '';
  const unauth = await api('/api/checks');
  assert.strictEqual(unauth.status, 401, 'admin API must require auth');
  const good = await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  assert.strictEqual(good.status, 200, 'login must succeed');

  console.log('2. Creating interval check (every 2s, grace 1s)');
  await startWebhookReceiver();
  const created = await api('/api/checks', {
    method: 'POST',
    body: {
      name: 'Smoke Backup Job',
      schedule_type: 'interval',
      interval_seconds: 2,
      grace_seconds: 1,
      alert_webhook_url: `http://127.0.0.1:${WEBHOOK_PORT}/hook`
    }
  });
  assert.strictEqual(created.status, 201, 'check create must 201');
  assert.ok(created.data.token && created.data.token.length >= 20, 'response must include a token');
  const checkId = created.data.id;
  const token = created.data.token;

  console.log('3. Pinging → status up, ping row lands in SQLite');
  const ping1 = await fetch(`${BASE}/ping/${token}`);
  assert.strictEqual(ping1.status, 200, 'ping must 200');
  await waitFor(async () => (await getCheckStatus(checkId)) === 'up', 'check status up');

  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const pingRow = db
    .prepare("SELECT * FROM pings WHERE check_id = ? AND kind = 'success'")
    .get(checkId);
  assert.ok(pingRow, 'a success ping row must exist in SQLite');
  assert.ok(pingRow.received_at > 0, 'ping row must record received_at');
  console.log(`   success ping row: received_at=${new Date(pingRow.received_at).toISOString()}`);

  console.log('4. Stop pinging → expect down transition + webhook alert (~4s)');
  await waitFor(async () => (await getCheckStatus(checkId)) === 'down', 'check status down', 40, 250);
  const downAlert = await waitFor(
    () => db.prepare("SELECT * FROM alerts WHERE check_id = ? AND type = 'down' AND ok = 1").get(checkId),
    'down alert row with ok=1'
  );
  assert.ok(downAlert, 'down alert row must exist with ok=1');
  await waitFor(() => webhookHits.length > 0, 'webhook receiver hit');
  const hit = webhookHits[0];
  assert.strictEqual(hit.method, 'POST', 'webhook must be a POST');
  assert.ok(hit.headers['content-type'].includes('application/json'), 'webhook must be JSON');
  const hookPayload = JSON.parse(hit.body);
  assert.ok(hit.body.includes('Smoke Backup Job'), 'webhook body must contain check name');
  assert.ok(hit.body.includes('"status":"down"'), 'webhook body must contain "status":"down"');
  console.log(`   webhook received: event=${hookPayload.event} check=${hookPayload.check}`);

  console.log('5. Ping again → recovery: status up + up alert row');
  const before = webhookHits.length;
  await fetch(`${BASE}/ping/${token}`);
  await waitFor(async () => (await getCheckStatus(checkId)) === 'up', 'check status up after recovery');
  const upAlert = await waitFor(
    () => db.prepare("SELECT * FROM alerts WHERE check_id = ? AND type = 'up'").get(checkId),
    'up (recovery) alert row'
  );
  assert.ok(upAlert, 'recovery alert row must exist');
  await waitFor(() => webhookHits.length > before, 'recovery webhook hit');

  console.log('6. Explicit fail ping → immediate down + fail alert');
  const failRes = await fetch(`${BASE}/ping/${token}/fail`);
  assert.strictEqual(failRes.status, 200, 'fail ping must 200');
  await waitFor(async () => (await getCheckStatus(checkId)) === 'down', 'down after fail ping');
  const failAlert = await waitFor(
    () => db.prepare("SELECT * FROM alerts WHERE check_id = ? AND type = 'fail'").get(checkId),
    'fail alert row'
  );
  assert.ok(failAlert, 'fail alert row must exist');
  const failPing = db.prepare("SELECT * FROM pings WHERE check_id = ? AND kind = 'fail'").get(checkId);
  assert.ok(failPing, 'fail ping row must exist in SQLite');

  console.log('7. Status badge SVG reflects current status');
  const badgeRes = await fetch(`${BASE}/badge/${token}.svg`);
  assert.strictEqual(badgeRes.status, 200, 'badge must 200');
  assert.ok(badgeRes.headers.get('content-type').includes('svg'), 'badge content-type must be svg');
  const svg = await badgeRes.text();
  assert.ok(svg.includes('<svg'), 'badge body must contain <svg');
  assert.ok(svg.includes('down'), 'badge must contain the current status word');

  console.log('8. Cron check: next_expected_at populated and in the future');
  const cronCreated = await api('/api/checks', {
    method: 'POST',
    body: {
      name: 'Smoke Cron Check',
      schedule_type: 'cron',
      cron_expr: '* * * * *',
      tz: 'UTC',
      grace_seconds: 30
    }
  });
  assert.strictEqual(cronCreated.status, 201, 'cron check create must 201');
  assert.ok(cronCreated.data.next_expected_at, 'cron check must have next_expected_at');
  assert.ok(cronCreated.data.next_expected_at > Date.now(), 'next_expected_at must be in the future');
  console.log(`   next expected: ${new Date(cronCreated.data.next_expected_at).toISOString()}`);

  console.log('9. Bad token ping → 404');
  const badPing = await fetch(`${BASE}/ping/definitely-not-a-real-token`);
  assert.strictEqual(badPing.status, 404, 'unknown token must 404');

  db.close();
  console.log('\n✅ All smoke tests passed');
}

async function cleanup(code) {
  // kill ONLY the child we spawned — never broad-kill node/electron
  if (serverProc && !serverProc.killed) serverProc.kill();
  if (webhookServer) {
    await new Promise((r) => { webhookServer.close(r); webhookServer.closeAllConnections?.(); });
  }
  await sleep(300); // let the child release the DB file handles
  for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* windows file lock — harmless */ }
  }
  process.exit(code);
}

main()
  .then(() => cleanup(0))
  .catch(async (err) => {
    console.error('\n❌ Smoke test failed:', err.message);
    await cleanup(1);
  });
