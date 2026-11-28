// In-memory data stores that pages/drawers read from.
// Hydrated at app start via `bootstrap()` (fetches from the Express backend)
// and kept in sync by action handlers that mutate these arrays locally
// while firing API calls in the background.

import { api } from './api.js';
import { build as buildInsights } from './insights.js';

/* ---------- Static config (not from API) ---------- */
export const STORE_STATE = 'Karnataka';
export const CHECK_ACTS = ['toggleCoupon', 'toggleCat'];
// Canonical colour list. Mirrors backend/src/colours.js so the bulk-upload
// dropdown admins see is exactly what the backend hex resolver understands —
// no more "picked Mango yellow in the dropdown, got beige on the storefront"
// surprises. Format stays [name, hex] for every existing consumer.
export const COLORS = [
  // Reds
  ['Red',       '#DC2626'],
  ['Maroon',    '#7E1D1D'],
  ['Wine',      '#4A0815'],
  // Pinks
  ['Pink',      '#DB2777'],
  ['Magenta',   '#A21CAF'],
  // Oranges / rust
  ['Orange',    '#F97316'],
  ['Rust',      '#C2410C'],
  // Yellows / golds
  ['Yellow',    '#EAB308'],
  ['Mustard',   '#A16207'],
  ['Gold',      '#DAA520'],
  // Neutrals
  ['Cream',     '#FEF3C7'],
  ['Ivory',     '#F2E9D8'],
  ['Beige',     '#D6BD8C'],
  ['White',     '#FFFFFF'],
  // Greens
  ['Mint',      '#34D399'],
  ['Green',     '#16A34A'],
  ['Olive',     '#65A30D'],
  ['Forest',    '#166534'],
  // Blue-greens
  ['Teal',      '#0D9488'],
  ['Peacock',   '#0E7490'],
  // Blues
  ['Sky Blue',  '#0EA5E9'],
  ['Blue',      '#2563EB'],
  ['Navy',      '#1E40AF'],
  ['Midnight',  '#1E1B4B'],
  // Purples
  ['Lavender',  '#C4B5FD'],
  ['Purple',    '#9333EA'],
  // Browns / blacks / greys
  ['Brown',     '#92400E'],
  ['Grey',      '#6B7280'],
  ['Black',     '#000000'],
];
export const BORDERS = ['Temple border', 'Korvai contrast', 'Plain zari', 'Thread border', 'No border'];
// Hydrated from /api/occasions on bootstrap. Kept as a plain string array
// so every existing dropdown/filter that reads OCCASIONS keeps working.
// Includes BOTH top-level and sub-occasion names (flattened).
export const OCCASIONS = ['Wedding', 'Festival', 'Temple', 'Office', 'Party'];
// Rich form of the same data: [{ name, parent, order }, ...] for the Occasions page.
export const OCCASIONS_FULL = [];

// Hydrated from /api/price-ranges on bootstrap. Each entry: { _id, label, min, max, order, visible }.
// max === null means "and above".
export const PRICE_RANGES = [];
// Hydrated from /api/hero-slides on bootstrap. One row per storefront homepage
// hero carousel slide. See models/HeroSlide.js for the full field list.
export const HERO_SLIDES = [];
// Hydrated from /api/home-banners on bootstrap. Two fixed rows keyed by
// `slot` ('explore' and 'bridal') — the two promotional banner strips on
// the storefront homepage.
export const HOME_BANNERS = [];
export const SIZES = ['32', '34', '36', '38', '40'];
export const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'Xpressbees'];
export const M_FIELDS = [['bust', 'Bust'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['armhole', 'Armhole'], ['length', 'Blouse length'], ['neckF', 'Neck depth, front'], ['neckB', 'Neck depth, back']];
export const SEG_TONE = { VIP: 'zari', Repeat: 'ok', New: 'info', Dormant: 'neutral', 'No orders': 'neutral' };
export const STITCH_STAGES = [];

/* ---------- Collections (populated by bootstrap) ---------- */
export const categories = [];
export const products = [];
export const customers = [];
export const orders = [];
export const returns = [];
export const shipLog = [];
export const coupons = [];
export const reviews = [];
export const journal = [];
export const jobs = [];
export const SCENES = [];
export const PAGES_CMS = [];
export const pieces = [];
export const moves = [];
// Team (admin users). Lazy-loaded the first time Settings → Team is opened
// via ensureTeamLoaded(). Kept out of bootstrap because 99% of admin
// sessions never visit the tab.
export const team = [];

/* Lookup maps */
export const CAT = {};
export const PROD = {};
export const CUST = {};
export const ORD = {};
export const PIECE = {};

export const PIECE_TONE = { 'In stock': 'ok', Reserved: 'warn', Packed: 'info', Shipped: 'neutral', Returned: 'pri', 'Written off': 'bad' };

/* Singletons mutated in place so existing imports keep working */
export const SETTINGS = {
  store: { name: 'House of GnanRudh', site: '', phone: '', email: '', address: '' },
  pay: { methods: {}, cod: true, codCap: 0, codPins: 0, codFile: '' },
  ship: { packaging: 0, freeAbove: 0 },
  gst: { gstin: '', inv: '', cn: '' },
  account: { email: '', pwChanged: '', devices: [] },
};
export const CRM = { vip: 150000, dormantDays: 180, repeatOrders: 2 };
export const POLICY = { window: 7, excludeStitched: true, excludeFalls: true, excludeCustom: true, reversePaidBy: 'Store', reverseFee: 0 };

export let featured = [];
export const setFeatured = (next) => { featured = next; };

/* Local counters for ad-hoc client-side IDs */
export let invSeq = 1, cnSeq = 1;
export const bumpInv = () => invSeq++;
export const bumpCn = () => cnSeq++;

// DATA-01/02: the simulated analytics object is gone. Every surface that used to
// show "visitors on the site now", funnel / sources / cohorts / abandoned carts
// now renders an empty state wired to `analytics.connected === false`.
// When a real provider lands (GA4 / PostHog / Clarity), this object is filled
// from the backend `/stats/analytics` endpoint and `connected` flips to true.
export const analytics = {
  connected: false,
  live: null,
  avgSession: null,
  pagesPerSession: null,
  funnel: [],
  sources: [],
  carts: { count: 0, value: 0, top: [] },
  cohorts: [],
};

/* ---------- Helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (v) => (typeof v === 'string' && v.length === 10 ? new Date(`${v}T00:00:00`) : new Date(v));
const TODAY = toDate(iso(new Date()));
const daysFrom = (v) => Math.round((toDate(iso(toDate(v))) - TODAY) / 864e5);

// Live in-stock count for a product, computed from the barcoded `pieces`
// collection — matches what the Inventory page shows. The `variant.stock`
// field on the product doc is a stale denormalisation (never rewritten when
// pieces are received/shipped) and must not be read directly. Defined below
// pieces/piecesOf so the arrays are already populated.
export const stockOf = (p) =>
  p.variants.reduce((a, v) => a + piecesOf(v.id, 'In stock').length, 0);
// Payments received: money actually in the account. Prepaid orders in payment.status 'Paid'
// and COD orders where cash was collected on delivery. Excludes COD pending, COD not collected
// (RTO), Pending Razorpay webhooks and Refunded.
export const paid = (o) => ['Paid', 'COD collected'].includes(o.payment?.status);
// COD cash sitting with the courier that we expect to receive on delivery.
export const codToCollect = (o) => o.payment?.status === 'COD pending';
export const inDays = (o, from, to) => { const d = daysFrom(o.placed); return d <= -from && d > -to; };

export const queue = () => ({
  pending: orders.filter((o) => o.status === 'Payment pending').length,
  ndr: orders.filter((o) => o.status === 'Delivery failed').length,
  retReview: returns.filter((r) => r.status === 'Requested').length,
  retRefund: returns.filter((r) => r.status === 'Received').length,
  reviews: reviews.filter((r) => r.status === 'Pending').length,
  drafts: products.filter((p) => p.status === 'Draft').length,
  webhook: shipLog.filter((s) => s.webhook !== 'Received').length,
  // Variant is considered OOS when zero barcoded pieces are In stock. The
  // stale v.stock field would wrongly flag everything as OOS.
  oos: products.filter((p) => p.status === 'Active' && p.variants.some((v) => piecesOf(v.id, 'In stock').length === 0)).length,
  ready: orders.filter((o) => o.status === 'Label generated').length,
});

export const notifications = [
  ['Failed deliveries need an action within 24 hours', 'orders', 15],
  ['Reviews are waiting for approval', 'reviews', 90],
  ['A Shiprocket update failed to arrive and is retrying', 'shipping', 150],
];

export const NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'dash'], ['analytics', 'Analytics', 'analytics'], ['insights', 'Product insights', 'insights']]],
  ['Sales', [['orders', 'Orders', 'orders', (q) => q.pending + q.ndr, true], ['packing', 'Packing', 'pack', (q) => q.ready], ['returns', 'Returns', 'returns', (q) => q.retReview + q.retRefund], ['shipping', 'Shipping', 'ship', (q) => q.webhook]]],
  ['Catalogue', [['products', 'Products', 'products'], ['categories', 'Categories', 'category'], ['occasions', 'Occasions', 'marketing'], ['priceRanges', 'Shop by price', 'coupon'], ['inventory', 'Inventory', 'inventory', (q) => q.oos, true], ['barcodes', 'Barcodes and stock', 'barcode']]],
  ['Customers', [['customers', 'Customers', 'customers'], ['reviews', 'Reviews', 'reviews', (q) => q.reviews]]],
  ['Content and offers', [['coupons', 'Coupons', 'coupon'], ['journal', 'Journal', 'journal'], ['storefront', 'Storefront pages', 'page']]],
  ['Admin', [['settings', 'Settings', 'settings']]],
];

/* Normalise Mongo docs: expose `_id` as `id` so page/drawer templates
   (which already reference .id) keep working with no changes. */
const norm = (d) => (d && d._id !== undefined ? { ...d, id: d._id } : d);

/* ---------- Index rebuilds (call after any bulk list refresh) ---------- */
export function rebuildIndexes() {
  Object.keys(CAT).forEach((k) => delete CAT[k]); categories.forEach((c) => { CAT[c.id] = c; });
  Object.keys(PROD).forEach((k) => delete PROD[k]); products.forEach((p) => { PROD[p.id] = p; });
  Object.keys(CUST).forEach((k) => delete CUST[k]); customers.forEach((c) => { CUST[c.id] = c; });
  Object.keys(ORD).forEach((k) => delete ORD[k]); orders.forEach((o) => { ORD[o.id] = o; });
  Object.keys(PIECE).forEach((k) => delete PIECE[k]); pieces.forEach((u) => { PIECE[u.id || u.code] = u; });
}

/* Find a variant anywhere in the catalogue by its vid. */
export function varRef(vid) {
  for (const p of products) {
    const v = p.variants.find((x) => x.id === vid);
    if (v) return { p, v };
  }
  return null;
}

/* Find a variant by SKU (case-insensitive). */
export function bySku(code) {
  const needle = String(code || '').toUpperCase();
  for (const p of products) {
    const v = p.variants.find((x) => x.sku && x.sku.toUpperCase() === needle);
    if (v) return { p, v };
  }
  return null;
}

export const piecesOf = (vid, status) => pieces.filter((u) => u.vid === vid && (!status || u.status === status));

/* Replace array contents in place so existing imports still see live data */
const refill = (arr, items) => { arr.length = 0; arr.push(...items); };

/* Customer rollups that used to be done server-side are recomputed here
   after settings/CRM thresholds change. */
export function computeCRM() {
  customers.forEach((c) => {
    // LTV / order count / last order use the same "money received" rule as the dashboard:
    // only orders with payment.status Paid or COD collected count. See `paid` above (LOGIC-01).
    const os = (c.orders || []).map((id) => ORD[id]).filter((o) => o && paid(o)).sort((a, b) => (a.placed < b.placed ? 1 : -1));
    c.ltv = os.reduce((a, o) => a + o.total, 0);
    c.orderCount = os.length;
    c.lastOrder = os[0]?.placed || null;
    c.weaves = [...new Set(os.flatMap((o) => o.items.map((it) => PROD[it.pid]?.weave).filter(Boolean)))];
    c.occasions = [...new Set(os.flatMap((o) => o.items.map((it) => PROD[it.pid]?.occasion).filter(Boolean)))];
    const dormant = c.lastOrder && daysFrom(c.lastOrder) < -CRM.dormantDays;
    c.segment = !c.orderCount ? 'No orders' : dormant ? 'Dormant' : c.ltv >= CRM.vip ? 'VIP' : c.orderCount >= CRM.repeatOrders ? 'Repeat' : 'New';
  });
}

/* ---------- Bootstrap: essentials only, then lazy-load the rest --------- */
//
// PERF: the earlier bootstrap fired 18 list endpoints in parallel the
// instant the user signed in. Each endpoint that returned over 500 rows
// then fanned out its own parallel page fetches. The aggregate burst
// pushed the admin's cold start past Vercel's 60 s function budget and
// produced the 2-minute dashboard + FUNCTION_INVOCATION_TIMEOUT 504s
// even though single endpoints responded in 100-300 ms.
//
// Shape now:
//   1. `bootstrap()` fetches only the small singletons/metadata the
//      shell renders before any page body — settings (store name in
//      document.title), occasions, priceRanges, heroSlides, homeBanners,
//      scenes, pages, featured, categories. Fast, small, cheap.
//   2. Every heavy list has an `ensureXxxLoaded()` helper with the same
//      in-flight promise dedupe pattern as ensureMovementsLoaded. The
//      per-route effect in App.jsx calls the ones its page needs.
//   3. Subsequent navigations reuse the already-populated arrays. The
//      refresh('slice') map stays authoritative after mutations.
export async function bootstrap() {
  const skip403 = (fallback) => (err) => {
    if (err?.status === 403) return fallback;
    throw err;
  };
  const started = performance?.now ? performance.now() : Date.now();
  const [sett, occs, pricesList, slides, banners, scns, pgs, feat, cats] = await Promise.all([
    api.settings.get().catch(skip403({})),
    api.occasions.list().catch(() => []),
    api.priceRanges.list().catch(() => []),
    api.heroSlides.list().catch(() => []),
    api.homeBanners.list().catch(() => []),
    api.scenes.list().catch(skip403([])),
    api.pages.list().catch(skip403([])),
    api.featured.get().catch(skip403({ ids: [] })),
    api.categories.list().catch(skip403([])),
  ]);
  refill(categories, cats.map(norm));
  refill(PAGES_CMS, pgs.map((p) => ({ ...p, banners: Array.isArray(p.banners) && p.banners.length ? p.banners : (p.banner ? [p.banner] : []) })));
  refill(SCENES, scns);
  refill(OCCASIONS_FULL, (occs || []).map((o) => ({ name: o.name || o._id, parent: o.parent || null, order: o.order ?? 0, image: o.image || '' })));
  if (occs?.length) refill(OCCASIONS, occs.map((o) => o.name || o._id));
  refill(PRICE_RANGES, (pricesList || []).map(norm));
  refill(HERO_SLIDES, (slides || []).map(norm));
  refill(HOME_BANNERS, (banners || []).map(norm));
  setFeatured(Array.isArray(feat?.ids) ? feat.ids : []);
  if (sett.store) Object.assign(SETTINGS.store, sett.store);
  if (sett.pay)   Object.assign(SETTINGS.pay, sett.pay);
  if (sett.ship)  Object.assign(SETTINGS.ship, sett.ship);
  if (sett.gst)   Object.assign(SETTINGS.gst, sett.gst);
  if (sett.account) Object.assign(SETTINGS.account, sett.account);
  if (sett.crm)    Object.assign(CRM, sett.crm);
  if (sett.policy) Object.assign(POLICY, sett.policy);
  rebuildIndexes();
  const elapsed = (performance?.now ? performance.now() : Date.now()) - started;
  console.log(`[bootstrap] essentials loaded in ${Math.round(elapsed)}ms`);
}

// Generic lazy-load helper used by every heavy slice below.
//  - First caller fires the network request; concurrent callers share the
//    SAME in-flight promise so a route-change + a drawer + a probe can't
//    each kick off their own fetch.
//  - After the first load, repeat calls within STALE_MS resolve immediately
//    with the already-populated array (fast nav between pages). If the
//    slice is older than STALE_MS, ensure() awaits a background refresh
//    so the admin sees new rows (orders placed via the storefront, etc.)
//    without staying on a stale screen indefinitely.
//  - On failure the cached promise clears so the next call can retry.
const STALE_MS = 30_000;
function makeEnsurer(name, fetchFn, applyFn) {
  let promise = null;
  let loadedAt = 0;
  const ensure = () => {
    const now = Date.now();
    if (loadedAt && now - loadedAt < STALE_MS) return Promise.resolve();
    if (promise) return promise;
    const started = performance?.now ? performance.now() : Date.now();
    promise = fetchFn()
      .then((d) => {
        applyFn(d);
        loadedAt = Date.now();
        const elapsed = (performance?.now ? performance.now() : Date.now()) - started;
        console.log(`[ensure:${name}] loaded in ${Math.round(elapsed)}ms`);
      })
      .catch((err) => {
        if (err?.status === 403) { loadedAt = Date.now(); return; }
        console.warn(`[ensure:${name}] failed:`, err?.message || err);
      })
      .finally(() => { promise = null; });
    return promise;
  };
  const invalidate = () => { loadedAt = 0; promise = null; };
  return { ensure, invalidate };
}

const _orders = makeEnsurer('orders', () => api.orders.list(), (d) => { refill(orders, d.map(norm)); rebuildIndexes(); });
const _products = makeEnsurer('products', () => api.products.list(), (d) => { refill(products, d.map(norm)); rebuildIndexes(); });
const _customers = makeEnsurer('customers', () => api.customers.list(), (d) => { refill(customers, d.map((c) => ({ ...norm(c) }))); rebuildIndexes(); computeCRM(); buildInsights(); });
const _pieces = makeEnsurer('pieces', () => api.pieces.list(), (d) => { refill(pieces, d.map((u) => ({ ...norm(u), code: u._id }))); rebuildIndexes(); });
const _returns = makeEnsurer('returns', () => api.returns.list(), (d) => { refill(returns, d.map(norm)); });
const _shipping = makeEnsurer('shipping', () => api.shipping.list(), (d) => { refill(shipLog, d.map(norm)); });
const _reviews = makeEnsurer('reviews', () => api.reviews.list(), (d) => { refill(reviews, d.map(norm)); });
const _coupons = makeEnsurer('coupons', () => api.coupons.list(), (d) => { refill(coupons, d.map((c) => ({ ...norm(c), code: c._id }))); });
const _journal = makeEnsurer('journal', () => api.journal.list(), (d) => { refill(journal, d.map(norm)); });

export const ensureOrdersLoaded    = _orders.ensure;
export const ensureProductsLoaded  = _products.ensure;
export const ensureCustomersLoaded = _customers.ensure;
export const ensurePiecesLoaded    = _pieces.ensure;
export const ensureReturnsLoaded   = _returns.ensure;
export const ensureShippingLoaded  = _shipping.ensure;
export const ensureReviewsLoaded   = _reviews.ensure;
export const ensureCouponsLoaded   = _coupons.ensure;
export const ensureJournalLoaded   = _journal.ensure;

// Page -> slices required for the arrays its template reads. Centralised
// so App.jsx doesn't need to know what each page consumes. The dashboard
// needs most things (queue + latest-orders panel) but not coupons /
// journal / scenes which never appear in the shell.
const SLICES_BY_PAGE = {
  dashboard: ['orders', 'customers', 'pieces', 'products', 'returns', 'reviews', 'shipping'],
  orders:    ['orders', 'customers', 'pieces', 'products'],
  packing:   ['orders', 'pieces', 'products'],
  shipping:  ['shipping', 'orders', 'customers'],
  returns:   ['returns', 'orders', 'customers'],
  products:  ['products', 'pieces'],
  inventory: ['products', 'pieces'],
  barcodes:  ['products', 'pieces'],
  customers: ['customers', 'orders'],
  reviews:   ['reviews', 'products', 'customers'],
  coupons:   ['coupons'],
  journal:   ['journal'],
  analytics: ['orders', 'customers', 'products'],
  insights:  ['orders', 'products', 'customers'],
  productAnalytics: ['orders', 'products'],
  storefront: [],
  categories: [],
  occasions: [],
  priceRanges: [],
  scenes: [],
  settings: [],
};
const ENSURERS = {
  orders: ensureOrdersLoaded,
  products: ensureProductsLoaded,
  customers: ensureCustomersLoaded,
  pieces: ensurePiecesLoaded,
  returns: ensureReturnsLoaded,
  shipping: ensureShippingLoaded,
  reviews: ensureReviewsLoaded,
  coupons: ensureCouponsLoaded,
  journal: ensureJournalLoaded,
};
export function ensureSlicesForPage(pageKey) {
  const slices = SLICES_BY_PAGE[pageKey];
  if (!slices || !slices.length) return Promise.resolve();
  return Promise.all(slices.map((s) => ENSURERS[s]?.() ?? Promise.resolve()));
}

/* Reload a single collection after a write; used after bulk ops where
   the server is the source of truth. Also clears the matching ensurer's
   "already loaded" flag so the next ensureXxxLoaded() will re-fetch. */
const ENSURER_HANDLES = {
  orders: _orders, products: _products, customers: _customers, pieces: _pieces,
  returns: _returns, shipping: _shipping, reviews: _reviews, coupons: _coupons,
  journal: _journal,
};
export async function refresh(resource) {
  // Reset the lazy-loader's "loaded" flag so the fresh data from this
  // explicit refresh becomes the new baseline (and a later ensure() is
  // a no-op). Skipped for slices that have no ensurer (metadata).
  ENSURER_HANDLES[resource]?.invalidate();
  const map = {
    categories: () => api.categories.list().then((d) => { refill(categories, d.map(norm)); rebuildIndexes(); }),
    products:   () => api.products.list().then((d)   => { refill(products, d.map(norm));   rebuildIndexes(); }),
    customers:  () => api.customers.list().then((d)  => { refill(customers, d.map(norm));  rebuildIndexes(); computeCRM(); }),
    orders:     () => api.orders.list().then((d)     => { refill(orders, d.map(norm));     rebuildIndexes(); }),
    returns:    () => api.returns.list().then((d)    => { refill(returns, d.map(norm)); }),
    shipping:   () => api.shipping.list().then((d)   => { refill(shipLog, d.map(norm)); }),
    coupons:    () => api.coupons.list().then((d)    => { refill(coupons, d.map((c) => ({ ...norm(c), code: c._id }))); }),
    reviews:    () => api.reviews.list().then((d)    => { refill(reviews, d.map(norm)); }),
    journal:    () => api.journal.list().then((d)    => { refill(journal, d.map(norm)); }),
    pages:      () => api.pages.list().then((d)      => { refill(PAGES_CMS, d.map((p) => ({ ...p, banners: Array.isArray(p.banners) && p.banners.length ? p.banners : (p.banner ? [p.banner] : []) }))); }),
    scenes:     () => api.scenes.list().then((d)     => { refill(SCENES, d); }),
    featured:   () => api.featured.get().then((d)    => { setFeatured(Array.isArray(d?.ids) ? d.ids : []); }),
    occasions:  () => api.occasions.list().then((d)  => { refill(OCCASIONS, d.map((o) => o.name || o._id)); refill(OCCASIONS_FULL, d.map((o) => ({ name: o.name || o._id, parent: o.parent || null, order: o.order ?? 0, image: o.image || '' }))); }),
    priceRanges:() => api.priceRanges.list().then((d) => { refill(PRICE_RANGES, d.map(norm)); }),
    heroSlides: () => api.heroSlides.list().then((d) => { refill(HERO_SLIDES, d.map(norm)); }),
    homeBanners: () => api.homeBanners.list().then((d) => { refill(HOME_BANNERS, d.map(norm)); }),
    pieces:     () => api.pieces.list().then((d)     => { refill(pieces, d.map((u) => ({ ...norm(u), code: u._id }))); rebuildIndexes(); }),
    movements:  () => api.movements.list().then((d)  => { refill(moves, d.map(norm)); }),
  };
  return map[resource]?.();
}

// Lazy loader for the movements collection. Idempotent — the first caller
// fires the network request, every subsequent caller (across the whole
// session) awaits the SAME in-flight promise so a flurry of UI events
// (tab click, piece drawer open) only produce one fetch. Resolves to the
// moves array for convenience; most callers ignore the return value and
// just read `moves` after awaiting.
let movementsLoadPromise = null;
export function ensureMovementsLoaded() {
  if (moves.length) return Promise.resolve(moves);
  if (movementsLoadPromise) return movementsLoadPromise;
  movementsLoadPromise = api.movements.list()
    .then((d) => {
      refill(moves, (d || []).map(norm));
      return moves;
    })
    .catch((err) => {
      // On failure, null the promise so a retry can re-attempt. Don't
      // throw at the UI — the caller can decide to toast or silently fall
      // back to an empty history.
      console.warn('[data] movements lazy-load failed:', err?.message || err);
      movementsLoadPromise = null;
      return moves;
    });
  return movementsLoadPromise;
}

// Lazy loader for the team (admin users) roster. Same pattern as
// ensureMovementsLoaded — idempotent, in-flight promise dedupes concurrent
// callers. Force-refreshes after any mutation via refreshTeam() so the
// Settings → Team table always reflects the latest DB state.
let teamLoadPromise = null;
export function ensureTeamLoaded() {
  if (team.length) return Promise.resolve(team);
  if (teamLoadPromise) return teamLoadPromise;
  teamLoadPromise = api.team.list()
    .then((d) => {
      refill(team, (d || []).map(norm));
      return team;
    })
    .catch((err) => {
      console.warn('[data] team lazy-load failed:', err?.message || err);
      teamLoadPromise = null;
      return team;
    });
  return teamLoadPromise;
}
export async function refreshTeam() {
  teamLoadPromise = null;
  refill(team, []);
  return ensureTeamLoaded();
}

// SEC-06: live admin login sessions for the signed-in user. Lazy-loaded
// when Settings → Admin login is opened so the list reflects real
// Session docs instead of the placeholder SETTINGS.account.devices.
// `sessionsState.loaded` lets the render distinguish "still fetching"
// (show a spinner) from "loaded but empty" (show the sign-in-again hint)
// — without it an empty array looked identical to the loading state.
export const sessions = [];
export const sessionsState = { loaded: false };
let sessionsLoadPromise = null;
export function ensureSessionsLoaded() {
  if (sessionsState.loaded) return Promise.resolve(sessions);
  if (sessionsLoadPromise) return sessionsLoadPromise;
  sessionsLoadPromise = api.auth.sessions()
    .then((d) => {
      refill(sessions, Array.isArray(d?.items) ? d.items : []);
      sessionsState.loaded = true;
      return sessions;
    })
    .catch((err) => {
      console.warn('[data] sessions lazy-load failed:', err?.message || err);
      sessionsLoadPromise = null;
      return sessions;
    });
  return sessionsLoadPromise;
}
export async function refreshSessions() {
  sessionsLoadPromise = null;
  sessionsState.loaded = false;
  refill(sessions, []);
  return ensureSessionsLoaded();
}

// SEC-05: live role→permission matrix. Lazy-loaded alongside the team roster
// so Settings → Team can render the editable permission table without a
// bootstrap hit for admins who never open the tab.
export const rolePermissions = {
  permissions: null, // { key: description } — the catalogue
  matrix: null,      // { role: [perm, ...] } — current grants
  loaded: false,
};
let rolePermissionsLoadPromise = null;
export function ensureRolePermissionsLoaded() {
  if (rolePermissions.loaded) return Promise.resolve(rolePermissions);
  if (rolePermissionsLoadPromise) return rolePermissionsLoadPromise;
  rolePermissionsLoadPromise = api.team.rolePermissions()
    .then((d) => {
      rolePermissions.permissions = d?.permissions || {};
      rolePermissions.matrix = d?.matrix || {};
      rolePermissions.loaded = true;
      return rolePermissions;
    })
    .catch((err) => {
      console.warn('[data] role-permissions lazy-load failed:', err?.message || err);
      rolePermissionsLoadPromise = null;
      return rolePermissions;
    });
  return rolePermissionsLoadPromise;
}
export async function refreshRolePermissions() {
  rolePermissionsLoadPromise = null;
  rolePermissions.loaded = false;
  return ensureRolePermissionsLoaded();
}
