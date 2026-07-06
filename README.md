# 🫀 Pingcron

**Your cron jobs, watched 24/7. Pay once.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Pingcron is dead-man's-switch monitoring for cron jobs, backups, and scheduled tasks — the kind you *only find out failed when it's too late*. Your job hits a unique ping URL every time it runs; Pingcron alerts you the moment a ping is **late or missing**. Self-hosted, one process, one SQLite file. No Cronitor subscription, no per-check pricing, no third party holding your uptime data.

> Pay once. Own it forever. No subscription.

![Pingcron dashboard](docs/screenshot.png)

## Features

- ⏱ **Two schedule types** — "expected every N minutes/hours" *or* a full 5-field cron expression with timezone support and a live "next 3 runs" preview
- 🕊 **Grace periods** — allow N seconds of lateness before alerting, per check
- 🔔 **Alerts on transitions only** — webhook (JSON POST, works with Slack/Discord/ntfy) and SMTP email; fires on down, recovery, and explicit failure — never spams repeats, survives restarts without re-firing
- 📟 **Rich ping API** — `GET|POST /ping/:token`, `/ping/:token/start` for run-duration tracking, `/ping/:token/fail` (or `?status=fail`) for explicit failures, ping bodies stored as logs (first 10KB)
- 📊 **Dashboard** — live status pills, "last ping 3m ago", next expected ping, uptime %, ping-history sparklines
- 🔍 **Check detail** — full ping event log (time, source IP, duration), alert history, copy-paste curl snippets
- 🛡 **Public status badges** — embeddable SVG shield per check (`/badge/:token.svg`) for your READMEs, plus `/status/:token.json`
- ⏸ **Pause/resume** any check; delete with confirmation
- 🖥 **Dual mode** — run it as a Windows desktop app, or deploy to a $5 VPS when you need it public
- 🔒 **100% local** — your data never leaves your box; no telemetry, no phoning home

## Quick start

```bash
npm i && npm run build && npm start
# → http://localhost:5320  (default password: admin — set ADMIN_PASSWORD!)
```

Then wire up a cron job:

```cron
0 3 * * * /usr/local/bin/backup.sh && curl -fsS -m 10 --retry 3 https://your-host:5320/ping/YOUR_TOKEN
```

If the backup stops running — or exits non-zero and never pings — you get alerted.

### Desktop mode

```bash
npm i
npm run desktop
```

Same app, zero setup: the Express server boots on a free local port, data lives in your user profile, and you're auto-logged-in. `npm run dist` builds a Windows installer.

### Docker / VPS

```bash
cp .env.example .env   # set ADMIN_PASSWORD, BASE_URL, SMTP
docker compose up -d
```

SQLite lives in a named volume; back up one file and you've backed up everything.

## Tech stack

Node 20+ · Express · better-sqlite3 · cron-parser · nodemailer · React 18 · Vite · Tailwind CSS 4 · Framer Motion · Lucide · Electron (desktop mode)

## Pingcron vs. the monthly guys

| | **Pingcron** | Cronitor | Healthchecks.io (hosted) | Dead Man's Snitch |
|---|---|---|---|---|
| Price | **$29 once** | $10/mo solo, $50/mo team | $20/mo Business | $5–$49/mo |
| Cost over 3 years | **$29** | $360+ | $720 | $180+ |
| Checks | Unlimited | Tiered | Tiered | Tiered |
| Your data | On your box | Their cloud | Their cloud | Their cloud |
| Cron expressions + timezones | ✅ | ✅ | ✅ | ✅ |
| Run duration tracking (start/end) | ✅ | ✅ | ✅ | ❌ |
| Status badges | ✅ | ✅ | ✅ | ❌ |
| Desktop app | ✅ | ❌ | ❌ | ❌ |
| Self-hosted | ✅ one process | ❌ | ⚠️ OSS exists (assemble it yourself) | ❌ |

*Pays for itself in 3 months vs. Cronitor solo.*

## ☕ Skip the setup — get the 1-click installer

Want the packaged Windows installer plus lifetime updates without touching a terminal? Grab the one-time bundle:

**→ [https://whop.com/onetime-suite](https://whop.com/onetime-suite)**

## API reference

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET\|POST /ping/:token` | none | record a successful run (`?status=fail` for failure) |
| `GET\|POST /ping/:token/start` | none | record run start (enables duration tracking) |
| `GET\|POST /ping/:token/fail` | none | record an explicit failure → immediate alert |
| `GET /badge/:token.svg` | none | SVG status shield |
| `GET /status/:token.json` | none | JSON status |
| `POST /api/login` / `/api/logout` | — | session auth |
| `GET\|POST /api/checks`, `GET\|PUT\|DELETE /api/checks/:id` | session | manage checks |
| `POST /api/checks/:id/pause` / `resume` / `test-alert` | session | control |
| `GET /api/checks/:id/pings`, `GET /api/alerts` | session | logs |
| `GET\|PUT /api/settings` | session | SMTP, retention, base URL |

## Development

```bash
npm start        # API on :5320
npm run dev      # Vite dev server on :5321 (proxies /api)
npm test         # smoke test: full ping → down → alert → recovery pipeline
```

## License

[MIT](LICENSE) © 2026 Ben (bensblueprints)
