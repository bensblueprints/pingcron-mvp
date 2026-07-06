const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

// 22-char URL-safe base62 token (nanoid-style, crypto-strong, no ESM dep).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function genToken(len = 22) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      schedule_type TEXT NOT NULL DEFAULT 'interval',  -- 'interval' | 'cron'
      interval_seconds INTEGER,
      cron_expr TEXT,
      tz TEXT DEFAULT 'UTC',
      grace_seconds INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'new',              -- new|up|grace|down|paused
      status_before_pause TEXT,
      last_ping_at INTEGER,                            -- epoch ms
      last_started_at INTEGER,
      next_expected_at INTEGER,
      alert_webhook_url TEXT DEFAULT '',
      alert_email TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                              -- success|fail|start
      received_at INTEGER NOT NULL,
      source_ip TEXT,
      duration_ms INTEGER,
      body_excerpt TEXT
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_id INTEGER NOT NULL,
      type TEXT NOT NULL,                              -- down|up|fail|test
      channel TEXT NOT NULL,                           -- webhook|email
      payload_json TEXT,
      sent_at INTEGER NOT NULL,
      ok INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pings_check ON pings(check_id, received_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_check ON alerts(check_id, sent_at);
  `);

  return db;
}

const DEFAULT_SETTINGS = {
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  retention_days: '90',
  default_grace_seconds: '60',
  base_url: ''
};

function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  // env fills in anything not set via the settings page
  if (process.env.SMTP_HOST) out.smtp_host = process.env.SMTP_HOST;
  if (process.env.SMTP_PORT) out.smtp_port = process.env.SMTP_PORT;
  if (process.env.SMTP_USER) out.smtp_user = process.env.SMTP_USER;
  if (process.env.SMTP_PASS) out.smtp_pass = process.env.SMTP_PASS;
  if (process.env.SMTP_FROM) out.smtp_from = process.env.SMTP_FROM;
  if (process.env.BASE_URL) out.base_url = process.env.BASE_URL;
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    if (r.value !== '' && r.value != null) out[r.key] = r.value;
  }
  return out;
}

function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (k in DEFAULT_SETTINGS) stmt.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(obj));
}

module.exports = { openDb, genToken, getSettings, setSettings, DEFAULT_SETTINGS };
