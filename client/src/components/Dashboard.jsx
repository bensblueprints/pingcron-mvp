import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CalendarClock, Plus, Timer } from 'lucide-react';
import StatusPill from './StatusPill.jsx';
import Sparkline from './Sparkline.jsx';
import { timeAgo, timeUntil } from '../api.js';

export default function Dashboard({ checks, onOpen, onNew }) {
  if (checks.length === 0) {
    return (
      <div className="text-center py-24">
        <Timer className="w-12 h-12 mx-auto text-zinc-700" />
        <h2 className="mt-4 text-lg font-medium">No checks yet</h2>
        <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
          Create a check, then have your cron job hit its ping URL when it runs.
          Pingcron alerts you when the ping is late or missing.
        </p>
        <button
          onClick={onNew}
          className="mt-6 inline-flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Create your first check
        </button>
      </div>
    );
  }

  const summary = { up: 0, down: 0, grace: 0, paused: 0, new: 0 };
  checks.forEach((c) => summary[c.status]++);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 text-sm text-zinc-400">
        <span className="font-medium text-zinc-100">{checks.length} checks</span>
        {summary.down > 0 && <span className="text-red-400">{summary.down} down</span>}
        {summary.grace > 0 && <span className="text-amber-400">{summary.grace} late</span>}
        {summary.up > 0 && <span className="text-emerald-400">{summary.up} up</span>}
        {summary.paused > 0 && <span>{summary.paused} paused</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onOpen(c.id)}
            className="text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium truncate group-hover:text-emerald-400 transition-colors">
                {c.name}
              </h3>
              <StatusPill status={c.status} />
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              {c.schedule_type === 'cron' ? (
                <>
                  <CalendarClock className="w-3.5 h-3.5" />
                  <code className="text-zinc-400">{c.cron_expr}</code>
                  <span>({c.tz})</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  every {c.interval_seconds >= 3600 ? `${Math.round(c.interval_seconds / 3600)}h` : c.interval_seconds >= 60 ? `${Math.round(c.interval_seconds / 60)}m` : `${c.interval_seconds}s`}
                </>
              )}
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-zinc-500">last ping </span>
                  <span className="text-zinc-300">{timeAgo(c.last_ping_at)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">next </span>
                  <span className="text-zinc-300">{c.status === 'paused' ? 'paused' : timeUntil(c.next_expected_at)}</span>
                </div>
              </div>
              <div className="text-right">
                <Sparkline pings={c.recent_pings} />
                <div className="text-[10px] text-zinc-500 mt-1">
                  {c.uptime_pct != null ? `${c.uptime_pct}% ok (last ${c.recent_pings.length})` : 'no data'}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
