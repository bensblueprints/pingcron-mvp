// Schedule math: when is the next ping expected?
const cronParser = require('cron-parser');

// Next expected ping time (epoch ms) computed from `fromMs`.
// Interval checks anchor on the last ping, cron checks on the cron expression.
function computeNextExpected(check, fromMs) {
  if (check.schedule_type === 'cron') {
    const it = cronParser.parseExpression(check.cron_expr, {
      currentDate: new Date(fromMs),
      tz: check.tz || 'UTC'
    });
    return it.next().getTime();
  }
  return fromMs + Number(check.interval_seconds) * 1000;
}

function validateCron(expr, tz) {
  try {
    cronParser.parseExpression(expr, { tz: tz || 'UTC' });
    return true;
  } catch {
    return false;
  }
}

function cronPreview(expr, tz, count = 3) {
  const it = cronParser.parseExpression(expr, { tz: tz || 'UTC' });
  const out = [];
  for (let i = 0; i < count; i++) out.push(it.next().toISOString());
  return out;
}

module.exports = { computeNextExpected, validateCron, cronPreview };
