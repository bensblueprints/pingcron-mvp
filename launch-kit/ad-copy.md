# Ad Copy — Pingcron

## Facebook / Instagram (3 short ads)

### Ad 1 — the horror story
**Hook:** Your backup cron died 6 weeks ago. Nobody told you.
**Body:** Uptime monitors watch your site. Nothing watches your *scheduled jobs* — until the restore fails. Pingcron is a dead-man's switch: your cron pings a URL when it runs, and you get alerted the moment a ping goes missing. Self-hosted, unlimited checks.
**CTA:** Get Pingcron — $29 once, no subscription →

### Ad 2 — the math
**Hook:** Cronitor: $10/month. Forever. Pingcron: $29. Once.
**Body:** Same dead-man's-switch monitoring — ping URLs, cron expressions, grace periods, Slack/email alerts, status badges. Except it runs on YOUR server, keeps YOUR data, and stops charging you after month zero. Pays for itself in 3 months.
**CTA:** Own your monitoring →

### Ad 3 — the sysadmin
**Hook:** `0 3 * * * backup.sh && curl -fsS https://you/ping/TOKEN`
**Body:** That one line is the difference between "backups are probably fine" and *knowing*. Pingcron watches every scheduled job — backups, certbot renewals, ETL runs, queue workers — and alerts you when one goes quiet. One Node process. One SQLite file. Zero monthly fees.
**CTA:** $29 lifetime — deploy in 5 minutes →

## Google Search (2 ads)

### Ad 1
- H1 (30): Cronitor Alternative — $29 (27)
- H2 (30): Cron Monitoring, Pay Once (25)
- H3 (30): Self-Hosted, Unlimited Jobs (28)
- D1 (90): Dead-man's-switch monitoring for cron jobs & backups. Alerts when pings go missing. (87)
- D2 (90): Webhook + email alerts, status badges, cron expressions. One-time $29 — no monthly fee. (89)

### Ad 2
- H1 (30): Did Your Backup Run Tonight? (28)
- H2 (30): Know When Cron Jobs Fail (24)
- H3 (30): $29 Once — No Subscription (26)
- D1 (90): Your jobs ping a URL when they run. Pingcron alerts you when a ping is late or missing. (89)
- D2 (90): Self-hosted on your VPS or desktop. Unlimited checks, your data, MIT source. Pay once. (87)

## X / Twitter launch post

Every ops person learns this the hard way: cron jobs fail *silently*.

I shipped Pingcron — a dead-man's switch for scheduled jobs you own forever:

⏱ interval or cron-expression schedules (tz-aware)
🔔 webhook + email alerts, only on transitions
📊 durations, uptime %, SVG status badges
🖥 one Node process + SQLite — VPS or desktop

Cronitor charges $10/mo for this. Pingcron is $29, once.

Source is MIT ⬇️
