// Shared rendering helpers reproduced verbatim from the original HTML file.
import {
  esc, pill, nf, ov, ol, icon, inr, pct, inrS,
} from './utils.js';
import { CAT, PROD, STORE_STATE, CUST, SEG_TONE } from './data.js';

export const ORDER_TONE = { 'Payment pending': 'warn', 'Label generated': 'info', 'In transit': 'info', Delivered: 'ok', 'Delivery failed': 'bad', 'Returned to origin': 'bad', Cancelled: 'neutral' };
export const PAY_TONE = { Paid: 'ok', Pending: 'warn', Refunded: 'neutral', 'COD pending': 'warn', 'COD collected': 'ok', 'COD not collected': 'bad' };
export const RET_TONE = { Requested: 'warn', 'Not eligible': 'neutral', 'Pickup scheduled': 'info', 'Picked up': 'info', Received: 'pri', Refunded: 'ok', Rejected: 'neutral' };

// Fallback shown when a referenced product has been deleted from the DB
// but an order/return/review still points at its id.
const MISSING = { hex: '#cbc9d1', zariHex: '#eeedf1', name: 'Deleted product', cat: null };

// A product has no real colour variants when either it has zero
// variants OR its only variant has an empty colour name (the sentinel
// written by the bulk-upload path for "qty without colour" products).
// We render these as a plain neutral tile — no gradient, no swatch —
// so the thumbnail doesn't imply a colour that isn't there.
const hasNoColour = (p) => !p
  || !Array.isArray(p.variants)
  || p.variants.length === 0
  || (p.variants.length === 1 && !p.variants[0]?.colour);
const plainTile = (size = '') => `<span class="sw ${size}" style="background:#eceae4;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)" aria-hidden="true"></span>`;

export const sw = (p, size = '') => {
  if (hasNoColour(p)) return plainTile(size);
  const q = p || MISSING;
  return `<span class="sw ${size}" style="--b:${q.hex};--z:${q.zariHex}" aria-hidden="true"></span>`;
};
export const swv = (v, p, size = 'sm') => {
  // Variant-level call. If the variant itself has no colour name
  // (a no-colour product's sentinel variant) render the plain tile
  // too — the thumbnail should match everywhere this product shows up.
  if (v && !v.colour) return plainTile(size);
  const q = p || MISSING;
  const vv = v || { hex: q.hex, colour: '' };
  return `<span class="sw ${size}" style="--b:${vv.hex};--z:${q.zariHex}" title="${esc(vv.colour)}" aria-hidden="true"></span>`;
};
// Prefer the product's first uploaded image; fall back to the colour swatch
// so the row/drawer still has a visual when no image has been added yet.
export const thumb = (p, size = '') => {
  const url = p?.imageUrls?.[0];
  if (!url) return sw(p, size);
  return `<span class="sw ${size}" style="background:url('${esc(url)}') center/cover no-repeat" aria-hidden="true"></span>`;
};
// Product thumbnail prefers the admin-uploaded image so inventory/orders/
// packing lists match what visitors see on the storefront. The `variant`
// argument only matters as a last-resort colour swatch when the product
// has no uploaded image yet — in that case we prefer the variant's hex
// over the product's first-variant default (so a Teal piece of a product
// whose first variant was Maroon doesn't render as maroon).
export const prodCell = (p, extra = '', variant = null) => {
  const q = p || MISSING;
  const catName = q.cat && CAT[q.cat] ? CAT[q.cat].name : (p ? '—' : 'Removed from catalogue');
  const hasImage = Boolean(q?.imageUrls?.[0]);
  const swatch = hasImage ? thumb(q) : (variant ? swv(variant, q) : sw(q));
  return `<div class="prod">${swatch}<span><b>${esc(q.name)}</b><span class="sub">${esc(catName)}${extra}</span></span></div>`;
};
export const variantOf = (it) => {
  const p = PROD[it.pid];
  return p ? p.variants.find((v) => v.id === it.vid) : null;
};
export const seg = (s) => pill(s, SEG_TONE[s]);

export function gstLines(o) {
  // Null-safe: storefront orders can reference a customer the admin cache
  // hasn't bootstrapped yet, and order items can point at products the
  // admin has since deleted. Either one previously threw and killed the
  // order drawer render — match the fallback pattern used by docInvoice.
  const c = CUST[o.cid] || { state: '' };
  const intra = c.state === STORE_STATE;
  const scale = o.sub ? o.total / o.sub : 1;
  const taxable = o.items.reduce((a, it) => {
    const p = PROD[it.pid] || { gst: 0 };
    const gross = (it.price + (it.stitch ? it.stitch.price : 0)) * scale;
    return a + gross / (1 + (Number(p.gst) || 0) / 100);
  }, 0);
  const tax = o.total - taxable;
  return { intra, taxable, tax, place: c.state };
}

/* Charts */
const niceMax = (v) => { const m = Math.pow(10, Math.floor(Math.log10(v || 1))); return Math.ceil(v / m) * m; };
export function areaChart(series, labels, { h = 230, fmt = inrS, colors = ['#05380d', '#E0AE6D', '#7d7985'], names = [] } = {}) {
  const w = 760, pl = 58, pr = 10, pt = 12, pb = 26;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s[i], 0));
  const max = niceMax(Math.max(...totals) * 1.05);
  const x = (i) => pl + (i * (w - pl - pr)) / (labels.length - 1);
  const y = (v) => pt + (1 - v / max) * (h - pt - pb);
  let acc = labels.map(() => 0);
  const layers = series.map((s, si) => {
    const top = s.map((v, i) => acc[i] + v);
    const d = top.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') + acc.map((v, i) => `L${x(labels.length - 1 - i).toFixed(1)},${y(acc[labels.length - 1 - i]).toFixed(1)}`).join('') + 'Z';
    acc = top;
    return `<path d="${d}" fill="${colors[si]}" fill-opacity="${si === 0 ? 0.85 : 0.7}"/>`;
  }).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => `<line x1="${pl}" x2="${w - pr}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="#ecebef"/><text x="${pl - 8}" y="${y(max * t) + 4}" text-anchor="end">${esc(fmt(max * t))}</text>`).join('');
  const xl = labels.map((l, i) => (i % Math.ceil(labels.length / 7) === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
  const hits = labels.map((l, i) => `<rect x="${x(i) - (w - pl - pr) / labels.length / 2}" y="${pt}" width="${(w - pl - pr) / labels.length}" height="${h - pt - pb}" fill="transparent"><title>${esc(l)}: ${esc(inr(totals[i]))}${series.length > 1 ? series.map((s, si) => `\n${names[si]}: ${inr(s[i])}`).join('') : ''}</title></rect>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Revenue chart">${ticks}${layers}${xl}${hits}</svg>`;
}
export function hbars(rows, { fmt = (v) => nf.format(v), tone = '' } = {}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return rows.map((r) => `<div class="hbar"><span>${esc(r.label)}${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ''}</span><div class="bar ${r.tone || tone}"><span style="width:${(r.value / max) * 100}%"></span></div><span class="strong">${esc(fmt(r.value))}</span></div>`).join('');
}

/* Generic listView used by multiple pages. Keeps its state on the exported LV object. */
export const LV = {};
export function listView(id, cfg) {
  const s = LV[id] ||= { tab: cfg.tabs?.[0]?.id, q: '', sort: cfg.sort || null, sel: new Set(), f: {}, page: 0 };
  if (cfg.tabs && !cfg.tabs.some((t) => t.id === s.tab)) s.tab = cfg.tabs[0].id;
  let rows = cfg.rows;
  const tab = cfg.tabs?.find((t) => t.id === s.tab);
  if (tab?.filter) rows = rows.filter(tab.filter);
  if (s.q) { const q = s.q.toLowerCase(); rows = rows.filter((r) => cfg.text(r).toLowerCase().includes(q)); }
  (cfg.filters || []).forEach((f) => { if (s.f[f.id]) rows = rows.filter((r) => f.test(r, s.f[f.id])); });
  if (s.sort) {
    const col = cfg.columns.find((c) => c.key === s.sort.key);
    if (col) { const g = col.sort === true ? (r) => r[col.key] : col.sort; const d = s.sort.dir === 'desc' ? -1 : 1; rows = [...rows].sort((a, b) => { const x = g(a), y = g(b); return x > y ? d : x < y ? -d : 0; }); }
  }
  s.visible = rows;
  // Pagination is opt-in via cfg.pageSize. Without it the full filtered set
  // renders (prior behaviour). When set, clamp s.page so filter/search
  // tightening the result doesn't leave the user on an empty page.
  const totalRows = rows.length;
  const pageSize = Number(cfg.pageSize) || 0;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  if (s.page == null || s.page < 0) s.page = 0;
  if (s.page > pageCount - 1) s.page = pageCount - 1;
  const pageStart = pageSize > 0 ? s.page * pageSize : 0;
  const pageRows = pageSize > 0 ? rows.slice(pageStart, pageStart + pageSize) : rows;
  const visibleIds = pageRows.map((r) => r.id);
  // Clear selections that aren't in the overall filtered set (not just the
  // current page) so navigating between pages doesn't drop earlier picks.
  const filteredIds = new Set(rows.map((r) => r.id));
  [...s.sel].forEach((x) => { if (!filteredIds.has(x)) s.sel.delete(x); });
  const allSel = pageRows.length > 0 && pageRows.every((r) => s.sel.has(r.id));
  const tabs = cfg.tabs ? `<div class="tabs" role="tablist">${cfg.tabs.map((t) => { const n = cfg.rows.filter(t.filter || (() => true)).length; return `<button type="button" role="tab" class="tab" aria-selected="${t.id === s.tab}" data-lv="${id}" data-lv-tab="${t.id}">${esc(t.label)}${t.count === false ? '' : `<span class="n${t.hot && n ? ' hot' : ''}">${nf.format(n)}</span>`}</button>`; }).join('')}</div>` : '';
  const sortIco = (d) => `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="m7 9 5-5 5 5" opacity="${d === 'asc' ? 1 : .3}"/><path d="m7 15 5 5 5-5" opacity="${d === 'desc' ? 1 : .3}"/></svg>`;
  const tabNote = tab?.note ? `<div class="note n-info" style="margin:12px 20px 0">${tab.note}</div>` : '';
  return `<section class="panel">${tabs}${tabNote}
    ${s.sel.size && cfg.bulk ? `<div class="bulk"><strong>${nf.format(s.sel.size)} selected</strong>${cfg.bulk.map(([act, label, cls]) => `<button type="button" class="btn ${cls || 'btn-sec'} btn-sm" data-act="${act}" data-lv="${id}">${esc(label)}</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-lv="${id}" data-lv-clear style="margin-left:auto">Clear selection</button></div>`
    : `<div class="toolbar"><div class="search">${icon('search')}<input class="ctl" type="search" placeholder="${esc(cfg.placeholder || 'Search')}" value="${esc(s.q)}" data-lv="${id}" data-lv-q id="lvq-${id}" aria-label="${esc(cfg.placeholder || 'Search')}"></div>
      ${(cfg.filters || []).map((f) => `<select class="ctl${s.f[f.id] ? ' is-set' : ''}" data-lv="${id}" data-lv-f="${f.id}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}</option>${f.options.map((o) => `<option value="${esc(ov(o))}"${String(s.f[f.id]) === String(ov(o)) ? ' selected' : ''}>${esc(ol(o))}</option>`).join('')}</select>`).join('')}
      <div class="right">${cfg.tools || ''}</div></div>`}
    <div class="scroll"><table class="t" style="min-width:${cfg.minWidth || 900}px"><thead><tr>
      ${cfg.bulk ? `<th class="chk"><span><input type="checkbox" aria-label="Select all" data-lv="${id}" data-lv-all ${allSel ? 'checked' : ''}></span></th>` : ''}
      ${cfg.columns.map((c) => { const on = s.sort?.key === c.key; return `<th class="${c.align === 'r' ? 'r' : ''}"${on ? ` aria-sort="${s.sort.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${c.sort ? `<button type="button" class="${on ? 'on' : ''}" data-lv="${id}" data-lv-sort="${c.key}">${esc(c.label)}${sortIco(on ? s.sort.dir : null)}</button>` : `<span>${esc(c.label)}</span>`}</th>`; }).join('')}
    </tr></thead><tbody>
      ${pageRows.length ? pageRows.map((r) => `<tr class="${cfg.open ? 'click' : ''}${s.sel.has(r.id) ? ' sel' : ''}"${cfg.open ? ` data-open="${cfg.open}:${esc(r.id)}" tabindex="0" role="link" aria-label="Open ${cfg.open} ${esc(r.id)}"` : ''}>${cfg.bulk ? `<td class="chk"><input type="checkbox" aria-label="Select" data-lv="${id}" data-lv-sel="${esc(r.id)}" ${s.sel.has(r.id) ? 'checked' : ''}></td>` : ''}${cfg.columns.map((c) => `<td class="${c.align === 'r' ? 'r' : ''}${c.wrap ? ' wrap' : ''}">${c.render(r)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cfg.columns.length + (cfg.bulk ? 1 : 0)}" class="empty"><strong>${esc(cfg.emptyTitle || 'Nothing here')}</strong>${esc(cfg.emptyText || 'Try another tab or clear the search.')}</td></tr>`}
    </tbody></table></div>
    <div class="tfoot"><span>${pageSize > 0 && totalRows > 0
      ? `Showing ${nf.format(pageStart + 1)}–${nf.format(pageStart + pageRows.length)} of ${nf.format(totalRows)} ${totalRows === 1 ? (cfg.noun || 'row') : (cfg.noun ? `${cfg.noun}s` : 'rows')}`
      : `Showing ${nf.format(totalRows)} ${totalRows === 1 ? (cfg.noun || 'row') : (cfg.noun ? `${cfg.noun}s` : 'rows')}`}</span>${pageSize > 0 && pageCount > 1 ? pageNav(id, s.page, pageCount) : ''}${cfg.foot || ''}</div></section>`;
}

// Compact pager rendered in the listView footer. Keyed by `data-lv-page`
// so App.jsx's click delegation can read the target page index.
function pageNav(id, page, pageCount) {
  const btn = (n, label, disabled, extra = '') => `<button type="button" class="btn btn-sec btn-sm" data-lv="${id}" data-lv-page="${n}" ${disabled ? 'disabled aria-disabled="true"' : ''} ${extra}>${label}</button>`;
  return `<span class="pager" style="display:inline-flex;gap:6px;align-items:center;margin-left:auto">
    ${btn(page - 1, 'Prev', page === 0)}
    <span class="sub" style="padding:0 6px">Page ${nf.format(page + 1)} of ${nf.format(pageCount)}</span>
    ${btn(page + 1, 'Next', page >= pageCount - 1)}
  </span>`;
}
export const lvSelected = (id) => [...(LV[id]?.sel || [])];
