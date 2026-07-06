# Launch Strategy — Pingcron

## Target communities (rules-aware angles)

### r/selfhosted (~500k)
Self-promo is tolerated when it's genuinely self-hostable, open source, and the post leads with the software, not the sale. Angle: **"I built a single-process, SQLite-backed Healthchecks alternative — here's the architecture"**. Lead with a screenshot + docker-compose snippet, mention MIT source in the first line, and answer the inevitable "why not Healthchecks self-hosted?" honestly (it's excellent; Pingcron trades features for a one-file deploy and a desktop mode). Don't link the paid installer in-post — keep it in the GitHub README.

### r/devops (~400k)
No direct advertising; show-and-tell threads and postmortem content do well. Angle: **a war-story post** — "Our backup cron died for 6 weeks and nothing alerted. Here's the monitoring pattern that catches silent failures (dead-man's switch), and the OSS tool I built around it." Focus on the *pattern* (start/end pings, grace windows, transition-only alerting) so the post stands alone even if nobody clicks.

### r/sysadmin (~900k)
Strict on self-promo — use the weekly "self-promotion" style threads or contribute value-first. Angle: **a comment-ready checklist**, "Every scheduled task you own should ping something. Here's a minimal pattern with plain curl", with Pingcron mentioned as the tool you wrote to receive the pings. The `&& curl -fsS` crontab one-liner is the hook that resonates here.

## Hacker News — Show HN draft

**Title:** Show HN: Pingcron – self-hosted dead-man's-switch monitoring for cron jobs

**Body:**

I lost six weeks of Postgres backups to a cron job that "ran" but wrote to a read-only mount. Nothing was down, so nothing alerted. Since then I'm religious about dead-man's-switch monitoring: every scheduled job pings a URL when it finishes, and something yells when the ping doesn't arrive.

I was paying Cronitor $10/mo for that and it felt wrong for what is essentially a timestamp comparison, so I built Pingcron: a single Node process with SQLite that does the whole loop — ping endpoints (`/ping/:token`, `/start` for durations, `/fail` for explicit failures), interval or cron-expression schedules with timezones and grace windows, a 15-second evaluator with a persisted state machine (new → up → grace → down) so restarts never double-alert, webhook + SMTP alerts on transitions only, and embeddable SVG status badges.

Design choices worth debating: alerts fire only on state transitions (no repeat-nagging — arguably a feature and a bug); ping endpoints are deliberately unauthenticated (the token is the secret) with light per-token rate limiting; interval schedules anchor "next expected" on the last ping rather than a fixed grid, which matches how people actually run jobs.

Source is MIT. I sell a packaged 1-click Windows installer for $29 for people who don't want to touch a terminal — the README `git clone` path is complete and free. Healthchecks.io's OSS self-host is the mature alternative if you want teams/integrations; Pingcron is the "one process, one file, five minutes" version.

## SEO keywords (10)

1. cron job monitoring
2. cronitor alternative
3. healthchecks alternative self hosted
4. dead man's switch monitoring
5. heartbeat monitoring self hosted
6. cron job failed silently
7. backup monitoring tool
8. scheduled task monitoring
9. dead man's snitch alternative
10. self hosted cron monitor one time payment

## AppSumo / PitchGround pitch

Pingcron is dead-man's-switch monitoring for the jobs your uptime monitor can't see: cron jobs, backups, ETL pipelines, cert renewals. Each job pings a unique URL when it runs; Pingcron alerts via webhook or email the moment a ping is late or missing — with cron-expression schedules, timezones, grace periods, run-duration tracking, and embeddable status badges. It's a single Node process with a SQLite file: your customers deploy it to any $5 VPS with docker compose or run it as a Windows desktop app, with unlimited checks and zero recurring cost. The category leaders (Cronitor $10–50/mo, Healthchecks.io $20/mo, Dead Man's Snitch $5–49/mo) all rent this as a service; Pingcron is the own-it-forever version — a perfect LTD product because the value literally compounds every month the customer doesn't pay someone else.

## Pricing

**$29 one-time** (installer + lifetime updates).

Competitor math:
- Cronitor solo: $10/mo → **Pingcron pays for itself in 3 months** ($360 saved over 3 years)
- Healthchecks.io Business: $20/mo → pays for itself in ~6 weeks ($720/3yr)
- Dead Man's Snitch: $5–49/mo → 1–6 months to break even
- UptimeRobot heartbeat monitors (paid tiers ~$7+/mo): ~4 months

Anchor line for all copy: **"Cronitor charges $360 over three years. Pingcron is $29, once."**
