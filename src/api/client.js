// ---------------------------------------------------------------------------
// FundOS API client.
// Conventions implemented (Frontend API Reference §1):
//  - Base path /api/v1, Bearer JWT on every call
//  - Uniform error envelope { error: CODE, detail, fields } → ApiError
//  - Idempotency-Key on every generate / approve / simulate POST
//  - Automatic one-shot token refresh on 401 (POST /auth/refresh)
// ---------------------------------------------------------------------------

export const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

const TOKEN_KEY = 'fundos.tokens';

export function getTokens() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || null; }
  catch { return null; }
}
export function setTokens(tokens) {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, code, detail, fields) {
    super(detail || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
  get isGate() { return this.status === 423; }
  get isAuth() { return this.status === 401; }
  get isNotFound() { return this.status === 404; }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

// QA BUG-016: when several parallel requests hit an expired token, each
// independently called /auth/refresh with the same (now-stale) refresh
// token. Under strict rotation, all but one would fail and force a logout.
// Share ONE in-flight refresh promise across all concurrent 401s.
let refreshInFlight = null;

async function refreshTokens() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const tokens = getTokens();
    if (!tokens?.refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens({ ...tokens, ...data });
      return true;
    } catch { return false; }
  })();
  try { return await refreshInFlight; }
  finally { refreshInFlight = null; }
}

async function parseError(res) {
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error */ }
  return new ApiError(res.status, body.error, body.detail, body.fields);
}

/**
 * Core request. opts:
 *  - method, body (object → JSON), formData (FormData), rawBody (Blob/Buffer)
 *  - idempotent: true → attach a fresh Idempotency-Key
 *  - auth: false → skip bearer
 */
export async function api(path, opts = {}) {
  const { method = 'GET', body, formData, rawBody, idempotent, auth = true, headers = {}, _retried } = opts;
  const h = { ...headers };
  if (auth) {
    const tokens = getTokens();
    if (tokens?.accessToken) h.Authorization = `Bearer ${tokens.accessToken}`;
  }
  if (idempotent) h['Idempotency-Key'] = crypto.randomUUID();

  let payload;
  if (formData) payload = formData;                       // browser sets boundary
  else if (rawBody !== undefined) { payload = rawBody; h['Content-Type'] = 'application/octet-stream'; }
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }

  const res = await fetch(`${API_BASE}${path}`, { method, headers: h, body: payload });

  if (res.status === 401 && auth && !_retried) {
    const ok = await refreshTokens();
    if (ok) return api(path, { ...opts, _retried: true });
    setTokens(null);
    onUnauthorized();
    throw await parseError(res);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const get = (path) => api(path);
export const post = (path, body, opts = {}) => api(path, { method: 'POST', body, ...opts });
export const put = (path, body, opts = {}) => api(path, { method: 'PUT', body, ...opts });
export const patch = (path, body, opts = {}) => api(path, { method: 'PATCH', body, ...opts });
export const del = (path) => api(path, { method: 'DELETE' });
