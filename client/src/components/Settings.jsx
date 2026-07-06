import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Send } from 'lucide-react';
import { api } from '../api.js';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    api.settings().then(setForm);
  }, []);

  if (!form) return <div className="text-zinc-500">Loading…</div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls =
    'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500';

  const save = async (e) => {
    e.preventDefault();
    setForm(await api.saveSettings(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sendTest = async () => {
    setTestMsg('sending…');
    try {
      await api.saveSettings(form); // make sure current SMTP values are used
      await api.testEmail(testTo);
      setTestMsg('Test email sent ✓');
    } catch (e) {
      setTestMsg(e.message);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={save}
      className="max-w-2xl space-y-6"
    >
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-medium">SMTP (email alerts)</h2>
        <p className="text-xs text-zinc-500">
          Optional — leave blank to disable email alerts. Webhook alerts work without SMTP.
          Values can also come from env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-zinc-400">Host</span>
            <input value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value)} placeholder="smtp.example.com" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400">Port</span>
            <input value={form.smtp_port} onChange={(e) => set('smtp_port', e.target.value)} placeholder="587" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400">User</span>
            <input value={form.smtp_user} onChange={(e) => set('smtp_user', e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400">Password</span>
            <input type="password" value={form.smtp_pass} onChange={(e) => set('smtp_pass', e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-zinc-400">From address</span>
            <input value={form.smtp_from} onChange={(e) => set('smtp_from', e.target.value)} placeholder="pingcron@yourdomain.com" className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className={`${inputCls} max-w-xs`} />
          <button type="button" onClick={sendTest} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300 whitespace-nowrap">
            <Send className="w-4 h-4" /> Send test
          </button>
          {testMsg && <span className="text-xs text-zinc-400">{testMsg}</span>}
        </div>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-medium">General</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-zinc-400">Default grace period (seconds)</span>
            <input type="number" min="0" value={form.default_grace_seconds} onChange={(e) => set('default_grace_seconds', e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400">Retention (days of pings/alerts kept)</span>
            <input type="number" min="1" value={form.retention_days} onChange={(e) => set('retention_days', e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-zinc-400">Base URL (used in alert links, e.g. https://ping.yourdomain.com)</span>
            <input value={form.base_url} onChange={(e) => set('base_url', e.target.value)} placeholder="https://ping.yourdomain.com" className={`mt-1 ${inputCls}`} />
          </label>
        </div>
      </section>

      <button className="flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 rounded-lg transition-colors">
        <Save className="w-4 h-4" /> {saved ? 'Saved ✓' : 'Save settings'}
      </button>
    </motion.form>
  );
}
