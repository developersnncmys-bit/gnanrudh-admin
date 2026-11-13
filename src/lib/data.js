// In-memory data stores that pages/drawers read from.
// Hydrated at app start via `bootstrap()` (fetches from the Express backend)
// and kept in sync by action handlers that mutate these arrays locally
// while firing API calls in the background.

import { api } from './api.js';
import { build as buildInsights } from './insights.js';

/* ---------- Static config (not from API) ---------- */
export const STORE_STATE = 'Karnataka';
export const CHECK_ACTS = ['toggleCoupon', 'toggleCat'];
export const COLORS = [['Peacock blue', '#1f5f7a'], ['Mango yellow', '#e0a526'], ['Rani pink', '#c2185b'], ['Bottle green', '#1e5c3a'], ['Maroon', '#6d1b2c'], ['Mustard', '#c9932b'], ['Wine', '#5a1f33'], ['Ivory', '#ece2cc'], ['Lotus pink', '#e8a3b5'], ['Parrot green', '#6aa84f'], ['Royal blue', '#2c4fa3'], ['Black', '#26232a'], ['Onion pink', '#d9a5a0'], ['Teal', '#1d7473'], ['Lavender', '#a693c9']];
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

/* ---------- Analytics: still client-generated (not part of the backend) ---------- */
const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (a, b, r) => a + Math.floor(r() * (b - a + 1));
export const analytics = (() => {
  const r = rng(77);
  return {
    live: between(14, 46, r), avgSession: `${between(3, 6, r)} min ${between(5, 55, r)} s`, pagesPerSession: (3 + r() * 3).toFixed(1),
    funnel: [['Home', 18420], ['Shop or category', 11980], ['Product page', 8650], ['Added to cart', 1490], ['Checkout started', 820], ['Paid', 512]],
    sources: [['Instagram', 34], ['Google', 29], ['Direct', 18], ['WhatsApp', 14], ['Referral', 5]],
    carts: { count: 978, value: 21480000, top: [] },
    cohorts: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m, i) => ({ m, size: between(80, 160, r), ret: Array.from({ length: 5 - i }, (_, k) => (k === 0 ? 100 : Math.max(4, Math.round(26 - k * 4 + r() * 6)))) })),
  };
})();

/* ---------- Helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (v) => (typeof v === 'string' && v.length === 10 ? new Date(`${v}T00:00:00`) : new Date(v));
const TODAY = toDate(iso(new Date()));
const daysFrom = (v) => Math.round((toDate(iso(toDate(v))) - TODAY) / 864e5);

export const stockOf = (p) => p.variants.reduce((a, v) => a + v.stock, 0);
export const paid = (o) => !['Cancelled', 'Payment pending'].includes(o.status) && o.payment.status !== 'Refunded';
export const inDays = (o, from, to) => { const d = daysFrom(o.placed); return d <= -from && d > -to; };

export const queue = () => ({
  pending: orders.filter((o) => o.status === 'Payment pending').length,
  ndr: orders.filter((o) => o.status === 'Delivery failed').length,
  retReview: returns.filter((r) => r.status === 'Requested').length,
  retRefund: returns.filter((r) => r.status === 'Received').length,
  reviews: reviews.filter((r) => r.status === 'Pending').length,
  drafts: products.filter((p) => p.status === 'Draft').length,
  webhook: shipLog.filter((s) => s.webhook !== 'Received').length,
  oos: products.filter((p) => p.status === 'Active' && p.variants.some((v) => v.stock === 0)).length,
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
  ['Catalogue', [['products', 'Products', 'products'], ['categories', 'Categories', 'category'], ['occasions', 'Occasions', 'marketing'], ['priceRanges', 'Shop by price', 'coupon'], ['barcodes', 'Barcodes and stock', 'barcode']]],
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
    const os = (c.orders || []).map((id) => ORD[id]).filter((o) => o && o.status !== 'Cancelled' && o.status !== 'Payment pending').sort((a, b) => (a.placed < b.placed ? 1 : -1));
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
export async function bootstrap() {
  const [
    cats, prods, custs, ords, rets, ship, cpns, revs, jrnl, pgs, scns, feat, sett, occs, pricesList, pcs, mvs,
  ] = await Promise.all([
    api.categories.list(), api.products.list(), api.customers.list(),
    api.orders.list(), api.returns.list(), api.shipping.list(),
    api.coupons.list(), api.reviews.list(), api.journal.list(),
    api.pages.list(), api.scenes.list(), api.featured.get(), api.settings.get(),
    api.occasions.list().catch(() => []),
    api.priceRanges.list().catch(() => []),
    api.pieces.list().catch(() => []),
    api.movements.list().catch(() => []),
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
  refill(PAGES_CMS, pgs);
  refill(SCENES, scns);
  refill(OCCASIONS_FULL, (occs || []).map((o) => ({ name: o.name || o._id, parent: o.parent || null, order: o.order ?? 0, image: o.image || '' })));
  if (occs?.length) refill(OCCASIONS, occs.map((o) => o.name || o._id));
  refill(PRICE_RANGES, (pricesList || []).map(norm));
  refill(pieces, (pcs || []).map((u) => ({ ...norm(u), code: u._id })));
  refill(moves, (mvs || []).map(norm));

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
    pages:      () => api.pages.list().then((d)      => { refill(PAGES_CMS, d); }),
    scenes:     () => api.scenes.list().then((d)     => { refill(SCENES, d); }),
    featured:   () => api.featured.get().then((d)    => { setFeatured(Array.isArray(d?.ids) ? d.ids : []); }),
    occasions:  () => api.occasions.list().then((d)  => { refill(OCCASIONS, d.map((o) => o.name || o._id)); refill(OCCASIONS_FULL, d.map((o) => ({ name: o.name || o._id, parent: o.parent || null, order: o.order ?? 0, image: o.image || '' }))); }),
    priceRanges:() => api.priceRanges.list().then((d) => { refill(PRICE_RANGES, d.map(norm)); }),
    pieces:     () => api.pieces.list().then((d)     => { refill(pieces, d.map((u) => ({ ...norm(u), code: u._id }))); rebuildIndexes(); }),
    movements:  () => api.movements.list().then((d)  => { refill(moves, d.map(norm)); }),
  };
  return map[resource]?.();
}
