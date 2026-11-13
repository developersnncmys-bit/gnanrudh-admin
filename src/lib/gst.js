// TAX-02: GST slab recommended by HSN chapter + unit price.
// Mirrors backend/src/gst.js — keep both files in sync.
export function computeGstRate(hsn, unitPrice) {
  const h = String(hsn || '').trim();
  if (!h) return null;
  const chapter = Number(h.slice(0, 2));
  const price = Number(unitPrice) || 0;
  if ([61, 62, 63].includes(chapter)) return price > 2500 ? 18 : 5;
  if (chapter >= 50 && chapter <= 55) return 5;
  if (h.startsWith('7117')) return 3;
  return null;
}
