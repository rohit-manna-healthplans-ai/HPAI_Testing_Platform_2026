// Thin API client. Token is kept in localStorage. All functions return parsed JSON or throw Error(message).
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const auth = {
  get token() { try { return localStorage.getItem('hpai_token'); } catch { return null; } },
  get user() { try { return JSON.parse(localStorage.getItem('hpai_user') || 'null'); } catch { return null; } },
  set(token, user) { localStorage.setItem('hpai_token', token); localStorage.setItem('hpai_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('hpai_token'); localStorage.removeItem('hpai_user'); },
};

/**
 * opts: { keepalive } -> survive page unload (body must stay < 64 KB, else we fall back to a normal fetch);
 *       { etag }      -> conditional GET: sends If-None-Match and resolves { notModified:true } on 304, else { data, etag }.
 */
export async function request(method, path, body, opts = {}) {
  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(opts.etag ? { 'If-None-Match': opts.etag } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let res;
  try {
    try {
      res = await fetch(`${API_URL}/api${path}`, opts.keepalive ? { ...init, keepalive: true } : init);
    } catch (e) {
      if (!opts.keepalive) throw e;
      res = await fetch(`${API_URL}/api${path}`, init); // keepalive refused (e.g. body too large): plain fetch
    }
  } catch {
    throw new Error('Cannot reach server. Check your connection and try again.');
  }
  if (res.status === 304) return { notModified: true };
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && auth.token) { auth.clear(); window.location.href = '/login'; }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    const ra = Number(res.headers.get('Retry-After')); if (ra > 0) err.retryAfter = ra;
    throw err;
  }
  if (opts.etag !== undefined) return { data, etag: res.headers.get('ETag') || null };
  return data;
}

const get = (p) => request('GET', p);
const post = (p, b) => request('POST', p, b ?? {});
const put = (p, b) => request('PUT', p, b ?? {});
const patch = (p, b) => request('PATCH', p, b ?? {});
const del = (p) => request('DELETE', p);
const qs = (o = {}) => { const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString(); return s ? `?${s}` : ''; };

export const api = {
  // auth
  login: (email, password) => post('/auth/login', { email, password }),
  me: () => get('/auth/me'),
  changePassword: (old_password, new_password) => post('/auth/change-password', { old_password, new_password }),
  verifyCertificate: (code) => get(`/verify/${encodeURIComponent(code)}`),
  // shared
  subjects: () => get('/subjects'),
  // admin
  admin: {
    users: (role) => get(`/admin/users${qs({ role })}`),
    createUser: (b) => post('/admin/users', b),
    bulkUsers: (b) => post('/admin/users/bulk', b),
    updateUser: (id, b) => patch(`/admin/users/${id}`, b),
    // Questions/subjects live in the frontend bank (src/bank), not in the API.
    setProctorSubjects: (id, subject_ids) => put(`/admin/proctors/${id}/subjects`, { subject_ids }),
    attempts: (f) => get(`/admin/attempts${qs(f)}`),
    stats: () => get('/admin/stats'),
    bankKeys: (password, question_ids) => post('/admin/bank-keys', { password, question_ids }),
    audit: (limit = 100) => get(`/admin/audit${qs({ limit })}`),
  },
  // proctor
  proctor: {
    candidates: () => get('/proctor/candidates'),
    createCandidate: (b) => post('/proctor/candidates', b),
    bulkCandidates: (b) => post('/proctor/candidates/bulk', b),
    updateCandidate: (id, b) => patch(`/proctor/candidates/${id}`, b),
    sessions: () => get('/proctor/sessions'),
    createSession: (b) => post('/proctor/sessions', b),
    session: (id) => get(`/proctor/sessions/${id}`),
    updateSession: (id, b) => patch(`/proctor/sessions/${id}`, b),
    attempt: (id) => get(`/proctor/attempts/${id}`),
    extend: (id, minutes, reason) => post(`/proctor/attempts/${id}/extend`, { minutes, reason }),
    terminate: (id, reason) => post(`/proctor/attempts/${id}/terminate`, { reason }),
    monitor: () => get('/proctor/monitor'),
    limits: () => get('/proctor/limits'),
    // live board: conditional GET (If-None-Match). Resolves { notModified:true } or { data, etag }.
    live: (sessionId, etag) => request('GET', `/proctor/sessions/${sessionId}/live`, undefined, { etag: etag || '' }),
    bulk: (sessionId, b) => post(`/proctor/sessions/${sessionId}/bulk`, b),
    // one-time invite links
    createInvites: (sessionId, b) => post(`/proctor/sessions/${sessionId}/invites`, b),
    invites: (sessionId) => get(`/proctor/sessions/${sessionId}/invites`),
    revokeInvite: (id) => post(`/proctor/invites/${id}/revoke`),
    reissueInvite: (id, b) => post(`/proctor/invites/${id}/reissue`, b),
  },
  // public one-time invite links (no login needed)
  invite: {
    get: (token) => get(`/invite/${encodeURIComponent(token)}`),
    redeem: (token, b) => post(`/invite/${encodeURIComponent(token)}/redeem`, b),
  },
  // candidate
  candidate: {
    sessions: () => get('/candidate/sessions'),
    start: (sessionId) => post(`/candidate/sessions/${sessionId}/start`),
    attempt: (id) => get(`/candidate/attempts/${id}`),
    saveAnswer: (attemptId, questionId, b) => put(`/candidate/attempts/${attemptId}/answers/${questionId}`, b),
    // ONE request for up to 20 dirty answers (the test page uses this; the single-answer route is kept for compatibility)
    saveAnswers: (attemptId, answers, opts) => request('PUT', `/candidate/attempts/${attemptId}/answers`, { answers }, opts),
    event: (attemptId, type, meta) => post(`/candidate/attempts/${attemptId}/events`, { type, meta }),
    eventsBatch: (attemptId, events, opts) => request('POST', `/candidate/attempts/${attemptId}/events/batch`, { events }, opts),
    submit: (attemptId, b) => post(`/candidate/attempts/${attemptId}/submit`, b ?? {}),
    result: (attemptId) => get(`/candidate/attempts/${attemptId}/result`),
  },
};
