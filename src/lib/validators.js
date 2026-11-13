// VAL-01: mirrors backend/src/validators.js. Used by action handlers to block
// bad submissions before the HTTP call, so the server's 400 isn't the user's first signal.

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const MOBILE_IN_RE = /^[6-9][0-9]{9}$/;
export const PINCODE_IN_RE = /^[1-9][0-9]{5}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isGSTIN = (v) => typeof v === 'string' && GSTIN_RE.test(v);
export const isMobileIN = (v) => typeof v === 'string' && MOBILE_IN_RE.test(v);
export const isPincodeIN = (v) => typeof v === 'string' && PINCODE_IN_RE.test(v);
export const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v);

// TAX-01: block tax-invoice output while the seeded placeholders are still in Settings.
const PLACEHOLDER_GSTIN = '29ABCDE1234F1Z5';
const PLACEHOLDER_ADDR_RE = /^Bengaluru,?\s*Karnataka\s*\d{6}$/i;

export function settingsReady(SETTINGS) {
  const store = SETTINGS?.store || {};
  const gst = SETTINGS?.gst || {};
  const issues = [];
  const gstin = (gst.gstin || '').trim();
  if (!gstin) issues.push('GSTIN is empty');
  else if (gstin === PLACEHOLDER_GSTIN) issues.push('GSTIN is still the placeholder 29ABCDE1234F1Z5');
  else if (!isGSTIN(gstin)) issues.push('GSTIN format is invalid');
  const phone = (store.phone || '').trim();
  if (!phone) issues.push('Business phone is empty');
  else if (/x/i.test(phone)) issues.push('Business phone is still the placeholder');
  const addr = (store.address || '').trim();
  if (!addr) issues.push('Business address is empty');
  else if (addr.length < 20 || PLACEHOLDER_ADDR_RE.test(addr)) issues.push('Business address is too short or still the placeholder');
  const name = (store.name || '').trim();
  if (!name) issues.push('Business name is empty');
  return { ok: issues.length === 0, issues };
}
