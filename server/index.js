require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5320;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'pingcron.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const EVAL_INTERVAL_MS = Number(process.env.EVAL_INTERVAL_MS) || 15000;

const app = createApp({ dbPath: DB_PATH, adminPassword: ADMIN_PASSWORD, evalIntervalMs: EVAL_INTERVAL_MS });

app.listen(PORT, () => {
  console.log(`Pingcron listening on http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'admin') {
    console.log('⚠ Using default admin password — set ADMIN_PASSWORD in .env for production.');
  }
});
