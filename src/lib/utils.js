// Formatting, helpers, icons — a near-verbatim port of utilities from the HTML file.

export const $ = (id) => document.getElementById(id);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDate = (v) => (typeof v === 'string' && v.length === 10 ? new Date(`${v}T00:00:00`) : new Date(v));
export const TODAY = toDate(iso(new Date()));
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysFrom = (v) => Math.round((toDate(iso(toDate(v))) - TODAY) / 864e5);

export const nf = new Intl.NumberFormat('en-IN');
export const inrF = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const dF = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const dmF = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' });
export const tF = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
export const dtF = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
export const inr = (v) => inrF.format(Math.round(v));
export const inrS = (v) => (Math.abs(v) >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : Math.abs(v) >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : inr(v));
export const fmtD = (v) => (v ? dF.format(toDate(v)) : '—');
export const rel = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`);
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const plural = (n, one, many = `${one}s`) => `${nf.format(n)} ${n === 1 ? one : many}`;
export const initials = (n) => n.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
export const avc = (s) => `av${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 5}`;
export const pct = (a, b) => (b ? (a / b) * 100 : 0);
export const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const R = rng(2026);
export const pick = (a, r = R) => a[Math.floor(r() * a.length)];
export const between = (a, b, r = R) => a + Math.floor(r() * (b - a + 1));
export const who = (name, sub) => `<span class="who"><span class="avatar ${avc(name)}">${esc(initials(name))}</span><span><b>${esc(name)}</b>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span></span>`;
export const ov = (o) => (Array.isArray(o) ? o[0] : o);
export const ol = (o) => (Array.isArray(o) ? o[1] : o);
export const pill = (text, tone = 'neutral', dot = false) => `<span class="pill p-${tone}">${dot ? '<span class="dot"></span>' : ''}${esc(text)}</span>`;

export const ICONS = {
  dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  returns: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/>',
  customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  video: '<path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  products: '<path d="M4 3h16v18H4z"/><path d="M4 15h16M4 18h16"/>',
  inventory: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  weavers: '<path d="M4 4h16M4 9h16M4 14h16M4 19h16M8 2v20M16 2v20"/>',
  stitch: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  marketing: '<path d="M3 11l18-8v18L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  reviews: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  staff: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.3 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  dl: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  category: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  ship: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  journal: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M8 7h8M8 11h6"/>',
  page: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  coupon: '<path d="M20 12V8H4v4a2 2 0 0 1 0 4v4h16v-4a2 2 0 0 1 0-4z"/><path d="M10 8v12" stroke-dasharray="2 2"/>',
  analytics: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  insights: '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 5-6"/><circle cx="18" cy="7" r="1.5"/>',
  barcode: '<path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/>',
  pack: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
};
export const icon = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- Code 128 (character set B) ---------- */
// Widths of bar/space/bar/space/bar/space per symbol; last is the stop pattern.
const C128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
export function code128(text, h = 54) {
  const s = String(text ?? '').replace(/[^\x20-\x7e]/g, '');
  const vals = [104, ...[...s].map((ch) => ch.charCodeAt(0) - 32)];
  const check = vals.reduce((a, v, i) => a + v * (i || 1), 0) % 103;
  const seq = [...vals, check, 106].map((v) => C128[v]).join('');
  let x = 10, d = '';
  for (let i = 0; i < seq.length; i++) { const n = +seq[i]; if (i % 2 === 0) d += `M${x} 0h${n}v1h-${n}z`; x += n; }
  return `<svg class="bc" viewBox="0 0 ${x + 10} 1" preserveAspectRatio="none" width="100%" height="${h}" shape-rendering="crispEdges" role="img" aria-label="Barcode ${esc(s)}"><rect width="${x + 10}" height="1" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
