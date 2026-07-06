import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Activity, Settings as SettingsIcon, LogOut, Plus } from 'lucide-react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import CheckDetail from './components/CheckDetail.jsx';
import CheckModal from './components/CheckModal.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [view, setView] = useState({ name: 'dashboard' });
  const [checks, setChecks] = useState([]);
  const [modal, setModal] = useState(null); // null | { check? }

  const refresh = useCallback(async () => {
    try {
      setChecks(await api.checks());
    } catch (e) {
      if (e.status === 401) setAuthed(false);
    }
  }, []);

  useEffect(() => {
    api.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [authed, refresh]);

  if (authed === null) {
    return <div className="min-h-screen grid place-items-center text-zinc-500">Loading…</div>;
  }
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const saveCheck = async (data, existing) => {
    if (existing) await api.updateCheck(existing.id, data);
    else await api.createCheck(data);
    setModal(null);
    refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => setView({ name: 'dashboard' })}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Activity className="w-5 h-5 text-emerald-400" />
            Pingcron
          </button>
          <span className="text-xs text-zinc-500 hidden sm:block">
            your cron jobs, watched 24/7
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New check
          </button>
          <button
            onClick={() => setView({ name: 'settings' })}
            className={`p-2 rounded-lg hover:bg-zinc-800 transition-colors ${view.name === 'settings' ? 'text-emerald-400' : 'text-zinc-400'}`}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={async () => { await api.logout(); setAuthed(false); }}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view.name === 'dashboard' && (
          <Dashboard
            checks={checks}
            onOpen={(id) => setView({ name: 'detail', id })}
            onNew={() => setModal({})}
          />
        )}
        {view.name === 'detail' && (
          <CheckDetail
            id={view.id}
            onBack={() => setView({ name: 'dashboard' })}
            onEdit={(check) => setModal({ check })}
            onChanged={refresh}
          />
        )}
        {view.name === 'settings' && <Settings />}
      </main>

      <AnimatePresence>
        {modal && (
          <CheckModal
            check={modal.check}
            onClose={() => setModal(null)}
            onSave={saveCheck}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
