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

export const sw = (p, size = '') => {
  const q = p || MISSING;
  return `<span class="sw ${size}" style="--b:${q.hex};--z:${q.zariHex}" aria-hidden="true"></span>`;
};
export const swv = (v, p, size = 'sm') => {
  const q = p || MISSING;
  const vv = v || { hex: q.hex, colour: '' };
  return `<span class="sw ${size}" style="--b:${vv.hex};--z:${q.zariHex}" title="${esc(vv.colour)}" aria-hidden="true"></span>`;
};
// If `variant` is supplied, the swatch uses THAT variant's colour (so a Teal
// piece shows teal) instead of the product's first-variant default (so a Teal
// piece of a product whose first variant was Maroon doesn't render as maroon).
export const prodCell = (p, extra = '', variant = null) => {
  const q = p || MISSING;
  const catName = q.cat && CAT[q.cat] ? CAT[q.cat].name : (p ? '—' : 'Removed from catalogue');
  const swatch = variant ? swv(variant, q) : sw(q);
  return `<div class="prod">${swatch}<span><b>${esc(q.name)}</b><span class="sub">${esc(catName)}${extra}</span></span></div>`;
};
export const variantOf = (it) => {
  const p = PROD[it.pid];
  return p ? p.variants.find((v) => v.id === it.vid) : null;
};
export const seg = (s) => pill(s, SEG_TONE[s]);

export function gstLines(o) {
  const intra = CUST[o.cid].state === STORE_STATE;
  const scale = o.total / o.sub;
  const taxable = o.items.reduce((a, it) => a + ((it.price + (it.stitch ? it.stitch.price : 0)) * scale) / (1 + PROD[it.pid].gst / 100), 0);
  const tax = o.total - taxable;
  return { intra, taxable, tax, place: CUST[o.cid].state };
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
  const s = LV[id] ||= { tab: cfg.tabs?.[0]?.id, q: '', sort: cfg.sort || null, sel: new Set(), f: {} };
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
  const visibleIds = rows.map((r) => r.id);
  [...s.sel].forEach((x) => { if (!visibleIds.includes(x)) s.sel.delete(x); });
  const allSel = rows.length > 0 && rows.every((r) => s.sel.has(r.id));
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
      ${rows.length ? rows.map((r) => `<tr class="${cfg.open ? 'click' : ''}${s.sel.has(r.id) ? ' sel' : ''}"${cfg.open ? ` data-open="${cfg.open}:${esc(r.id)}"` : ''}>${cfg.bulk ? `<td class="chk"><input type="checkbox" aria-label="Select" data-lv="${id}" data-lv-sel="${esc(r.id)}" ${s.sel.has(r.id) ? 'checked' : ''}></td>` : ''}${cfg.columns.map((c) => `<td class="${c.align === 'r' ? 'r' : ''}${c.wrap ? ' wrap' : ''}">${c.render(r)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cfg.columns.length + (cfg.bulk ? 1 : 0)}" class="empty"><strong>${esc(cfg.emptyTitle || 'Nothing here')}</strong>${esc(cfg.emptyText || 'Try another tab or clear the search.')}</td></tr>`}
    </tbody></table></div>
    <div class="tfoot"><span>Showing ${nf.format(rows.length)} ${rows.length === 1 ? (cfg.noun || 'row') : (cfg.noun ? `${cfg.noun}s` : 'rows')}</span>${cfg.foot || ''}</div></section>`;
}
export const lvSelected = (id) => [...(LV[id]?.sel || [])];
