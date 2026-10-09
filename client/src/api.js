// Thin fetch wrapper. Errors carry the server's message and any extra
// fields (validation problems, confirmation prompts).

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body || {};
  }
}

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const enc = encodeURIComponent;

export const api = {
  scenarios: () => call('GET', '/api/scenarios'),
  cases: () => call('GET', '/api/cases'),
  createCase: (scenarioId, analyst) => call('POST', '/api/cases', { scenarioId, analyst }),
  getCase: (id) => call('GET', `/api/cases/${id}`),
  deleteCase: (id) => call('DELETE', `/api/cases/${id}`),
  ack: (id) => call('POST', `/api/cases/${id}/ack`),
  logs: (id, { q = '', source = '', limit = 100, offset = 0, from, to, order } = {}) => {
    const p = new URLSearchParams({ q, source, limit, offset });
    if (from !== undefined) p.set('from', from);
    if (to !== undefined) p.set('to', to);
    if (order) p.set('order', order);
    return call('GET', `/api/cases/${id}/logs?${p}`);
  },
  events: (id, ids) => call('GET', `/api/cases/${id}/events?ids=${enc(ids.join(','))}`),
  pin: (id, eventId, note) => call('POST', `/api/cases/${id}/pins`, { eventId, note }),
  unpin: (id, eventId) => call('DELETE', `/api/cases/${id}/pins/${enc(eventId)}`),
  addIoc: (id, value, type) => call('POST', `/api/cases/${id}/iocs`, { value, type }),
  removeIoc: (id, value) => call('POST', `/api/cases/${id}/iocs/remove`, { value }),
  note: (id, text) => call('POST', `/api/cases/${id}/notes`, { text }),
  draft: (id, draft) => call('PUT', `/api/cases/${id}/draft`, draft),
  tool: (id, tool, input, filter) => call('POST', `/api/cases/${id}/tools/${tool}`, { input, filter }),
  action: (id, body) => call('POST', `/api/cases/${id}/actions`, body),
  submit: (id, body) => call('POST', `/api/cases/${id}/submit`, body),
};
