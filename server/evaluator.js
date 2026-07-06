// The dead-man's-switch loop. Runs every EVAL_INTERVAL_MS (default 15s):
// up   → grace  when now passes next_expected_at
// grace→ down   when now passes next_expected_at + grace  (fires the DOWN alert once)
// Status is persisted, and we only alert on transitions — restarts never re-fire.
const { sendAlerts } = require('./alerts');
const { getSettings } = require('./db');

// small tolerance for clock skew / timer jitter
const SKEW_MS = 500;

function startEvaluator(db, intervalMs = 15000) {
  let lastPrune = 0;

  const tick = () => {
    try {
      const now = Date.now();
      const stale = db
        .prepare(
          "SELECT * FROM checks WHERE status IN ('up','grace') AND next_expected_at IS NOT NULL AND next_expected_at < ?"
        )
        .all(now - SKEW_MS);

      for (const check of stale) {
        const graceEnd = check.next_expected_at + Number(check.grace_seconds) * 1000;
        if (now - SKEW_MS <= graceEnd) {
          if (check.status !== 'grace') {
            db.prepare('UPDATE checks SET status = ? WHERE id = ?').run('grace', check.id);
          }
        } else {
          db.prepare('UPDATE checks SET status = ? WHERE id = ?').run('down', check.id);
          console.log(`[evaluator] "${check.name}" missed its ping — DOWN`);
          sendAlerts(db, { ...check, status: 'down' }, 'down').catch((e) =>
            console.warn('[evaluator] alert error:', e.message)
          );
        }
      }

      // retention pruning, at most hourly
      if (now - lastPrune > 3600_000) {
        lastPrune = now;
        const days = Number(getSettings(db).retention_days) || 90;
        const cutoff = now - days * 86400_000;
        db.prepare('DELETE FROM pings WHERE received_at < ?').run(cutoff);
        db.prepare('DELETE FROM alerts WHERE sent_at < ?').run(cutoff);
      }
    } catch (e) {
      console.error('[evaluator] tick error:', e.message);
    }
  };

  const timer = setInterval(tick, intervalMs);
  tick(); // evaluate immediately on boot
  return () => clearInterval(timer);
}

module.exports = { startEvaluator };
