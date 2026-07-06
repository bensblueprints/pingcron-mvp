import React from 'react';

// Ping history sparkline: one bar per recent ping (green = success, red = fail).
// Bar height scales with duration when available, otherwise uniform.
export default function Sparkline({ pings = [], width = 120, height = 24 }) {
  const n = 30;
  const slots = pings.slice(-n);
  const maxDur = Math.max(1, ...slots.map((p) => p.duration_ms || 0));
  const bw = width / n;
  return (
    <svg width={width} height={height} className="shrink-0">
      {slots.map((p, i) => {
        const h = p.duration_ms ? Math.max(4, (p.duration_ms / maxDur) * (height - 2)) : height * 0.55;
        return (
          <rect
            key={i}
            x={width - (slots.length - i) * bw + 1}
            y={height - h}
            width={Math.max(1, bw - 2)}
            height={h}
            rx="1"
            className={p.kind === 'fail' ? 'fill-red-400/80' : 'fill-emerald-400/70'}
          />
        );
      })}
      {slots.length === 0 && (
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" className="fill-zinc-600 text-[10px]">
          no pings yet
        </text>
      )}
    </svg>
  );
}
