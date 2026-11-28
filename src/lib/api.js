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

// PERF: in-flight dedupe + short GET micro-cache.
// Two unrelated effects (/auth/me probe, a route-change refresh, a
// drawer open) can legitimately request the same URL in the same tick.
// Without dedupe each one spins up its own Vercel function invocation
// and multiplies the fan-out that produced the 2-minute dashboard /
// 504 FUNCTION_INVOCATION_TIMEOUT. With dedupe N concurrent callers
// share ONE network round-trip and resolve together.
//
// Only GETs with no body go through the cache; mutations (POST/PATCH/
// PUT/DELETE) always hit the network. The cache TTL is deliberately
// tiny (1.5 s) — long enough to absorb a React double-render or an
// in-flight route change kicking off its own refresh, short enough
// that an admin never sees stale data on manual navigation.
const INFLIGHT = new Map();           // key -> Promise<result>
const GET_CACHE = new Map();          // key -> { at, value }
const GET_CACHE_TTL = 1_500;          // ms

function cacheKey(path, qs) { return `GET ${path}${qs}`; }

export function invalidateGetCache(pathPrefix) {
  if (!pathPrefix) { GET_CACHE.clear(); return; }
  for (const k of GET_CACHE.keys()) {
    // keys are "GET <path><qs>" — match against the path portion.
    if (k.startsWith(`GET ${pathPrefix}`)) GET_CACHE.delete(k);
  }
}

async function doFetch(path, qs, method, body) {
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
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
      // Routes like /orders/:id/invoice return an `issues` array listing every
      // Settings field that failed `settingsReady`. Surface them so the toast is actionable.
      if (Array.isArray(j.issues) && j.issues.length) msg += ` — ${j.issues.join('; ')}`;
    } catch { /* non-JSON */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function request(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString() : '';

  // Mutations bypass cache and invalidate any GETs under the same resource path.
  if (method !== 'GET' || body) {
    try {
      return await doFetch(path, qs, method, body);
    } finally {
      // /products/:id PATCH should bust /products GETs too; strip trailing /:id.
      const resource = path.replace(/^\/+/, '').split('/')[0];
      if (resource) invalidateGetCache(`/${resource}`);
    }
  }

  const key = cacheKey(path, qs);
  const now = Date.now();
  const cached = GET_CACHE.get(key);
  if (cached && now - cached.at < GET_CACHE_TTL) return cached.value;

  const inflight = INFLIGHT.get(key);
  if (inflight) return inflight;

  const p = doFetch(path, qs, method, body)
    .then((value) => {
      GET_CACHE.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => { INFLIGHT.delete(key); });
  INFLIGHT.set(key, p);
  return p;
}

// PERF-03: backend caps lists at PAGE_SIZE rows per request (bumped to 500
// server-side). Paging strategy:
//   1. Fetch page 0 to learn the collection's total.
//   2. If one page covered it, done (no second round-trip).
//   3. Otherwise fire every remaining page in PARALLEL — one network
//      latency instead of N sequential waits. For a 9,000-row collection
//      this collapses ~90 serial round-trips (~9 s) into one first call
//      plus ~17 parallel calls (~200 ms).
const PAGE_SIZE = 500;
// PERF: lowered from 6 to 3. Bootstrap fires 18 list endpoints in parallel;
// each over-500-row collection then fans out to its own worker pool. At
// PARALLEL_LIMIT=6 the aggregate burst was 100+ concurrent Vercel function
// invocations against a maxPoolSize=10 Mongo pool — individual queries
// stayed under 5 s but connection waits chained into 60 s+ (504s). At 3
// the burst caps at ~54 and the pool keeps up, while a 10k-row collection
// still drains in ~7 parallel waves instead of 20 serial.
const PARALLEL_LIMIT = 3;
const PARALLEL_CAP = 1000; // sanity cap so a misreported total can't blow up the browser
async function list(path, query = {}) {
  const first = await request(path, { query: { limit: PAGE_SIZE, skip: 0, ...query } });
  const items = Array.isArray(first.items) ? [...first.items] : [];
  // Partial first batch → we're done (last page is always short).
  if (items.length < PAGE_SIZE) return items;

  // Some endpoints report `total` as the whole-collection count; some lie
  // and set it to items.length. We trust it ONLY when it exceeds the first
  // page. Otherwise probe serially (the pre-parallel behaviour) so a
  // misreporting endpoint can't cause silent truncation.
  const total = Number.isFinite(first.total) && first.total > items.length ? first.total : null;

  if (total !== null) {
    // Build the remaining skips, then drain them through a bounded worker
    // pool. Firing all ~70 pages at once (first attempt) overwhelmed the
    // backend — MongoDB connection pool + Vercel function memory couldn't
    // absorb the burst and the server returned 500s. Concurrency of 6
    // keeps most of the parallel speedup while staying within limits.
    const skips = [];
    for (let skip = PAGE_SIZE; skip < total && skips.length < PARALLEL_CAP; skip += PAGE_SIZE) {
      skips.push(skip);
    }
    const results = new Array(skips.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(PARALLEL_LIMIT, skips.length) }, async () => {
      while (true) {
        const idx = cursor;
        cursor += 1;
        if (idx >= skips.length) return;
        results[idx] = await request(path, { query: { limit: PAGE_SIZE, skip: skips[idx], ...query } });
      }
    });
    await Promise.all(workers);
    for (const d of results) {
      const batch = Array.isArray(d?.items) ? d.items : [];
      items.push(...batch);
    }
    return items;
  }

  // Fallback: serial paging. Stops the first time a batch comes back short.
  let skip = PAGE_SIZE;
  for (let page = 1; page < PARALLEL_CAP; page += 1) {
    const d = await request(path, { query: { limit: PAGE_SIZE, skip, ...query } });
    const batch = Array.isArray(d.items) ? d.items : [];
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return items;
}
const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const del = (path) => request(path, { method: 'DELETE' });

// Media size caps. Images get a tight 10 MB cap (anything larger is a
// badly-exported photo — no visual benefit on a web card) and videos get
// 50 MB because drape clips are ~10-30 MB in mp4 at 720p. Backend multer
// limit is set higher (see routes/uploads.js) so a user who manages to
// bypass the client check still gets rejected server-side with a 413.
// Per-file check runs BEFORE FormData assembly so a 300 MB mistake fails
// in milliseconds rather than after a slow upload.
export const UPLOAD_LIMITS = {
  image: 10 * 1024 * 1024,  // 10 MB
  video: 50 * 1024 * 1024,  // 50 MB
  other: 10 * 1024 * 1024,  // CSVs / pincode lists / anything else
};

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindOf(file) {
  const mt = String(file.type || '');
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  return 'other';
}

export function checkUploadSizes(files) {
  const bad = [];
  for (const f of files) {
    const kind = kindOf(f);
    const limit = UPLOAD_LIMITS[kind];
    if (f.size > limit) {
      bad.push({ name: f.name, size: f.size, kind, limit });
    }
  }
  if (!bad.length) return null;
  const first = bad[0];
  return bad.length === 1
    ? `${first.name} is ${formatMB(first.size)} — ${first.kind}s must be under ${formatMB(first.limit)}.`
    : `${bad.length} files are over the limit (${first.kind}s: ${formatMB(first.limit)}, videos: ${formatMB(UPLOAD_LIMITS.video)}). First: ${first.name} at ${formatMB(first.size)}.`;
}

async function uploadFiles(files) {
  const list = [...files];
  const err = checkUploadSizes(list);
  if (err) throw new Error(err);
  const fd = new FormData();
  list.forEach((f) => fd.append('files', f));
  const res = await fetch(`${BASE}/uploads`, { method: 'POST', body: fd, headers: authHeader() });
  if (res.status === 401) { auth.clear(); notifyExpired(); throw new Error('Session expired.'); }
  // Backend's multer rejects over-limit uploads with 413 (or 500 with
  // `LIMIT_FILE_SIZE` in the body from multer's MulterError). Surface a
  // readable message so the toast tells the admin what to do.
  if (res.status === 413) {
    throw new Error(`Upload too large. Images must be under ${formatMB(UPLOAD_LIMITS.image)}, videos under ${formatMB(UPLOAD_LIMITS.video)}.`);
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
      if (/LIMIT_FILE_SIZE/i.test(JSON.stringify(j))) {
        msg = `Upload too large. Images must be under ${formatMB(UPLOAD_LIMITS.image)}, videos under ${formatMB(UPLOAD_LIMITS.video)}.`;
      }
      // Routes like /orders/:id/invoice return an `issues` array listing every
      // Settings field that failed `settingsReady`. Surface them so the toast is actionable.
      if (Array.isArray(j.issues) && j.issues.length) msg += ` — ${j.issues.join('; ')}`;
    } catch { /* non-JSON */ }
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
    // SEC-06: per-device session management. Backend tracks one Session
    // doc per login; the JWT carries its `sid` so revoking the Session
    // row immediately invalidates that device's token.
    sessions: () => get('/auth/sessions'),
    revokeSession: (id) => del(`/auth/sessions/${encodeURIComponent(id)}`),
  },

  // Team management — only owners can mutate. Backend enforces the same.
  // See backend/src/routes/team.js for the exact rules (last-owner guards,
  // self-disable / self-delete forbidden, tokenInvalidBefore bumps).
  team: {
    list: () => list('/team'),
    invite: ({ email, name, role, password }) => post('/team', { email, name, role, password }),
    update: (id, patch) => request(`/team/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
    resetPassword: (id, password) => post(`/team/${encodeURIComponent(id)}/reset-password`, { password }),
    remove: (id) => del(`/team/${encodeURIComponent(id)}`),
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
  heroSlides: {
    list: () => list('/hero-slides'),
    create: (doc) => post('/hero-slides', doc),
    update: (id, p) => patch(`/hero-slides/${id}`, p),
    remove: (id) => del(`/hero-slides/${id}`),
  },
  homeBanners: {
    list: () => list('/home-banners'),
    update: (slot, p) => patch(`/home-banners/${slot}`, p),
  },
  products: {
    list: () => list('/products'),
    get: (id) => get(`/products/${id}`),
    create: (doc) => post('/products', doc),
    update: (id, p) => patch(`/products/${id}`, p),
    replace: (id, doc) => put(`/products/${id}`, doc),
    remove: (id) => del(`/products/${id}`),
    bulkStatus: (ids, status) => patch('/products/bulk', { ids, status }),
    bulkCreate: (rows) => post('/products/bulk', { rows }),
  },
  customers: {
    list: () => list('/customers'),
    get: (id) => get(`/customers/${id}`),
    create: (doc) => post('/customers', doc),
    update: (id, p) => patch(`/customers/${id}`, p),
    remove: (id) => del(`/customers/${id}`),
    addNote: (id, text, at) => post(`/customers/${id}/notes`, { text, at }),
    bulkNote: (ids, text) => post('/customers/notes', { ids, text }),
  },
  orders: {
    list: () => list('/orders'),
    get: (id) => get(`/orders/${id}`),
    create: (doc) => post('/orders', doc),
    update: (id, p) => patch(`/orders/${id}`, p),
    generateInvoice: (id) => post(`/orders/${id}/invoice`),
    confirmPayment: (id) => post(`/orders/${id}/confirm-payment`),
    // Queries Razorpay for payment attempts against this order. Returns one of:
    //   { outcome: 'confirmed', order, razorpay } — captured payment found (or
    //     an authorized one just captured); order is now Paid + Label generated.
    //   { outcome: 'pending',  razorpay } — no successful payment yet.
    //   { outcome: 'failed',   razorpay } — only failed attempts exist.
    //   { outcome: 'already-confirmed', order } — order moved on before we checked.
    razorpayCheck: (id) => post(`/orders/${id}/razorpay-check`),
    setPaymentStatus: (id, status, ref) => post(`/orders/${id}/payment-status`, { status, ref }),
    cancel: (id) => post(`/orders/${id}/cancel`),
    ship: (id) => post(`/orders/${id}/ship`),
    markDelivered: (id, at) => post(`/orders/${id}/delivered`, at ? { at } : {}),
    ndr: (id, body) => post(`/orders/${id}/ndr`, body),
    refund: (id, amount) => post(`/orders/${id}/refund`, { amount }),
    // SHIP-02: admin-callable push + test. `shiprocketPush` awaits the
    // push and returns the refreshed order so the drawer can rerender;
    // `shiprocketTest` just verifies credentials work.
    shiprocketPush: (id) => post(`/orders/${id}/shiprocket-push`),
    shiprocketTest: () => post('/orders/shiprocket/test-connection'),
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
    remove: (name) => del(`/pages/${encodeURIComponent(name)}`),
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
    // Cleanup: hard-removes pieces whose product or variant no longer exists,
    // plus their Movement audit rows. Default dry-run returns counts without
    // deleting; pass { dryRun: false } to actually wipe.
    cleanupOrphans: ({ dryRun = true } = {}) =>
      post(`/pieces/admin/cleanup-orphans?dryRun=${dryRun ? '1' : '0'}`),
    reserveOrder: (oid) => post(`/pieces/order/${encodeURIComponent(oid)}/reserve`),
    releaseOrder: (oid, why) => post(`/pieces/order/${encodeURIComponent(oid)}/release`, { why }),
    shipOrder: (oid, codes) => post(`/pieces/order/${encodeURIComponent(oid)}/ship`, { codes }),
  },
  movements: {
    // Uses the shared `list()` which now parallelises page fetches and
    // respects the server-side PAGE_MAX cap. The old `limit=2000` override
    // was clamped by the server anyway — dropping it keeps one source of
    // truth for page size.
    list: () => list('/movements'),
  },
};

// Fire-and-forget helper: run an API call in the background and toast on failure.
// Pass a `toast` function in because importing from actions.js would be circular.
export function sync(apiCall, label, toastFn) {
  Promise.resolve()
    .then(() => apiCall())
    .catch((err) => toastFn?.(`Failed to ${label || 'save'}: ${err.message}`));
}
