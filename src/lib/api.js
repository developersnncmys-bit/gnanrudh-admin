// Thin fetch wrapper over the Express backend.
// Base URL is set via VITE_API_URL (defaults to http://localhost:4000/api).

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
const TOKEN_KEY = 'hog_token';

/* ---------- Token storage + 401 broadcast ---------- */
export const auth = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
  clear: () => auth.set(null),
};

// App subscribes here; when a protected call returns 401, we notify the app
// so it can swap to the login page.
const authListeners = new Set();
export function onAuthExpired(fn) { authListeners.add(fn); return () => authListeners.delete(fn); }
function notifyExpired() { authListeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); }

function authHeader() {
  const t = auth.get();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString() : '';
  const res = await fetch(`${BASE}${path}${qs}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    auth.clear();
    notifyExpired();
    throw new Error('Session expired. Please sign in again.');
  }
  // SEC-03: pick up a freshly-rotated token when the server was about to expire ours.
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed) auth.set(refreshed);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

const list = (path, query) => request(path, { query: { limit: 0, ...query } }).then((d) => d.items || []);
const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const del = (path) => request(path, { method: 'DELETE' });

async function uploadFiles(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append('files', f));
  const res = await fetch(`${BASE}/uploads`, { method: 'POST', body: fd, headers: authHeader() });
  if (res.status === 401) { auth.clear(); notifyExpired(); throw new Error('Session expired.'); }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  return res.json(); // { files: [{ url, filename, name, size, type }] }
}

export const api = {
  health: () => get('/health'),

  auth: {
    login: (email, password) => post('/auth/login', { email, password }),
    me: () => get('/auth/me'),
    changePassword: (current, next) => post('/auth/password', { current, next }),
  },

  uploads: {
    upload: uploadFiles,
    remove: (filename) => del(`/uploads/${encodeURIComponent(filename)}`),
  },

  categories: {
    list: () => list('/categories'),
    create: (doc) => post('/categories', doc),
    update: (id, p) => patch(`/categories/${id}`, p),
    remove: (id) => del(`/categories/${id}`),
  },
  occasions: {
    list: () => list('/occasions'),
    create: (name, parent = null, image = '') => post('/occasions', { name, parent, image }),
    rename: (id, name) => patch(`/occasions/${encodeURIComponent(id)}`, { name }),
    reparent: (id, parent) => patch(`/occasions/${encodeURIComponent(id)}`, { parent }),
    setImage: (id, image) => patch(`/occasions/${encodeURIComponent(id)}`, { image }),
    remove: (id) => del(`/occasions/${encodeURIComponent(id)}`),
  },
  priceRanges: {
    list: () => list('/price-ranges'),
    create: (doc) => post('/price-ranges', doc),
    update: (id, p) => patch(`/price-ranges/${id}`, p),
    remove: (id) => del(`/price-ranges/${id}`),
  },
  products: {
    list: () => list('/products'),
    get: (id) => get(`/products/${id}`),
    create: (doc) => post('/products', doc),
    update: (id, p) => patch(`/products/${id}`, p),
    replace: (id, doc) => put(`/products/${id}`, doc),
    remove: (id) => del(`/products/${id}`),
    bulkStatus: (ids, status) => patch('/products/bulk', { ids, status }),
  },
  customers: {
    list: () => list('/customers'),
    get: (id) => get(`/customers/${id}`),
    update: (id, p) => patch(`/customers/${id}`, p),
    addNote: (id, text, at) => post(`/customers/${id}/notes`, { text, at }),
    bulkNote: (ids, text) => post('/customers/notes', { ids, text }),
  },
  orders: {
    list: () => list('/orders'),
    get: (id) => get(`/orders/${id}`),
    update: (id, p) => patch(`/orders/${id}`, p),
    confirmPayment: (id) => post(`/orders/${id}/confirm-payment`),
    cancel: (id) => post(`/orders/${id}/cancel`),
    ship: (id) => post(`/orders/${id}/ship`),
    ndr: (id, body) => post(`/orders/${id}/ndr`, body),
    refund: (id, amount) => post(`/orders/${id}/refund`, { amount }),
  },
  returns: {
    list: () => list('/returns'),
    approve: (id) => post(`/returns/${id}/approve`),
    picked: (id) => post(`/returns/${id}/picked`),
    received: (id) => post(`/returns/${id}/received`),
    refund: (id) => post(`/returns/${id}/refund`),
    reject: (id) => post(`/returns/${id}/reject`),
  },
  shipping: {
    list: () => list('/shipping'),
    sync: (id) => post(`/shipping/${id}/sync`),
  },
  coupons: {
    list: () => list('/coupons'),
    create: (doc) => post('/coupons', doc),
    toggle: (id) => post(`/coupons/${id}/toggle`),
    remove: (id) => del(`/coupons/${id}`),
  },
  reviews: {
    list: () => list('/reviews'),
    approve: (id) => post(`/reviews/${id}/approve`),
    reject: (id) => post(`/reviews/${id}/reject`),
    reply: (id, reply) => post(`/reviews/${id}/reply`, { reply }),
    bulk: (action, ids) => post(`/reviews/bulk/${action}`, { ids }),
  },
  journal: {
    list: () => list('/journal'),
    create: (doc) => post('/journal', doc),
    update: (id, p) => patch(`/journal/${id}`, p),
    remove: (id) => del(`/journal/${id}`),
  },
  pages: {
    list: () => list('/pages'),
    update: (name, body) => put(`/pages/${encodeURIComponent(name)}`, body),
  },
  scenes: {
    list: () => list('/scenes'),
    replace: (items) => put('/scenes', items),
  },
  featured: {
    get: () => get('/featured'),
    set: (ids) => put('/featured', { ids }),
  },
  settings: {
    get: () => get('/settings'),
    patch: (section, body) => patch(`/settings/${section}`, body),
  },
  stats: {
    queue: () => get('/stats/queue'),
    dashboard: (range) => get(`/stats/dashboard?range=${range}`),
  },
  pieces: {
    list: () => list('/pieces'),
    get: (code) => get(`/pieces/${encodeURIComponent(code)}`),
    move: (code, body) => post(`/pieces/${encodeURIComponent(code)}/move`, body),
    printed: (code) => post(`/pieces/${encodeURIComponent(code)}/printed`),
    bulkPrinted: (codes) => post('/pieces/bulk/printed', { codes }),
    receive: (body) => post('/pieces/receive', body),
    reconcile: (pid) => post(`/pieces/reconcile/${encodeURIComponent(pid)}`),
    reserveOrder: (oid) => post(`/pieces/order/${encodeURIComponent(oid)}/reserve`),
    releaseOrder: (oid, why) => post(`/pieces/order/${encodeURIComponent(oid)}/release`, { why }),
    shipOrder: (oid, codes) => post(`/pieces/order/${encodeURIComponent(oid)}/ship`, { codes }),
  },
  movements: {
    list: (limit = 2000) => list('/movements', { limit }),
  },
};

// Fire-and-forget helper: run an API call in the background and toast on failure.
// Pass a `toast` function in because importing from actions.js would be circular.
export function sync(apiCall, label, toastFn) {
  Promise.resolve()
    .then(() => apiCall())
    .catch((err) => toastFn?.(`Failed to ${label || 'save'}: ${err.message}`));
}
