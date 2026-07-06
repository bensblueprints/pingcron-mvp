import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Copy, Check as CheckIcon, Pause, Play, Trash2, Pencil, BellRing, Clock, CalendarClock
} from 'lucide-react';
import StatusPill from './StatusPill.jsx';
import Sparkline from './Sparkline.jsx';
import { api, timeAgo, timeUntil } from '../api.js';

function CopyRow({ label, text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap text-emerald-300/90">
          {text}
        </code>
        <button onClick={copy} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 shrink-0" title="Copy">
          {copied ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function CheckDetail({ id, onBack, onEdit, onChanged }) {
  const [check, setCheck] = useState(null);
  const [pings, setPings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, p, a] = await Promise.all([api.check(id), api.pings(id, 100), api.alerts(id)]);
      setCheck(c);
      setPings(p);
      setAlerts(a);
    } catch {
      onBack();
    }
  }, [id, onBack]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!check) return <div className="text-zinc-500">Loading…</div>;

  const base = window.location.origin;
  const pingUrl = `${base}/ping/${check.token}`;

  const togglePause = async () => {
    if (check.status === 'paused') await api.resume(id);
    else await api.pause(id);
    load();
    onChanged();
  };

  const del = async () => {
    await api.deleteCheck(id);
    onChanged();
    onBack();
  };

  const testAlert = async () => {
    setTestResult('sending…');
    try {
      const r = await api.testAlert(id);
      setTestResult(r.ok ? 'sent ✓' : `partial: ${r.results.map((x) => `${x.channel} ${x.ok ? 'ok' : x.error}`).join(', ')}`);
    } catch (e) {
      setTestResult(e.message);
    }
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-5">
        <ArrowLeft className="w-4 h-4" /> All checks
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{check.name}</h1>
        <StatusPill status={check.status} />
        <div className="flex-1" />
        <button onClick={testAlert} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300">
          <BellRing className="w-4 h-4" /> {testResult || 'Test alert'}
        </button>
        <button onClick={() => onEdit(check)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300">
          <Pencil className="w-4 h-4" /> Edit
        </button>
        <button onClick={togglePause} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300">
          {check.status === 'paused' ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
        </button>
        {confirmDelete ? (
          <button onClick={del} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-white">
            <Trash2 className="w-4 h-4" /> Really delete?
          </button>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/40 text-red-400">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <CopyRow label="Ping from your cron job (append to the crontab line)" text={`curl -fsS -m 10 --retry 3 ${pingUrl}`} />
            <CopyRow label="Report an explicit failure" text={`curl -fsS ${pingUrl}/fail`} />
            <CopyRow label="Track run duration (call before the job)" text={`curl -fsS ${pingUrl}/start`} />
            <CopyRow label="README status badge (markdown)" text={`![${check.name}](${base}/badge/${check.token}.svg)`} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-medium mb-3">Ping log</h2>
            {pings.length === 0 ? (
              <p className="text-sm text-zinc-500">No pings yet — run the curl snippet above to send the first one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Time</th>
                      <th className="pb-2 pr-4 font-medium">Kind</th>
                      <th className="pb-2 pr-4 font-medium">Source IP</th>
                      <th className="pb-2 pr-4 font-medium">Duration</th>
                      <th className="pb-2 font-medium">Body</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pings.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4 text-zinc-300 whitespace-nowrap">{new Date(p.received_at).toLocaleString()}</td>
                        <td className="py-2 pr-4">
                          <span className={p.kind === 'fail' ? 'text-red-400' : p.kind === 'start' ? 'text-sky-400' : 'text-emerald-400'}>
                            {p.kind}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-zinc-400">{p.source_ip || '—'}</td>
                        <td className="py-2 pr-4 text-zinc-400">{p.duration_ms != null ? `${p.duration_ms}ms` : '—'}</td>
                        <td className="py-2 text-zinc-500 max-w-[16rem] truncate">{p.body_excerpt || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-sm space-y-3">
            <h2 className="text-sm font-medium">Schedule</h2>
            <div className="flex items-center gap-2 text-zinc-300">
              {check.schedule_type === 'cron' ? (
                <><CalendarClock className="w-4 h-4 text-zinc-500" /><code>{check.cron_expr}</code><span className="text-zinc-500">({check.tz})</span></>
              ) : (
                <><Clock className="w-4 h-4 text-zinc-500" />every {check.interval_seconds}s</>
              )}
            </div>
            <div className="text-zinc-500">grace {check.grace_seconds}s</div>
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <div><span className="text-zinc-500">last ping </span><span className="text-zinc-300">{timeAgo(check.last_ping_at)}</span></div>
              <div><span className="text-zinc-500">next expected </span><span className="text-zinc-300">{check.status === 'paused' ? 'paused' : timeUntil(check.next_expected_at)}</span></div>
              <div><span className="text-zinc-500">uptime </span><span className="text-zinc-300">{check.uptime_pct != null ? `${check.uptime_pct}%` : '—'}</span></div>
            </div>
            <Sparkline pings={check.recent_pings} width={220} height={32} />
            <img src={`/badge/${check.token}.svg?t=${check.status}`} alt="status badge" className="mt-1" />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-medium mb-3">Alert history</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-zinc-500">No alerts sent yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {alerts.slice(0, 20).map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className={a.type === 'up' ? 'text-emerald-400' : a.type === 'test' ? 'text-sky-400' : 'text-red-400'}>
                      {a.type}
                    </span>
                    <span className="text-zinc-500">via {a.channel}</span>
                    <span className={a.ok ? 'text-zinc-500' : 'text-red-400'}>{a.ok ? 'delivered' : a.error || 'failed'}</span>
                    <span className="flex-1" />
                    <span className="text-zinc-600 whitespace-nowrap">{new Date(a.sent_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
