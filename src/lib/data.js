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

/* ---------- Bootstrap: fetch everything, then populate ---------- */
//
// PERF: `movements` (stock audit trail) deliberately excluded — the
// collection grows unbounded (37K+ rows in this install, ~19 serial 2K-page
// requests at ~37 MB). Only the "Stock movements" tab and the piece-history
// section of the piece drawer read it, so we lazy-load via
// ensureMovementsLoaded() the first time either entry point opens. See
// actions.js `bcTab` and drawers.js `pieceDrawer`.
export async function bootstrap() {
  const [
    cats, prods, custs, ords, rets, ship, cpns, revs, jrnl, pgs, scns, feat, sett, occs, pricesList, pcs, slides, banners,
  ] = await Promise.all([
    api.categories.list(), api.products.list(), api.customers.list(),
    api.orders.list(), api.returns.list(), api.shipping.list(),
    api.coupons.list(), api.reviews.list(), api.journal.list(),
    api.pages.list(), api.scenes.list(), api.featured.get(), api.settings.get(),
    api.occasions.list().catch(() => []),
    api.priceRanges.list().catch(() => []),
    api.pieces.list().catch(() => []),
    api.heroSlides.list().catch(() => []),
    api.homeBanners.list().catch(() => []),
  ]);

  refill(categories, cats.map(norm));
  refill(products, prods.map(norm));
  refill(customers, custs.map((c) => ({ ...norm(c) })));
  refill(orders, ords.map(norm));
  refill(returns, rets.map(norm));
  refill(shipLog, ship.map(norm));
  refill(coupons, cpns.map((c) => ({ ...norm(c), code: c._id })));
  refill(reviews, revs.map(norm));
  refill(journal, jrnl.map(norm));
  refill(PAGES_CMS, pgs.map((p) => ({ ...p, banners: Array.isArray(p.banners) && p.banners.length ? p.banners : (p.banner ? [p.banner] : []) })));
  refill(SCENES, scns);
  refill(OCCASIONS_FULL, (occs || []).map((o) => ({ name: o.name || o._id, parent: o.parent || null, order: o.order ?? 0, image: o.image || '' })));
  if (occs?.length) refill(OCCASIONS, occs.map((o) => o.name || o._id));
  refill(PRICE_RANGES, (pricesList || []).map(norm));
  refill(HERO_SLIDES, (slides || []).map(norm));
  refill(HOME_BANNERS, (banners || []).map(norm));
  refill(pieces, (pcs || []).map((u) => ({ ...norm(u), code: u._id })));
  // moves intentionally left empty — populated lazily by ensureMovementsLoaded().

  setFeatured(Array.isArray(feat?.ids) ? feat.ids : []);

  if (sett.store) Object.assign(SETTINGS.store, sett.store);
  if (sett.pay)   Object.assign(SETTINGS.pay, sett.pay);
  if (sett.ship)  Object.assign(SETTINGS.ship, sett.ship);
  if (sett.gst)   Object.assign(SETTINGS.gst, sett.gst);
  if (sett.account) Object.assign(SETTINGS.account, sett.account);
  if (sett.crm)    Object.assign(CRM, sett.crm);
  if (sett.policy) Object.assign(POLICY, sett.policy);

  rebuildIndexes();
  computeCRM();
  buildInsights();
}

/* Reload a single collection after a write; used after bulk ops where
   the server is the source of truth. */
export async function refresh(resource) {
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
