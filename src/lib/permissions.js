// SEC-05: client-side mirror of backend/src/permissions.js.
// Keep both in sync — they share the same keys and role→perm matrix.
// The admin UI uses this file to:
//   1. Hide sidebar entries the current role can't access.
//   2. Render the Settings > Team permission matrix.
//   3. Short-circuit optimistic actions before the backend 403s.
//
// Backend enforcement is authoritative — this file is a UX shortcut.

export const PERMISSIONS = Object.freeze({
  dashboard: 'Dashboard — the home summary cards + queue.',
  analytics: 'Analytics — sales, traffic and conversion charts.',
  insights: 'Product insights — per-SKU performance.',
  orders: 'Orders — view, update status, cancel, mark delivered, refund.',
  packing: 'Packing bench — scan pieces into packed orders.',
  returns: 'Returns — review, approve, mark refunded.',
  shipping: 'Shipping — rates, label pushes, tracking, NDR.',
  products: 'Products — create, edit, publish and delete products.',
  categories: 'Categories — manage the catalogue categories.',
  occasions: 'Occasions — manage occasion tags shown on the storefront.',
  priceRanges: 'Shop by price — manage the price buckets.',
  inventory: 'Inventory — view and adjust on-hand stock.',
  barcodes: 'Barcodes and stock — scan, print labels, view movements.',
  customers: 'Customers — view the CRM, add notes, see order history.',
  reviews: 'Reviews — moderate, reply, hide.',
  coupons: 'Coupons — create, update and disable discount codes.',
  journal: 'Journal — publish long-form content on the storefront.',
  storefront: 'Storefront pages — edit CMS pages, hero slides, home banners.',
  settings: 'Settings — store details, shipping, GST, returns policy.',
  team: 'Team — invite, edit, disable and remove admin users.',
});

const ALL_PERMISSIONS = Object.freeze(Object.keys(PERMISSIONS));

export const ROLE_PERMISSIONS = Object.freeze({
  owner: ALL_PERMISSIONS,
  manager: Object.freeze([
    'dashboard', 'analytics', 'insights',
    'orders', 'packing', 'returns', 'shipping',
    'products', 'categories', 'occasions', 'priceRanges', 'inventory', 'barcodes',
    'customers', 'reviews',
    'coupons', 'journal', 'storefront',
    'settings',
  ]),
  packer: Object.freeze([
    'orders', 'packing', 'barcodes', 'inventory', 'products',
  ]),
  support: Object.freeze([
    'orders', 'returns', 'reviews', 'customers',
  ]),
});

export const ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  manager: 'Manager',
  packer: 'Packer',
  support: 'Support',
});

export const ROLE_BLURBS = Object.freeze({
  owner: 'Full access. Can manage team + Settings.',
  manager: 'Everything except user management and dangerous destructives.',
  packer: 'Packing bench, barcodes, inventory and product lookup.',
  support: 'Orders, returns, reviews and the customer CRM.',
});

// Sidebar nav id → permission key. Only nav entries that belong to a
// permission-gated module appear here; keys not in the map are shown to
// everyone (there are none today, but keeps the lookup forgiving).
export const NAV_PERM = Object.freeze({
  dashboard: 'dashboard',
  analytics: 'analytics',
  insights: 'insights',
  orders: 'orders',
  packing: 'packing',
  returns: 'returns',
  shipping: 'shipping',
  products: 'products',
  categories: 'categories',
  occasions: 'occasions',
  priceRanges: 'priceRanges',
  inventory: 'inventory',
  barcodes: 'barcodes',
  customers: 'customers',
  reviews: 'reviews',
  coupons: 'coupons',
  journal: 'journal',
  storefront: 'storefront',
  settings: 'settings',
});

export function hasPerm(role, perm) {
  const list = ROLE_PERMISSIONS[role];
  if (!list) return false;
  return list.includes(perm);
}

// The signed-in user's permission list — set from App.jsx once /auth/me
// resolves. Modules that render during the loading window see an empty list
// and should treat that as "no permissions yet" rather than "none allowed".
let currentPerms = [];
let currentRole = null;

export function setCurrentUser(me) {
  currentRole = me?.role || null;
  // Trust the backend-provided list if present; fall back to the local
  // matrix for an older server that doesn't send it yet.
  currentPerms = Array.isArray(me?.permissions) && me.permissions.length
    ? [...me.permissions]
    : (currentRole ? [...(ROLE_PERMISSIONS[currentRole] || [])] : []);
}

export function can(perm) {
  return currentPerms.includes(perm);
}

export function currentRoleName() {
  return currentRole;
}
