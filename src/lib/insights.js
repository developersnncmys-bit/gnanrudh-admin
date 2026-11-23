// Product Insights — DATA-01/02: the PRNG-simulated data was stripped. The
// collections below stay as empty structures so the existing insight drawer and
// action handlers keep working (they already guard for "no data"), and so the
// shape is ready for a real tracker (GA4 / PostHog / Clarity) to populate.

import { pad } from './utils.js';

export const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${pad(Math.round(s % 60))} s` : `${Math.round(s)} s`);
export const pc = (v, d = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(d)}%`;
export const ago = (h) => (h < 1 ? 'just now' : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`);
export const sumBy = (xs, k) => xs.reduce((a, x) => a + (typeof k === 'function' ? k(x) : x[k]), 0);

export const STAGES = ['Cart', 'Checkout, address', 'Checkout, payment', 'Payment failed'];
export const STAGE_TONE = { Cart: 'neutral', 'Checkout, address': 'info', 'Checkout, payment': 'warn', 'Payment failed': 'bad' };
export const REC_TONE = { 'Not contacted': 'warn', 'Reminder sent': 'info', Recovered: 'ok', Expired: 'neutral', 'Not contactable': 'neutral' };

export const VERDICT = {
  'Best seller': ['ok', 'Converts well and gets seen. Keep it in stock and on the home rail, and watch its days of cover.'],
  'Hidden gem': ['zari', 'Converts well but few people see it. Feature it on the home page, Instagram or a WhatsApp broadcast.'],
  'Carted, not bought': ['warn', 'Shoppers want it but stop before paying. Check the shipping charge, COD at their pincode and payment failures, then send cart reminders.'],
  'Looked at, not carted': ['bad', 'Plenty of views, few carts. Usually price, photos or missing details. Compare it with its aisle in Price acceptance.'],
  'Return risk': ['bad', 'Returns are eating the sales. Read the return reasons; often colour or drape does not match the photos.'],
  'Slow mover': ['neutral', 'Few views and few sales. Refresh the photos, pair it with a blouse or accessory, or mark it down.'],
  Steady: ['neutral', 'Selling in line with its aisle.'],
};

export const INS = {};
export const AB = {};
export const abCarts = [];
export let insList = [];

let built = false;
export const isBuilt = () => built;
export function build() { built = true; }

let insTab = 'overview';
let insCat = 'silk';
export const setInsTab = (v) => { insTab = v; };
export const setInsCat = (v) => { insCat = v; };
