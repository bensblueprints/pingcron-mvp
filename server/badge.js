// Embeddable SVG status shield: green "up" / red "down" / grey "paused".
const COLORS = {
  up: '#3fb950',
  down: '#f85149',
  grace: '#d29922',
  paused: '#8b949e',
  new: '#58a6ff'
};

// ~6.1px per char at 11px Verdana — close enough for a shield
function textWidth(s) {
  return Math.round(s.length * 6.6) + 10;
}

function badgeSvg(label, status) {
  const color = COLORS[status] || COLORS.paused;
  const lw = textWidth(label);
  const sw = textWidth(status);
  const w = lw + sw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${status}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${sw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lw / 2}" y="13">${label}</text>
    <text x="${lw + sw / 2}" y="14" fill="#010101" fill-opacity=".3">${status}</text>
    <text x="${lw + sw / 2}" y="13">${status}</text>
  </g>
</svg>`;
}

module.exports = { badgeSvg };
