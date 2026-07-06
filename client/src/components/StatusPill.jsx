import React from 'react';

const STYLES = {
  up: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  down: 'bg-red-500/15 text-red-400 border-red-500/30',
  grace: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  paused: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  new: 'bg-sky-500/15 text-sky-400 border-sky-500/30'
};

const DOTS = {
  up: 'bg-emerald-400',
  down: 'bg-red-400',
  grace: 'bg-amber-400',
  paused: 'bg-zinc-400',
  new: 'bg-sky-400'
};

export default function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${STYLES[status] || STYLES.paused}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[status] || DOTS.paused} ${status === 'up' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
}
