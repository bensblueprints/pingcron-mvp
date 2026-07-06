async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: { password } }),
  logout: () => req('/api/logout', { method: 'POST' }),
  checks: () => req('/api/checks'),
  check: (id) => req(`/api/checks/${id}`),
  createCheck: (body) => req('/api/checks', { method: 'POST', body }),
  updateCheck: (id, body) => req(`/api/checks/${id}`, { method: 'PUT', body }),
  deleteCheck: (id) => req(`/api/checks/${id}`, { method: 'DELETE' }),
  pause: (id) => req(`/api/checks/${id}/pause`, { method: 'POST' }),
  resume: (id) => req(`/api/checks/${id}/resume`, { method: 'POST' }),
  testAlert: (id) => req(`/api/checks/${id}/test-alert`, { method: 'POST' }),
  pings: (id, limit = 100) => req(`/api/checks/${id}/pings?limit=${limit}`),
  alerts: (checkId) => req(`/api/alerts${checkId ? `?check_id=${checkId}` : ''}`),
  settings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings', { method: 'PUT', body }),
  testEmail: (to) => req('/api/settings/test-email', { method: 'POST', body: { to } }),
  cronPreview: (expr, tz) =>
    req(`/api/cron-preview?expr=${encodeURIComponent(expr)}&tz=${encodeURIComponent(tz)}`)
};

export function timeAgo(ms) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function timeUntil(ms) {
  if (!ms) return '—';
  const s = Math.floor((ms - Date.now()) / 1000);
  if (s < 0) return 'overdue';
  if (s < 60) return `in ${s}s`;
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `in ${Math.floor(s / 3600)}h`;
  return `in ${Math.floor(s / 86400)}d`;
}
