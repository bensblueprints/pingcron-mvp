import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { api } from '../api.js';

const UNITS = [
  { label: 'seconds', mult: 1 },
  { label: 'minutes', mult: 60 },
  { label: 'hours', mult: 3600 },
  { label: 'days', mult: 86400 }
];

function splitInterval(seconds = 3600) {
  for (const u of [...UNITS].reverse()) {
    if (seconds % u.mult === 0 && seconds / u.mult >= 1) return { value: seconds / u.mult, mult: u.mult };
  }
  return { value: seconds, mult: 1 };
}

export default function CheckModal({ check, onClose, onSave }) {
  const init = splitInterval(check?.interval_seconds ?? 3600);
  const [form, setForm] = useState({
    name: check?.name || '',
    schedule_type: check?.schedule_type || 'interval',
    intervalValue: init.value,
    intervalMult: init.mult,
    cron_expr: check?.cron_expr || '0 3 * * *',
    tz: check?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    grace_seconds: check?.grace_seconds ?? 60,
    alert_webhook_url: check?.alert_webhook_url || '',
    alert_email: check?.alert_email || ''
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // live "next 3 runs" preview for cron schedules
  useEffect(() => {
    if (form.schedule_type !== 'cron') return;
    const t = setTimeout(() => {
      api.cronPreview(form.cron_expr, form.tz)
        .then((r) => setPreview(r.next))
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.cron_expr, form.tz, form.schedule_type]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(
        {
          name: form.name,
          schedule_type: form.schedule_type,
          interval_seconds: Number(form.intervalValue) * form.intervalMult,
          cron_expr: form.cron_expr,
          tz: form.tz,
          grace_seconds: Number(form.grace_seconds),
          alert_webhook_url: form.alert_webhook_url,
          alert_email: form.alert_email
        },
        check
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const inputCls =
    'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        onSubmit={submit}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{check ? 'Edit check' : 'New check'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Name</span>
          <input
            autoFocus
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="nightly-db-backup"
            className={`mt-1.5 ${inputCls}`}
          />
        </label>

        <div>
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Schedule</span>
          <div className="mt-1.5 grid grid-cols-2 gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            {['interval', 'cron'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('schedule_type', t)}
                className={`text-sm py-1.5 rounded-md transition-colors ${
                  form.schedule_type === t ? 'bg-emerald-500 text-zinc-950 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === 'interval' ? 'Every N…' : 'Cron expression'}
              </button>
            ))}
          </div>
        </div>

        {form.schedule_type === 'interval' ? (
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              required
              value={form.intervalValue}
              onChange={(e) => set('intervalValue', e.target.value)}
              className={`${inputCls} w-28`}
            />
            <select
              value={form.intervalMult}
              onChange={(e) => set('intervalMult', Number(e.target.value))}
              className={inputCls}
            >
              {UNITS.map((u) => (
                <option key={u.mult} value={u.mult}>{u.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                required
                value={form.cron_expr}
                onChange={(e) => set('cron_expr', e.target.value)}
                placeholder="0 3 * * *"
                className={`${inputCls} font-mono`}
              />
              <input
                value={form.tz}
                onChange={(e) => set('tz', e.target.value)}
                placeholder="UTC"
                className={`${inputCls} w-44`}
                title="IANA timezone, e.g. America/Chicago"
              />
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
              {preview ? (
                <>
                  <span className="text-zinc-400">Next 3 runs:</span>
                  {preview.map((d) => (
                    <div key={d} className="text-zinc-300 font-mono">{new Date(d).toLocaleString()}</div>
                  ))}
                </>
              ) : (
                <span className="text-red-400">Invalid cron expression</span>
              )}
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Grace period (seconds of allowed lateness)</span>
          <input
            type="number"
            min="0"
            value={form.grace_seconds}
            onChange={(e) => set('grace_seconds', e.target.value)}
            className={`mt-1.5 ${inputCls} w-40`}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Webhook alert URL</span>
            <input
              value={form.alert_webhook_url}
              onChange={(e) => set('alert_webhook_url', e.target.value)}
              placeholder="https://hooks.slack.com/…"
              className={`mt-1.5 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Email alert</span>
            <input
              type="email"
              value={form.alert_email}
              onChange={(e) => set('alert_email', e.target.value)}
              placeholder="you@example.com"
              className={`mt-1.5 ${inputCls}`}
            />
          </label>
        </div>
        <p className="text-xs text-zinc-500">Leave a channel blank to disable it for this check.</p>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-zinc-800 text-zinc-300">
            Cancel
          </button>
          <button className="text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 rounded-lg transition-colors">
            {check ? 'Save changes' : 'Create check'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
