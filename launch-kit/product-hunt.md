# Product Hunt Launch — Pingcron

## Name
Pingcron

## Tagline (60 chars)
Cron job monitoring you own forever. Pay once, no monthly.

## Description (260 chars)
Dead-man's-switch monitoring for cron jobs & backups. Your job pings a URL when it runs; Pingcron alerts you when the ping is late or missing. Webhook + email alerts, status badges, run-duration tracking. Self-hosted or desktop. $29 once vs Cronitor's $10/mo.

## Full description

Every sysadmin has the same scar: a backup cron job that silently died months ago, discovered only when the restore was needed. Monitoring tools that watch *whether your site is up* don't catch this — you need a dead-man's switch that notices **the absence of a signal**.

Pingcron is that switch, and you own it:

- **Ping URL per job** — append `&& curl -fsS https://host/ping/TOKEN` to any crontab line
- **Interval or cron schedules** — "every 15 minutes" or `0 3 * * *` with timezone support and a live next-3-runs preview
- **Grace periods** — no false alarms because a backup ran 40 seconds long
- **Alerts on transitions only** — webhook (Slack/Discord/ntfy-friendly JSON) + SMTP email; down, recovery, and explicit-failure events
- **Run duration tracking** — ping `/start` before, `/ping` after; durations show in the log
- **Public SVG status badges** for your READMEs
- **Dashboard** with live status pills, uptime %, and ping sparklines
- **One process, one SQLite file** — Node + Express, deploys to a $5 VPS with docker compose, or runs as a Windows desktop app

MIT-licensed source. The paid version is the 1-click packaged installer for people who don't want to touch a terminal.

Cronitor is $10/mo. Healthchecks.io hosted is $20/mo for Business. Pingcron is $29 once — it pays for itself in 3 months and never expires.

## Maker first comment

Hey PH 👋

I built Pingcron after my Postgres backup cron died for *six weeks* before I noticed — the script was fine, the disk it wrote to had been remounted read-only. Nothing was "down", so nothing alerted.

I paid for Dead Man's Snitch, then Cronitor, and both are great products — but I was paying every month for what is fundamentally "a timestamp and a comparison". After the third annual price review, I got tired of paying $120/yr to know my backups ran and built the version I actually wanted: one Node process, one SQLite file, my hardware, my data.

Honest notes:
- It's intentionally small. No status pages with incident timelines, no on-call rotations, no team seats. It watches pings and yells when they stop.
- Healthchecks.io has an excellent OSS self-host option — if you're happy assembling a Django/Postgres deployment, use it! Pingcron's pitch is the polished, installer-ready, single-process version.
- The source is MIT on GitHub. The $29 gets you the 1-click Windows installer + updates. Some people like paying for convenience; some like `git clone`. Both work.

Happy to answer anything about the state machine, the cron parsing edge cases (timezones are pain), or why I think dead-man's-switch monitoring is the most underrated tool in ops.

## Gallery shots (5)

1. **Hero dashboard** — dark UI, grid of checks with green/red/amber status pills, sparklines, "3 up · 1 down" summary. Caption: "Every scheduled job, one glance."
2. **Check detail** — ping event log with durations + source IPs, copy-curl snippet highlighted. Caption: "Add one line to your crontab. Done."
3. **Alert in Slack** — webhook JSON rendered as a Slack message: "🔴 nightly-db-backup is DOWN". Caption: "Alerts where you live — webhook or email."
4. **Cron editor modal** — cron expression field with live "next 3 runs" preview. Caption: "Real cron expressions, timezone-aware."
5. **Comparison card** — "$29 once vs $360 over 3 years on Cronitor" pricing math with the badge SVG shown embedded in a GitHub README. Caption: "Pays for itself in 3 months."
