// Product Insights — ported from house-of-gnanrudh-admin1.html.
// All data is derived from the live products/customers/orders that `data.js` hydrates from the API,
// so build() must run AFTER bootstrap(). It also mutates product.views/carts so Analytics matches.

import { between, iso, addDays, pad, pct, pick, TODAY } from './utils.js';
import {
  categories, CAT, PROD, products, CUST, customers, stockOf, analytics, coupons,
} from './data.js';

/* ---------- Deterministic PRNG, matches the reference file ---------- */
const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const wpick = (items, weights, r) => { let t = r() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < items.length; i++) { t -= weights[i]; if (t <= 0) return items[i]; } return items[items.length - 1]; };
export const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${pad(Math.round(s % 60))} s` : `${Math.round(s)} s`);
export const pc = (v, d = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(d)}%`;
export const ago = (h) => (h < 1 ? 'just now' : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`);
export const sumBy = (xs, k) => xs.reduce((a, x) => a + (typeof k === 'function' ? k(x) : x[k]), 0);

export const CAT_TIME = { silk: [95, 220], cotton: [55, 140], designer: [65, 160], lehenga: [80, 200], blouse: [35, 95], acc: [18, 60] };
export const SRC = ['Instagram', 'Google', 'Direct', 'WhatsApp', 'Referral'];
export const STAGES = ['Cart', 'Checkout, address', 'Checkout, payment', 'Payment failed'];
export const STAGE_TONE = { Cart: 'neutral', 'Checkout, address': 'info', 'Checkout, payment': 'warn', 'Payment failed': 'bad' };
export const AB_REASONS = {
  Cart: ['Left soon after seeing the price', 'Saved for later, kept browsing', 'Compared with another saree'],
  'Checkout, address': ['Shipping charge appeared', 'COD not available at the pincode', 'Delivery date too late for the occasion'],
  'Checkout, payment': ['Coupon did not apply', 'Left at payment options', 'EMI not offered on this amount'],
  'Payment failed': ['UPI request timed out', 'Card declined by the bank', 'Netbanking session expired'],
};
export const REC_TONE = { 'Not contacted': 'warn', 'Reminder sent': 'info', Recovered: 'ok', Expired: 'neutral', 'Not contactable': 'neutral' };
export const CART_EXPIRY_H = 7 * 24;

export const VERDICT = {
  'Best seller': ['ok', 'Converts well and gets seen. Keep it in stock and on the home rail, and watch its days of cover.'],
  'Hidden gem': ['zari', 'Converts well but few people see it. Feature it on the home page, Instagram or a WhatsApp broadcast.'],
  'Carted, not bought': ['warn', 'Shoppers want it but stop before paying. Check the shipping charge, COD at their pincode and payment failures, then send cart reminders.'],
  'Looked at, not carted': ['bad', 'Plenty of views, few carts. Usually price, photos or missing details. Compare it with its aisle in Price acceptance.'],
  'Return risk': ['bad', 'Returns are eating the sales. Read the return reasons; often colour or drape does not match the photos.'],
  'Slow mover': ['neutral', 'Few views and few sales. Refresh the photos, pair it with a blouse or accessory, or mark it down.'],
  Steady: ['neutral', 'Selling in line with its aisle.'],
};

export const BANDS = { silk: [0, 15000, 30000, 60000, 100000], cotton: [0, 3000, 5000, 8000], designer: [0, 8000, 15000, 25000], lehenga: [0, 10000, 25000, 50000], blouse: [0, 2500, 5000], acc: [0, 500, 1500] };

/* Built artefacts */
export const INS = {};
export let insList = [];
export let insPool = [];
export let MED = { views: 0, conv: 0 };
export let LOW_C2B = 0;
export let CAT_MEDIAN = {};
export const abCarts = [];
export const AB = {};
export let priceChanges = [];
export let BEH = null;
export let pairs = [];
export let colourDemand = [];

let built = false;
export const isBuilt = () => built;

export function build() {
  // Reset so subsequent bootstraps (sign-in/out cycles) start clean.
  Object.keys(INS).forEach((k) => delete INS[k]);
  insList = []; insPool = []; abCarts.length = 0;
  Object.keys(AB).forEach((k) => delete AB[k]);
  priceChanges = []; pairs = []; colourDemand = [];

  const IR = rng(991);
  CAT_MEDIAN = Object.fromEntries(categories.map((c) => [c.id, median(products.filter((p) => p.cat === c.id).map((p) => p.price))]));

  /* Per-product roll-up, 30 days */
  products.filter((p) => p.status === 'Active').forEach((p) => {
    const r = IR;
    const priceIdx = CAT_MEDIAN[p.cat] ? p.price / CAT_MEDIAN[p.cat] : 1;
    const appeal = 0.55 + r() * 0.95;
    const priceFactor = Math.min(1.6, Math.max(0.55, Math.pow(20000 / p.price, 0.3)));
    const cartRate = Math.min(11, Math.max(0.6, ((4 * appeal) / Math.pow(priceIdx, 0.6)) * priceFactor + (p.video ? 0.9 : 0) + (p.images - 5) * 0.15)) / 100;
    const views = Math.max(12, Math.round(p.views * 0.2));
    const carts = Math.round(views * cartRate);
    const checkouts = Math.round(carts * Math.max(0.15, 0.3 + r() * 0.3 - Math.max(0, priceIdx - 1.3) * 0.1));
    const units = Math.round(checkouts * (0.5 + r() * 0.3));
    p.views = views; p.carts = carts;
    const [t0, t1] = CAT_TIME[p.cat] || [40, 120];
    const soldOut = p.variants.filter((v) => v.stock === 0);
    const srcW = SRC.map(() => 0.3 + r()); const srcT = sumBy(srcW, (x) => x);
    const oosViews = soldOut.length ? Math.round(views * (0.08 + r() * 0.25)) : 0;
    const shares = p.variants.map((_, i) => (i === 0 ? 0.5 + r() * 0.3 : 0.1 + r() * 0.35)); const shT = sumBy(shares, (x) => x);
    INS[p.id] = {
      id: p.id, views, visitors: Math.round(views * (0.66 + r() * 0.14)), carts, removed: Math.round(carts * (0.05 + r() * 0.15)), checkouts, units, revenue: units * p.price,
      abandoned: carts - units, abandonedValue: (carts - units) * p.price, wish: Math.round(views * (0.01 + r() * 0.05)),
      avgTime: Math.round(t0 + r() * (t1 - t0)), details: between(45, 92, r), reviewsReached: between(12, 55, r),
      swipes: between(40, 92, r), zoom: between(8, 58, r), videoPlays: p.video ? between(14, 48, r) : 0,
      priceIdx, priceBounce: Math.round(Math.min(68, Math.max(6, 14 + (priceIdx - 1) * 26 + r() * 14))), couponShare: between(0, 45, r), mobile: between(62, 84, r),
      returnRate: units ? Math.round(r() * r() * (p.cat === 'designer' ? 30 : p.cat === 'silk' ? 12 : 20)) : 0,
      oosViews, notify: oosViews ? Math.max(1, Math.round(oosViews * (0.04 + r() * 0.14))) : 0,
      sources: SRC.map((s, i) => ({ label: s, value: Math.round((srcW[i] / srcT) * 100) })),
      colours: p.variants.map((v, i) => ({ v, share: shares[i] / shT })),
    };
  });
  insList = Object.values(INS);
  insList.forEach((x) => { x.cartRate = pct(x.carts, x.views); x.cartToBuy = pct(x.units, x.carts); x.conv = pct(x.units, x.views); });
  MED = { views: median(insList.map((x) => x.views)), conv: median(insList.map((x) => x.conv)) };
  const c2b = insList.filter((x) => x.carts >= 8).map((x) => x.cartToBuy).sort((a, b) => a - b);
  LOW_C2B = c2b.length ? c2b[Math.floor(c2b.length * 0.25)] : 0;

  insList.forEach((x) => {
    x.verdict = x.returnRate >= 15 ? 'Return risk'
      : x.carts >= 8 && x.cartToBuy <= LOW_C2B ? 'Carted, not bought'
      : x.views >= MED.views * 1.3 && x.cartRate < 2.5 ? 'Looked at, not carted'
      : x.views < MED.views * 0.7 && x.conv >= MED.conv * 1.4 ? 'Hidden gem'
      : x.conv >= MED.conv * 1.5 && x.views >= MED.views ? 'Best seller'
      : x.views < MED.views * 0.6 && x.conv < MED.conv * 0.6 ? 'Slow mover'
      : 'Steady';
    x.daily = x.units / 30; x.stock = stockOf(PROD[x.id]); x.cover = x.daily ? x.stock / x.daily : Infinity;
  });
  insPool = products.filter((p) => INS[p.id]);
  analytics.carts = { count: sumBy(insList, 'abandoned'), value: sumBy(insList, 'abandonedValue'), top: [...insList].sort((a, b) => b.abandoned - a.abandoned).slice(0, 5).map((x) => [x.id, x.abandoned]) };

  /* Abandoned carts */
  if (insPool.length) {
    for (let i = 0; i < 64; i++) {
      const r = IR;
      const c = r() < 0.6 ? customers[Math.floor(r() * customers.length)] : null;
      const pids = [...new Set(Array.from({ length: r() < 0.72 ? 1 : 2 }, () => pick(insPool, r).id))];
      const stage = wpick(STAGES, [42, 22, 20, 16], r);
      const hrs = 1 + Math.round(Math.pow(r(), 1.7) * (30 * 24 - 1));
      const phone = c ? c.phone : stage !== 'Cart' ? `+91 9${between(10, 99, r)}${between(100, 999, r)} ${between(10000, 99999, r)}` : null;
      const optIn = r() < 0.78;
      const contactable = Boolean(phone) && optIn;
      let status = !contactable ? 'Not contactable' : hrs < 6 ? 'Not contacted' : wpick(['Not contacted', 'Reminder sent', 'Recovered'], [30, 45, 25], r);
      if (status === 'Not contacted' && hrs > CART_EXPIRY_H) status = 'Expired';
      const cart = { id: `AC${3100 + i}`, cid: c?.id || null, phone, pids, stage, reason: pick(AB_REASONS[stage], r), value: sumBy(pids, (id) => PROD[id].price), hrs, device: wpick(['Mobile', 'Desktop', 'Tablet'], [74, 22, 4], r), optIn, contactable, status, coupon: null };
      abCarts.push(cart);
      AB[cart.id] = cart;
    }
    abCarts.sort((a, b) => a.hrs - b.hrs);
  }

  /* Price changes */
  if (insPool.length) {
    priceChanges = Array.from({ length: 6 }, (_, i) => {
      const p = insPool[(i * 13 + 5) % insPool.length]; const x = INS[p.id]; const cut = i % 3 !== 2;
      const from = Math.round((p.price * (cut ? 1.08 + IR() * 0.14 : 0.86 + IR() * 0.06)) / 100) * 100;
      const before = x.cartRate * (cut ? 0.6 + IR() * 0.25 : 1.1 + IR() * 0.35), after = x.cartRate;
      const convB = x.conv * (before / (after || 1)) * (0.9 + IR() * 0.2), convA = x.conv;
      return { pid: p.id, from, to: p.price, at: iso(addDays(TODAY, -between(9, 60, IR))), before, after, rpvB: (convB / 100) * from, rpvA: (convA / 100) * p.price };
    });
  }

  /* Behaviour */
  BEH = ((seed) => {
    const r = rng(seed);
    const tv = sumBy(insList, 'views');
    const w = (k) => (tv ? sumBy(insList, (x) => x[k] * x.views) / tv : 0);
    const vids = insList.filter((x) => PROD[x.id].video); const vv = sumBy(vids, 'views');
    const mobile = w('mobile');
    return {
      tv, avgTime: w('avgTime'), details: w('details'), reviews: w('reviewsReached'), swipes: w('swipes'), zoom: w('zoom'), mobile,
      videoRate: vv ? sumBy(vids, (x) => x.videoPlays * x.views) / vv : 0, convVideo: 3.6 + r(), convNoVideo: 1.4 + r() * 0.4, convZoom: 2.8 + r() * 0.6, convNoZoom: 1.3 + r() * 0.3,
      buckets: [['Under 10 s', 21, 0.1], ['10 to 30 s', 19, 0.4], ['30 s to 1 min', 17, 1.3], ['1 to 2 min', 18, 2.7], ['2 to 5 min', 16, 4.9], ['Over 5 min', 9, 6.2]].map(([label, share, conv]) => ({ label, share: share + (r() - 0.5) * 3, conv: conv * (0.85 + r() * 0.3) })),
      hours: ['12 to 3 am', '3 to 6 am', '6 to 9 am', '9 am to 12', '12 to 3 pm', '3 to 6 pm', '6 to 9 pm', '9 pm to 12'],
      heat: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, di) => ({ d, cells: [0.25, 0.07, 0.3, 0.58, 0.66, 0.72, 1, 0.92].map((h) => Math.round(h * [0.92, 0.88, 0.9, 0.94, 1, 1.12, 1.28][di] * (0.85 + r() * 0.3) * 1000)) })),
      filters: [['Weave', 38], ['Price', 33], ['Colour', 27], ['Occasion', 19], ['Zari', 11], ['Blouse piece', 7]],
      devices: [['Mobile', mobile], ['Desktop', (100 - mobile) * 0.84], ['Tablet', (100 - mobile) * 0.16]],
      searches: [['kanjivaram', 1840, 41, 3.4], ['wedding silk saree', 1210, 58, 2.9], ['banarasi', 960, 22, 2.1], ['cotton saree for office', 610, 36, 1.8], ['pochampally', 212, 0, 0], ['kalamkari', 164, 0, 0], ['maroon kanjivaram under 20000', 118, 3, 4.2], ['bandhani', 96, 0, 0], ['saree with stitched blouse', 88, 12, 5.1], ['half saree', 71, 6, 1.4]].map(([q, n, , conv]) => { const res = searchHits(q); return { q, n, res, conv: res ? conv : 0 }; }),
      paths: [[['Instagram post', 'Product page', 'Cart', 'Paid'], 31], [['Google search', 'Silk Sarees', 'Product page', 'Paid'], 22], [['WhatsApp link', 'Product page', 'Paid'], 17], [['Home', 'Journal article', 'Product page', 'Paid'], 9], [['Wishlist', 'Product page', 'Paid'], 7]],
    };
  })(1213);

  /* Demand signals */
  const A_ = insPool.filter((p) => CAT[p.cat] && CAT[p.cat].saree), B_ = insPool.filter((p) => ['blouse', 'acc'].includes(p.cat));
  pairs = (A_.length && B_.length)
    ? Array.from({ length: 7 }, (_, i) => ({ a: A_[(i * 7 + 3) % A_.length].id, b: B_[(i * 5 + 1) % B_.length].id, n: between(6, 42, IR), attach: between(8, 34, IR) })).sort((x, y) => y.n - x.n)
    : [];

  const m = {};
  insList.forEach((x) => x.colours.forEach(({ v, share }) => { const k = v.colour; m[k] ||= { colour: k, hex: v.hex, views: 0, stock: 0 }; m[k].views += x.views * share; m[k].stock += v.stock; }));
  const cdRows = Object.values(m); const tv = sumBy(cdRows, 'views'), ts = sumBy(cdRows, 'stock');
  cdRows.forEach((r) => { r.viewShare = pct(r.views, tv); r.stockShare = pct(r.stock, ts); r.gap = r.viewShare / Math.max(0.5, r.stockShare); });
  colourDemand = cdRows.sort((a, b) => b.views - a.views).slice(0, 10);

  built = true;
}

/* ---------- Helpers used by the page renderer ---------- */
const STOP = new Set(['for', 'with', 'and', 'under', 'saree', 'sarees']);
export function searchHits(q) {
  const t = q.toLowerCase().split(/\s+/); const ui = t.indexOf('under'); const max = ui >= 0 ? Number(t[ui + 1]) || Infinity : Infinity;
  const words = t.filter((w) => !STOP.has(w) && !/^\d+$/.test(w));
  return insPool.filter((p) => p.price <= max && words.every((w) => `${p.name} ${p.weave} ${CAT[p.cat].name} ${p.occasion} ${p.fabric}`.toLowerCase().includes(w.slice(0, 5)))).length;
}

export function priceBands(cat) {
  const cuts = BANDS[cat] || [0, Math.round(CAT_MEDIAN[cat] || 0)];
  const rows = cuts.map((lo, i) => {
    const hi = cuts[i + 1] ?? Infinity;
    const xs = insList.filter((x) => PROD[x.id].cat === cat && PROD[x.id].price >= lo && PROD[x.id].price < hi);
    const v = sumBy(xs, 'views'), c = sumBy(xs, 'carts'), u = sumBy(xs, 'units'), rev = sumBy(xs, 'revenue');
    return {
      lo, hi, n: xs.length, v, c, u, rev,
      cartRate: pct(c, v), conv: pct(u, v), rpv: v ? rev / v : 0,
      bounce: v ? sumBy(xs, (x) => x.priceBounce * x.views) / v : 0,
    };
  }).filter((b) => b.n);
  const tv = sumBy(rows, 'v'), tu = sumBy(rows, 'u');
  rows.forEach((b) => { b.viewShare = pct(b.v, tv); b.unitShare = pct(b.u, tu); });
  const best = rows.reduce((m, b) => (!m || b.rpv > m.rpv ? b : m), null);
  if (best) best.best = true;
  return rows;
}

/* ---------- Tab + category state (shared with actions.js) ---------- */
let insTab = 'overview';
let insCat = 'silk';
export const getInsTab = () => insTab;
export const setInsTab = (v) => { insTab = v; };
export const getInsCat = () => insCat;
export const setInsCat = (v) => { insCat = v; };
