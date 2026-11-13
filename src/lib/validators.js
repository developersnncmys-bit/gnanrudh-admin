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
