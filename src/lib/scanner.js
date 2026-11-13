// Keyboard-wedge barcode scanner integration.
// A USB/BT scanner types the code very fast then presses Enter. We watch for
// that fast burst anywhere in the app and route the scanned code to:
//   - the Packing page (if active and the scan is an order/piece), or
//   - the global router (opens any order / piece / SKU / AWB).
//
// Any input that opts in with `data-scan="..."` (the Packing page scan box,
// a setup test field) is treated as a dedicated scan box — we read the value
// on Enter and stop the global detection from firing twice.

import { orders, ORD, PIECE, pieces, bySku } from './data.js';

/* ---------- Beep (success / fail tones) ---------- */
let actx = null;
export function beep(ok) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = ok ? 'sine' : 'square';
    o.frequency.value = ok ? 1046 : 196;
    g.gain.value = 0.06;
    o.connect(g); g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + (ok ? 0.09 : 0.35));
  } catch { /* audio unavailable */ }
}

/* ---------- Lookups ---------- */
export function findOrder(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  if (ORD[c]) return ORD[c];
  return orders.find((o) => (o.ship?.awb === c) || (o.invoice && o.invoice.toUpperCase() === c)) || null;
}
export function findPiece(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  return PIECE[c] || pieces.find((u) => (u.code || u.id || '').toUpperCase() === c) || null;
}

/* ---------- Install a global keyboard-wedge listener ---------- */
// Returns an unsubscribe fn. Takes an onScan(code) callback that receives the
// full scanned string once a fast burst ending in Enter is detected.
export function installGlobalScanner(onScan) {
  const kb = { buf: '', last: 0, start: 0 };

  const onKey = (e) => {
    const t = e.target;
    // Dedicated scan boxes: let their own code consume the burst.
    if (t && t.hasAttribute?.('data-scan')) {
      const now = performance.now();
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = t.value; t.value = '';
        const ms = kb.start ? now - kb.start : 0; kb.start = 0;
        onScan(v, { source: t.dataset.scan, ms, chars: v.trim().length });
        return;
      }
      if (!t.value) kb.start = now;
      return;
    }
    // Skip when the user is typing in a regular field or a modal dialog.
    if (t?.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]')) return;

    const now = performance.now();
    if (e.key === 'Enter') {
      // Fast burst (>=4 chars, <35ms per char on average) → scanner
      const fast = kb.buf.length >= 4 && (now - kb.start) / kb.buf.length < 35;
      const b = kb.buf; kb.buf = '';
      if (fast) { e.preventDefault(); onScan(b, { source: 'global', ms: now - kb.start, chars: b.length }); }
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) { kb.buf = ''; return; }
    if (now - kb.last > 60) { kb.buf = ''; kb.start = now; }
    kb.buf += e.key; kb.last = now;
  };

  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}

export { bySku };
