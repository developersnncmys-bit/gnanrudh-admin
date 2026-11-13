// Drawer render functions and openDrawer/closeDrawer helpers.
// Faithful ports of the drawers from the original HTML file.
import {
  esc, pill, nf, inr, fmtD, dmF, dtF, icon, plural, rel, daysFrom, iso, TODAY, addDays, ov, ol,
  initials, avc, who, code128,
} from './utils.js';
import { computeGstRate } from './gst.js';
import {
  categories, CAT, COLORS, OCCASIONS, SIZES, BORDERS, products, PROD, stockOf, customers, CUST,
  orders, ORD, jobs, STITCH_STAGES, returns, POLICY, shipLog, COURIERS, coupons,
  reviews, journal, SCENES, PAGES_CMS, SETTINGS, M_FIELDS, featured, setFeatured,
  pieces, PIECE, PIECE_TONE, moves, varRef,
} from './data.js';
import {
  ORDER_TONE, PAY_TONE, RET_TONE, sw, swv, prodCell, variantOf, seg, gstLines,
} from './renderers.js';

/* ---------- Drawer open / close ---------- */
let lastFocus = null;
export function openDrawer(html) {
  lastFocus = lastFocus || document.activeElement;
  const d = document.getElementById('drawer');
  d.innerHTML = html;
  document.getElementById('scrim').hidden = false;
  d.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => d.classList.add('open'));
  d.querySelector('.d-body')?.scrollTo(0, 0);
  setTimeout(() => d.querySelector('[data-act="closeDrawer"]')?.focus(), 30);
}
export function closeDrawer(silent) {
  const d = document.getElementById('drawer');
  if (!d.classList.contains('open')) return;
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
  document.getElementById('scrim').hidden = true;
  if (!silent) lastFocus?.focus?.();
  lastFocus = null;
}

/* ---------- ORDER ---------- */
// CUS-03: tiny helper for drawers that die with a soft "not found" panel when
// their primary record or a joined reference is missing, instead of throwing.
function notFoundDrawer(what, id) {
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">${esc(what)} not found</h2><p class="small muted" style="margin:4px 0 0">ID ${esc(String(id))}</p></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div><div class="d-body"><p class="note n-warn" style="margin:0">This record no longer exists. The ID is probably a stale reference from another record that wasn't cleaned up.</p></div>`);
}

export function orderDrawer(id) {
  const o = ORD[id];
  if (!o) return notFoundDrawer('Order', id);
  const c = CUST[o.cid];
  if (!c) return notFoundDrawer('Customer for order ' + id, o.cid);
  const g = gstLines(o);
  const actions = {
    'Payment pending': [['cancelOrder', 'Cancel order', 'btn-bad'], ['checkPayment', 'Check with Razorpay', 'btn-sec']],
    'Label generated': [['printLabel', 'Print label', 'btn-sec']],
    'Delivery failed': [['ndrRto', 'Return to origin', 'btn-bad'], ['ndrAddress', 'Update address', 'btn-pri']],
    Delivered: o.payment.method !== 'Cash on delivery' && o.payment.status === 'Paid' ? [['refundOrder', 'Refund', 'btn-sec']] : [],
  }[o.status] || [];
  const events = shipLog.filter((s) => s.oid === o.id).slice().reverse();
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">Order ${o.id}</h2><div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">${pill(o.status, ORDER_TONE[o.status], true)}${pill(o.payment.status, PAY_TONE[o.payment.status])}<span class="small muted">${esc(dtF.format(new Date(o.placed)))}, from ${esc(o.source)}</span></div></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body">
      <div class="d-sec"><h3>Items</h3><ul class="list">${o.items.map((it) => {
        const p = PROD[it.pid];
        // CUS-03: if the product was deleted after the order was placed, render a stub
        // row with the id — never throw.
        if (!p) return `<li><div class="grow"><b class="muted">Product no longer in catalogue</b><span class="sub">ID ${esc(it.pid)}, SKU ${esc(it.vid)}</span></div><span class="strong">${inr(it.price)}</span></li>`;
        const v = variantOf(it);
        return `<li>${swv(v, p, '')}<div class="grow"><b>${esc(p.name)}</b><span class="sub">${esc(v?.colour || 'variant removed')}${v?.size ? `, size ${v.size}` : ''}, SKU ${esc(v?.sku || it.vid)}, HSN ${esc(p.hsn)}</span></div><span class="strong">${inr(it.price)}</span></li>`;
      }).join('')}</ul></div>
      <div class="grid g2">
        <div class="d-sec"><h3>Payment</h3><dl class="sum"><dt>Subtotal</dt><dd>${inr(o.sub)}</dd>${o.discount ? `<dt>Coupon ${esc(o.coupon)}</dt><dd>− ${inr(o.discount)}</dd>` : ''}<dt>Shipping</dt><dd>${o.shipping ? inr(o.shipping) : 'Free'}</dd><dt class="tot">Total, incl. GST</dt><dd class="tot">${inr(o.total)}</dd></dl>
          <p class="sub" style="margin-top:8px">${esc(o.payment.method)}${o.payment.rzp ? `, Razorpay ${esc(o.payment.rzp)}` : ''}. Status ${esc(o.payment.status.toLowerCase())}, as reported by Razorpay.</p></div>
        <div class="d-sec"><h3>Customer <button type="button" class="link small" data-open="customer:${c.id}">View in CRM</button></h3>${who(c.name, `${c.orderCount} orders, ${inr(c.ltv)} spent`)}
          <dl class="kv" style="margin-top:10px"><dt>Phone</dt><dd>${esc(c.phone)}</dd><dt>Ship to</dt><dd>${esc(c.city)}, ${esc(c.state)} ${esc(o.ship.pin)}</dd><dt>Segment</dt><dd>${seg(c.segment)}</dd></dl></div>
      </div>
      <div class="d-sec"><h3>GST <span class="small faint">Place of supply ${esc(g.place)}</span></h3>
        <dl class="sum"><dt>Taxable value</dt><dd>${inr(g.taxable)}</dd>${g.intra ? `<dt>CGST</dt><dd>${inr(g.tax / 2)}</dd><dt>SGST</dt><dd>${inr(g.tax / 2)}</dd>` : `<dt>IGST</dt><dd>${inr(g.tax)}</dd>`}</dl>
        <p class="sub" style="margin-top:8px">Rates come from each product’s GST field. Tax invoice ${esc(o.invoice || 'issued once payment clears')}${o.creditNote ? `; credit note ${esc(o.creditNote)} for the refund` : ''}.</p></div>
      <div class="d-sec"><h3>Shipping via Shiprocket</h3>
        <dl class="kv"><dt>Weight slab</dt><dd>${esc(o.ship.slab)} (${nf.format(o.ship.weight)} g packed)</dd><dt>Rate charged by Shiprocket</dt><dd>${inr(o.ship.rate)}</dd>${o.ship.awb ? `<dt>Courier</dt><dd>${esc(o.ship.courier)}, AWB ${o.ship.awb}</dd><dt>Estimated delivery</dt><dd>${fmtD(o.ship.etd)}, as reported by the courier</dd>` : `<dt>Pushed</dt><dd>${o.status === 'Payment pending' ? 'Not yet. Waiting for payment.' : '—'}</dd>`}</dl>
        ${events.length ? `<ol class="timeline" style="margin-top:12px">${events.map((e) => `<li class="${['NDR raised', 'RTO initiated'].includes(e.type) ? 'bad' : 'done'}">${esc(e.type)}${e.detail ? `: ${esc(e.detail)}` : ''}<span class="sub">${esc(dtF.format(new Date(e.at)))}</span></li>`).join('')}</ol>` : ''}</div>
    </div>
    <div class="d-foot"><button type="button" class="btn btn-ghost" data-act="invoice" data-id="${o.id}" style="margin-right:auto"${o.invoice ? '' : ' disabled'}>${icon('dl')}Tax invoice</button>${actions.map(([a, l, cls]) => `<button type="button" class="btn ${cls}" data-act="${a}" data-id="${o.id}">${esc(l)}</button>`).join('')}</div>`);
}

/* ---------- RETURN ---------- */
export function returnDrawer(id) {
  const r = returns.find((x) => x.id === id);
  if (!r) return notFoundDrawer('Return', id);
  // CUS-03: deleted product / customer / order shouldn't crash the drawer.
  // Fall back to stubs with the id so the operator can still act on status/refund.
  const p = PROD[r.pid] || { name: `Product ${r.pid} (removed)`, hsn: '', variants: [] };
  const c = CUST[r.cid] || { name: `Customer ${r.cid} (removed)`, phone: '', city: '' };
  const o = ORD[r.oid] || { payment: { method: 'Unknown', status: 'Unknown' }, invoice: '', deliveredAt: null };
  const foot = {
    Requested: `<button type="button" class="btn btn-bad" data-act="rejectReturn" data-id="${r.id}" style="margin-right:auto">Reject</button><button type="button" class="btn btn-pri" data-act="approveReturn" data-id="${r.id}">Approve and raise reverse pickup</button>`,
    Received: `<button type="button" class="btn btn-bad" data-act="rejectReturn" data-id="${r.id}" style="margin-right:auto">Reject after inspection</button><button type="button" class="btn btn-pri" data-act="refundReturn" data-id="${r.id}">Refund ${inr(r.amount)}</button>`,
    'Pickup scheduled': `<button type="button" class="btn btn-pri" data-act="markPicked" data-id="${r.id}">Mark picked up</button>`,
    'Picked up': `<button type="button" class="btn btn-pri" data-act="markReceived" data-id="${r.id}">Mark received at warehouse</button>`,
  }[r.status] || '<span class="small muted">No action needed.</span>';
  openDrawer(`<div class="d-head">${sw(p, 'lg')}<div class="grow"><h2 class="d-title" id="dTitle">Return ${r.id}</h2><div style="display:flex;gap:8px;align-items:center;margin-top:6px">${pill(r.status, RET_TONE[r.status], true)}<span class="small muted">Order ${esc(r.oid)}</span></div></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body"><div class="d-sec"><dl class="kv"><dt>Product</dt><dd>${esc(p.name)}</dd><dt>Customer</dt><dd>${esc(c.name)}</dd><dt>Reason</dt><dd>${esc(r.reason)}</dd><dt>Requested</dt><dd>${fmtD(r.requested)}</dd>${(() => {
        // RET-02: show delivery date, days-since-delivery and an eligibility badge.
        if (!r.deliveredAt && !o?.deliveredAt) return '';
        const deliveredAt = r.deliveredAt || o.deliveredAt;
        const window = r.windowDays || POLICY.window || 7;
        const days = Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 864e5);
        const eligible = days <= window;
        const tone = eligible ? 'ok' : 'bad';
        return `<dt>Delivered</dt><dd>${fmtD(deliveredAt)} <span class="small muted">· ${days} days ago</span></dd><dt>Eligibility</dt><dd>${pill(eligible ? `Within ${window}-day window` : `Outside ${window}-day window`, tone)}</dd>`;
      })()}<dt>Value</dt><dd>${inr(r.amount)}</dd><dt>Paid by</dt><dd>${esc(o.payment.method)}</dd><dt>Reverse shipping</dt><dd>${POLICY.reversePaidBy === 'Store' ? 'Paid by the store' : `${inr(POLICY.reverseFee)} deducted from the refund`}</dd></dl></div>
      ${Array.isArray(r.photos) && r.photos.length ? `<div class="d-sec"><h3>Customer photos</h3><div class="photo-grid">${r.photos.map((u) => `<a class="photo on img" href="${esc(u)}" target="_blank" rel="noopener" style="background-image:url('${esc(u)}')" aria-label="Open photo"></a>`).join('')}</div></div>` : ''}
      ${r.excluded ? '<p class="note n-warn">Not eligible under your returns policy, because the blouse was stitched or the piece was finished to order. The customer was shown this when she tried to request it.</p>' : ''}
      ${o.payment.method === 'Cash on delivery' ? '<p class="note n-info">This was a COD order. Razorpay cannot refund to cash, so the refund needs her bank or UPI details, which she gives when requesting the return.</p>' : ''}
      <div class="d-sec"><h3>Refund</h3><p class="small muted" style="margin:0">Processed through Razorpay to the original payment method. A GST credit note against invoice ${esc(o.invoice)} is generated with the refund.</p></div></div>
    <div class="d-foot">${foot}</div>`);
}

/* ---------- PRODUCT ---------- */
export let draftP = null;
export const setDraftP = (v) => { draftP = v; };
export const getDraftP = () => draftP;
const BLANK_PRODUCT = () => ({ id: 'new', cat: 'silk', weave: 'Kanjivaram', name: '', price: '', compareAt: '', variants: [{ id: `nv${Date.now()}`, colour: 'Maroon', hex: '#6d1b2c', size: null, stock: 1, sku: '' }], hex: '#6d1b2c', zariHex: '#c9a227', fabric: 'Pure silk', zari: 'Pure zari', border: 'Temple border', occasion: 'Wedding', length: '6.3 m', width: '1.2 m', blousePiece: true, care: '', colourNote: 'Photographed in daylight. Screens vary; the fabric may read slightly warmer in person.', modelHeight: '', drapeStyle: 'Nivi', images: 0, imageUrls: [], video: false, videoName: '', hsn: '', gst: '', status: 'Draft', reviews: 0, rating: '0', views: 0, carts: 0 });
const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };
export function readProductForm() {
  const p = draftP; if (!p || !document.getElementById('pf-name')) return;
  const set = (k, id, fn = (x) => x) => { const v = val(id); if (v !== undefined) p[k] = fn(v); };
  set('name', 'pf-name'); set('weave', 'pf-weave'); set('price', 'pf-price', (v) => (v === '' ? '' : Number(v.replace(/[^\d.]/g, '')))); set('compareAt', 'pf-compare', (v) => (v === '' ? null : Number(v.replace(/[^\d.]/g, ''))));
  set('status', 'pf-status'); set('fabric', 'pf-fabric'); set('zari', 'pf-zari'); set('border', 'pf-border'); set('blousePiece', 'pf-blouse', (v) => v === 'yes');
  // CAT-04: collect checked occasions. p.occasion (legacy string) mirrors occasions[0].
  const occs = [...document.querySelectorAll('[name="pf-occ"]:checked')].map((el) => el.value);
  if (occs.length) { p.occasions = occs; p.occasion = occs[0]; }
  else { p.occasions = []; p.occasion = ''; }
  set('length', 'pf-length'); set('width', 'pf-width'); set('modelHeight', 'pf-model'); set('drapeStyle', 'pf-drape'); set('care', 'pf-care'); set('colourNote', 'pf-colnote'); set('hsn', 'pf-hsn'); set('gst', 'pf-gst', (v) => (v === '' ? '' : Number(v)));
  // INV-02: stock is derived from pieces now, never typed in the form. No data-vstock read.
}
export function productDrawer(id) {
  let scroll = 0;
  if (id === '__redraw') { scroll = document.getElementById('drawer').querySelector('.d-body')?.scrollTop || 0; } else {
    const src = id === 'new' ? BLANK_PRODUCT() : PROD[id];
    draftP = JSON.parse(JSON.stringify(src)); draftP.imageUrls = (src.imageUrls || []).slice();
  }
  const p = draftP; const c = CAT[p.cat] || categories[0];
  const opt = (arr, v) => arr.map((o) => `<option value="${esc(ov(o))}"${String(ov(o)) === String(v) ? ' selected' : ''}>${esc(ol(o))}</option>`).join('');
  const f = (label, id_, ctl, hint = '', span = false) => `<div class="field${span ? ' span2' : ''}"><label for="${id_}">${label}</label>${ctl}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const inp = (id_, v, ph = '') => `<input class="ctl" id="${id_}" value="${esc(v ?? '')}" placeholder="${esc(ph)}">`;
  const sel = (id_, arr, v) => `<select class="ctl" id="${id_}">${opt(arr, v)}</select>`;
  const tiles = Array.from({ length: p.images }, (_, i) => p.imageUrls[i] ? `<div class="photo on img" style="background-image:url('${p.imageUrls[i]}')"><button type="button" class="photo-x" data-act="removeImage" data-i="${i}" aria-label="Remove image ${i + 1}">${icon('x', 12)}</button></div>` : `<div class="photo on" style="--b:${p.hex};--z:${p.zariHex}">Image ${i + 1}<button type="button" class="photo-x" data-act="removeImage" data-i="${i}" aria-label="Remove image ${i + 1}">${icon('x', 12)}</button></div>`).join('');
  openDrawer(`<div class="d-head">${sw(p, 'lg')}<div class="grow"><h2 class="d-title" id="dTitle">${esc(p.name || 'New product')}</h2><div style="display:flex;gap:8px;align-items:center;margin-top:6px">${pill(p.status === 'Active' ? 'Live' : p.status, p.status === 'Active' ? 'ok' : 'warn', true)}<span class="small muted">${esc(c.name)}</span></div></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body">
      <div class="d-sec"><h3>Images and video <span class="small faint">${plural(p.images, 'image')}</span></h3>
        <div class="photo-grid">${tiles}<label class="photo add" for="pf-files">${icon('plus', 18)}<span>Add images</span></label></div>
        <input type="file" id="pf-files" accept="image/*" multiple hidden>
        <p class="sub">Shown with deep zoom at the resolution you upload.</p>
        ${c.saree ? `<div class="setrow" style="margin-top:8px"><span><b>Drape video</b><span>${p.video ? esc(p.videoName || 'Uploaded') : 'Not added'}</span></span><span style="display:flex;gap:8px">${p.video ? '<button type="button" class="btn btn-ghost btn-sm" data-act="removeVideo">Remove</button>' : ''}<label class="btn btn-sec btn-sm" for="pf-video">${p.video ? 'Replace' : 'Add video'}</label></span><input type="file" id="pf-video" accept="video/*" hidden></div>` : ''}</div>
      <div class="d-sec"><h3>Basics</h3><div class="form-grid">
        ${f('Name', 'pf-name', inp('pf-name', p.name, 'Colour, weave and the defining motif'), '', true)}
        ${f('Category', 'pf-cat', sel('pf-cat', categories.map((x) => [x.id, x.name]), p.cat))}
        ${f('Weave or type', 'pf-weave', sel('pf-weave', c.weaves.includes(p.weave) ? c.weaves : [p.weave, ...c.weaves], p.weave))}
        ${f('Price, ₹, incl. GST', 'pf-price', inp('pf-price', p.price))}${f('Compare-at price, ₹', 'pf-compare', inp('pf-compare', p.compareAt || '', 'Optional'))}
        ${(() => {
          // CAT-04: at least one occasion must be picked. Multi-select checkbox group.
          const picked = new Set((p.occasions && p.occasions.length ? p.occasions : (p.occasion ? [p.occasion] : [])));
          const chips = OCCASIONS.map((o) => `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);cursor:pointer"><input type="checkbox" name="pf-occ" value="${esc(o)}"${picked.has(o) ? ' checked' : ''} style="margin:0"><span>${esc(o)}</span></label>`).join('');
          return f('Occasions', 'pf-occ', `<div id="pf-occ" style="display:flex;flex-wrap:wrap;gap:8px">${chips}</div>`, 'At least one required. Multiple allowed.', true);
        })()}
        ${f('Status', 'pf-status', sel('pf-status', [['Active', 'Live'], 'Draft', 'Hidden'], p.status))}</div></div>
      <div class="d-sec"><h3>Colour variants and stock <button type="button" class="btn btn-sec btn-sm" data-act="addVariant">${icon('plus')}Add colour</button></h3>
        <p class="small muted" style="margin:-2px 0 10px">Stock is read-only here. Every piece is barcoded; add stock through <b>Receive stock</b> on each row.</p>
        <table class="t"><thead><tr><th><span style="padding-left:0">Colour</span></th>${c.sized ? '<th><span>Size</span></th>' : ''}<th><span>SKU</span></th><th class="r"><span>In stock</span></th><th></th></tr></thead><tbody>
        ${p.variants.map((v, i) => `<tr><td style="padding-left:0"><span class="who">${swv(v, p)}<span>${esc(v.colour)}</span></span></td>${c.sized ? `<td>${esc(v.size || '—')}</td>` : ''}<td class="muted">${esc(v.sku || 'Assigned on save')}</td><td class="r"><span class="strong">${nf.format(v.stock || 0)}</span></td><td class="r" style="padding-right:0"><button type="button" class="btn btn-sec btn-sm" data-act="receiveStock" data-i="${i}" ${v.sku ? '' : 'disabled title="Save the product first to assign a SKU"'}>Receive stock</button>${p.variants.length > 1 ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="removeVariant" data-i="${i}" aria-label="Remove ${esc(v.colour)}">${icon('x', 14)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      ${c.saree ? `<div class="d-sec"><h3>Weave and zari panel</h3><div class="form-grid">
        ${f('Fabric', 'pf-fabric', inp('pf-fabric', p.fabric))}${f('Zari', 'pf-zari', sel('pf-zari', ['Pure zari', 'Tested zari', 'No zari'], p.zari || 'No zari'))}
        ${f('Border', 'pf-border', sel('pf-border', BORDERS, p.border || 'No border'))}${f('Blouse piece', 'pf-blouse', sel('pf-blouse', [['yes', 'Included, offer stitching'], ['no', 'Not included']], p.blousePiece ? 'yes' : 'no'), 'Stitching is offered at checkout only when included')}
        ${f('Saree length', 'pf-length', inp('pf-length', p.length))}${f('Saree width', 'pf-width', inp('pf-width', p.width))}
        ${f('Model height', 'pf-model', inp('pf-model', p.modelHeight))}${f('Drape style shown', 'pf-drape', sel('pf-drape', ['Nivi', 'Bengali', 'Gujarati', 'Maharashtrian'], p.drapeStyle || 'Nivi'))}</div></div>` : ''}
      <div class="d-sec"><h3>Fabric, care and colour</h3><div class="form-grid">
        ${f('Care instructions', 'pf-care', `<textarea class="ctl" id="pf-care">${esc(p.care)}</textarea>`, '', true)}
        ${f('Colour accuracy note', 'pf-colnote', `<textarea class="ctl" id="pf-colnote">${esc(p.colourNote)}</textarea>`, 'Shown beside the gallery', true)}</div></div>
      ${(() => {
        const rec = computeGstRate(p.hsn, p.price);
        const hasOverride = p.gst !== '' && p.gst != null;
        const overrideNum = Number(p.gst);
        const hint = rec != null
          ? (hasOverride && overrideNum !== rec
              ? `Recommended ${rec}% from HSN ${esc(p.hsn)} and price. Your override ${overrideNum}% will be used — confirm this is intentional.`
              : `Recommended ${rec}% from HSN ${esc(p.hsn)} and price (stitched apparel above Rs. 2,500 is 18% since 22 Sep 2025). Leave blank to use the recommendation.`)
          : 'Confirm the rate with your accountant.';
        // CAT-03: HSN suggestions based on fabric. Shown as a hint under the HSN field.
        const fab = (p.fabric || '').toLowerCase();
        const sug = fab.includes('silk') ? '5007 (silk fabrics)'
          : fab.includes('cotton') ? '5208 or 5212 (cotton woven fabrics)'
          : fab.includes('polyester') || fab.includes('synthetic') ? '5407 (synthetic woven fabrics)'
          : p.cat === 'lehenga' ? '6204 (women’s suits/ensembles/dresses)'
          : p.cat === 'acc' ? '7117 (imitation jewellery)'
          : null;
        const hsnHint = sug ? `Suggested: ${sug}` : 'Enter the 4- or 8-digit HSN.';
        return `<div class="d-sec"><h3>GST</h3><div class="form-grid">${f('HSN code', 'pf-hsn', inp('pf-hsn', p.hsn), hsnHint)}${f('GST rate, %', 'pf-gst', inp('pf-gst', p.gst), hint)}</div></div>`;
      })()}
      <p class="note n-bad" id="pf-error" role="alert" hidden></p>
    </div>
    <div class="d-foot"><button type="button" class="btn btn-sec" data-act="discardProduct">Discard</button><button type="button" class="btn btn-pri" data-act="publishProduct">Save and update store</button></div>`);
  if (scroll) document.getElementById('drawer').querySelector('.d-body').scrollTop = scroll;
}

/* ---------- CATEGORY ---------- */
export function categoryDrawer(id) {
  const c = id === 'new' ? { id: 'new', name: '', story: '', weaves: [], weight: 400, visible: true, saree: false, image: '' } : CAT[id];
  // Local draft for image URL so saveCategory can read it back (new categories have no CAT[id] yet).
  categoryDrawer.image = c.image || '';
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">${esc(c.name || 'New category')}</h2><p class="small muted" style="margin:4px 0 0">${id === 'new' ? 'Inherits the standard filters and product template' : `${products.filter((p) => p.cat === c.id).length} products`}</p></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body"><div class="form-grid">
      <div class="field span2"><label for="cat-name">Name</label><input class="ctl" id="cat-name" value="${esc(c.name)}" placeholder="For example: Kidswear"></div>
      <div class="field span2"><label>Category image</label>
        <div class="cat-img-row">
          <div class="cat-img-preview" id="cat-img-preview">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="muted small">No image yet</span>`}</div>
          <div style="display:flex;gap:8px;align-items:center">
            <label class="btn btn-sec btn-sm" for="cat-image">${c.image ? 'Replace' : 'Upload'}</label>
            <input type="file" id="cat-image" accept="image/*" hidden data-cat="${esc(id)}">
            ${c.image ? `<button type="button" class="btn btn-ghost btn-sm" data-act="removeCategoryImage">Remove</button>` : ''}
          </div>
        </div>
        <span class="hint">Shown at the top of the category landing page and on the home grid.</span>
      </div>
      <div class="field span2"><label for="cat-story">Landing page story</label><textarea class="ctl" id="cat-story" placeholder="A line or two about what this aisle is for">${esc(c.story)}</textarea><span class="hint">Shown at the top of the category page</span></div>
      <div class="field span2"><label for="cat-weaves">Weaves and types</label><input class="ctl" id="cat-weaves" value="${esc(c.weaves.join(', '))}" placeholder="Comma separated"><span class="hint">These become the weave filter on the category page</span></div>
      <div class="field"><label for="cat-weight">Default shipping weight, grams</label><input class="ctl" id="cat-weight" value="${c.weight}" inputmode="numeric"></div>
      <div class="field"><label for="cat-saree">Product template</label><select class="ctl" id="cat-saree"><option value="no"${c.saree ? '' : ' selected'}>Standard</option><option value="yes"${c.saree ? ' selected' : ''}>Saree, with weave and zari panel</option></select></div>
    </div><p class="note n-bad" id="cat-error" role="alert" hidden style="margin-top:14px"></p></div>
    <div class="d-foot"><button type="button" class="btn btn-pri" data-act="saveCategory" data-id="${c.id}">Save category</button></div>`);
}
categoryDrawer.image = '';

/* ---------- CUSTOMER ---------- */
export function customerDrawer(id) {
  const c = CUST[id];
  if (!c) return notFoundDrawer('Customer', id);
  // CUS-03: filter out orders that were purged. Keeps the drawer from crashing
  // on any downstream access like ORD[x].items or .placed.
  const os = (c.orders || []).map((x) => ORD[x]).filter(Boolean);
  const cr = returns.filter((r) => r.cid === id);
  openDrawer(`<div class="d-head"><span class="avatar ${avc(c.name)}" style="width:48px;height:48px;font-size:15px">${esc(initials(c.name))}</span><div class="grow"><h2 class="d-title" id="dTitle">${esc(c.name)}</h2><div style="display:flex;gap:8px;align-items:center;margin-top:6px">${seg(c.segment)}<span class="small muted">Customer since ${esc(fmtD(c.since))}, came from ${esc(c.source)}</span></div></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body">
      <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:20px"><div class="kpi"><div class="kpi-label">Total spend</div><div class="kpi-val" style="font-size:1.25rem">${inr(c.ltv)}</div></div><div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-val" style="font-size:1.25rem">${c.orderCount}</div></div><div class="kpi"><div class="kpi-label">Last purchase</div><div class="kpi-val" style="font-size:1.25rem">${c.lastOrder ? esc(dmF.format(new Date(c.lastOrder))) : '—'}</div></div></div>
      <div class="d-sec"><h3>Contact</h3><dl class="kv"><dt>Phone</dt><dd>${esc(c.phone)}</dd><dt>Email</dt><dd>${esc(c.email)}</dd><dt>Addresses</dt><dd>${c.addresses} saved, ${esc(c.city)}, ${esc(c.state)}</dd></dl></div>
      <div class="d-sec"><h3>Weave and occasion tags</h3><div class="tags">${c.weaves.map((w) => `<span class="tag pri">${esc(w)}</span>`).join('')}${c.occasions.map((o) => `<span class="tag zari">${esc(o)}</span>`).join('')}${!c.weaves.length ? '<span class="small muted">Added automatically from her orders.</span>' : ''}</div></div>
      ${'' /* <div class="d-sec"><h3>Blouse measurement profiles</h3>${c.profiles.length ? `<div class="scroll" style="border:1px solid var(--line);border-radius:var(--r-md)"><table class="t"><thead><tr><th><span>Inches</span></th>${c.profiles.map((p) => `<th class="r"><span>${esc(p.who)}</span></th>`).join('')}</tr></thead><tbody>${M_FIELDS.map(([k, l]) => `<tr><td>${l}</td>${c.profiles.map((p) => `<td class="r">${p[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="sub">Saved by her in her account. Used for one-tap stitching at checkout.</p>` : '<p class="small muted" style="margin:0">She hasn’t saved any measurements yet.</p>'}</div> */}
      <div class="d-sec"><h3>Notes <button type="button" class="link small" data-act="addNote" data-id="${c.id}">Add note</button></h3>${c.notes.length ? `<ul class="list">${c.notes.map((n) => `<li><span class="grow">${esc(n.text)}<span class="sub">${esc(fmtD(n.at))}</span></span></li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">No notes yet. For example: “prefers lighter zari”.</p>'}</div>
      <div class="d-sec"><h3>Payments</h3><dl class="kv"><dt>Paid online</dt><dd>${c.payments.paid}</dd><dt>Cash on delivery</dt><dd>${c.payments.cod}</dd><dt>Refunded</dt><dd>${c.payments.refunded}</dd><dt>Pending</dt><dd>${c.payments.pending}</dd></dl></div>
      <div class="d-sec"><h3>History</h3>${os.length ? `<ul class="list">${os.map((o) => `<li><span class="grow"><button type="button" class="link" data-open="order:${o.id}">${o.id}</button><span class="sub">${esc(fmtD(o.placed))}, ${esc(o.items.map((it) => PROD[it.pid].weave).join(', '))}</span></span>${pill(o.status, ORDER_TONE[o.status])}<span class="strong">${inr(o.total)}</span></li>`).join('')}${cr.map((r) => `<li><span class="grow">Return ${esc(r.id)}<span class="sub">${esc(r.reason)}</span></span>${pill(r.status, RET_TONE[r.status])}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">No orders yet.</p>'}</div>
      ${(() => {
        // CUS-03: wishlists in prod data hold IDs of products that were later deleted.
        // Silently skip missing products so the drawer never crashes on one bad ref.
        const live = (c.wishlist || []).map((pid) => ({ pid, p: PROD[pid] })).filter(({ p }) => p);
        const removed = (c.wishlist || []).length - live.length;
        if (!live.length && !removed) return '';
        const removedNote = removed ? `<p class="small muted">${plural(removed, 'saved item')} no longer in the catalogue.</p>` : '';
        return `<div class="d-sec"><h3>Saved items</h3>${removedNote}<ul class="list">${live.map(({ p }) => `<li>${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${inr(p.price)}${stockOf(p) ? '' : ', sold out'}</span></span></li>`).join('')}</ul></div>`;
      })()}
    </div>`);
}

/* ---------- ARTICLE ---------- */
export function articleDrawer(id) {
  const j = journal.find((x) => x.id === id) || { id: 'new', title: '', type: 'Weave guide', status: 'Draft', slug: '', seoTitle: '', seoDesc: '', body: '', cover: '', date: iso(addDays(TODAY, 7)) };
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">${esc(j.title || 'New article')}</h2><div style="margin-top:6px">${pill(j.status, j.status === 'Published' ? 'ok' : j.status === 'Scheduled' ? 'info' : 'warn', true)}</div></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body"><div class="form-grid">
      <div class="field span2"><label for="aj-title">Title</label><input class="ctl" id="aj-title" value="${esc(j.title)}"></div>
      <div class="field"><label for="aj-type">Type</label><select class="ctl" id="aj-type">${['Draping guide', 'Weave guide', 'Zari care', 'Lookbook'].map((t) => `<option${t === j.type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Cover image</span><span style="display:flex;gap:10px;align-items:center">${j.cover ? `<img src="${j.cover}" alt="" style="width:64px;height:40px;object-fit:cover;border-radius:4px">` : ''}<label class="btn btn-sec btn-sm" for="aj-cover">${j.cover ? 'Replace' : 'Upload'}</label><input type="file" id="aj-cover" accept="image/*" hidden data-article="${j.id}"></span></div>
      <div class="field span2"><label for="aj-body">Article</label><textarea class="ctl" id="aj-body" style="min-height:220px" placeholder="Write the article.">${esc(j.body || '')}</textarea></div>
    </div>
    <div class="d-sec" style="margin-top:22px"><h3>Search engines</h3><div class="form-grid">
      <div class="field span2"><label for="aj-slug">Page address</label><input class="ctl" id="aj-slug" value="${esc(j.slug)}" placeholder="Filled from the title"><span class="hint">houseofgnanrudh.com/journal/…</span></div>
      <div class="field span2"><label for="aj-seot">Search title</label><input class="ctl" id="aj-seot" value="${esc(j.seoTitle)}"><span class="hint" id="aj-seot-n">${j.seoTitle.length} of about 60 characters</span></div>
      <div class="field span2"><label for="aj-seod">Search description</label><textarea class="ctl" id="aj-seod" placeholder="One or two sentences shown under the title in Google">${esc(j.seoDesc)}</textarea><span class="hint" id="aj-seod-n">${j.seoDesc.length} of about 155 characters</span></div>
      <div class="field"><label for="aj-date">Publish date, for scheduling</label><input class="ctl" type="date" id="aj-date" value="${esc(j.date)}"></div></div></div>
      <p class="note n-bad" id="aj-error" role="alert" hidden></p></div>
    <div class="d-foot"><button type="button" class="btn btn-sec" data-act="saveArticle" data-id="${j.id}" data-mode="Draft">Save draft</button><button type="button" class="btn btn-sec" data-act="saveArticle" data-id="${j.id}" data-mode="Scheduled">Schedule</button><button type="button" class="btn btn-pri" data-act="saveArticle" data-id="${j.id}" data-mode="Published">Publish</button></div>`);
}
articleDrawer.cover = '';

/* ---------- PAGE (CMS) ---------- */
export function pageDrawer(i) {
  const p = PAGES_CMS[i];
  const bodyLen = (p.body || '').trim().length;
  const stub = bodyLen < 800;
  const stubWarn = stub ? `<p class="note n-warn" style="margin-top:0">This page is currently ${bodyLen} characters. Aim for at least 800 characters so it reads as a real policy to customers and search engines.</p>` : '';
  const isReturns = /return/i.test(p.name);
  const tokenHelp = isReturns
    ? '<p class="small muted" style="margin:4px 0 0">You can use <code>{{returnWindow}}</code>, <code>{{returnConditions}}</code> and <code>{{reverseShippingRule}}</code> — they render using the latest Settings so you never have to edit this page when the policy changes.</p>'
    : '<p class="small muted" style="margin:4px 0 0">Markdown is supported: <b># Heading</b>, <b>**bold**</b>, <b>- list</b>, <b>[link](url)</b>. The storefront renders it as HTML.</p>';
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">${esc(p.name)}</h2><p class="small muted" style="margin:4px 0 0">Last updated ${esc(fmtD(p.updated))}</p></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body">${stubWarn}<div class="field"><label for="pg-body">Page text</label><textarea class="ctl" id="pg-body" style="min-height:420px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px">${esc(p.body)}</textarea><span class="hint">${esc(p.desc)}</span>${tokenHelp}</div></div>
    <div class="d-foot"><button type="button" class="btn btn-pri" data-act="savePage" data-i="${i}">Save page</button></div>`);
}

/* ---------- FEATURED PICKER ---------- */
export function featuredDrawer() {
  const picked = new Set(featured);
  const list = (q, cat) => products.filter((p) => p.status === 'Active' && (!cat || p.cat === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 60);
  const rows = (q = '', cat = '') => list(q, cat).map((p) => `<li><input type="checkbox" data-feat="${p.id}" ${picked.has(p.id) ? 'checked' : ''} aria-label="Feature ${esc(p.name)}">${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${esc(CAT[p.cat].name)}, ${inr(p.price)}</span></span></li>`).join('') || '<li class="muted">No products match.</li>';
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">Featured weaves</h2><p class="small muted" style="margin:4px 0 0" id="feat-count">${picked.size} selected</p></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body"><div style="display:flex;gap:8px;margin-bottom:12px"><div class="search" style="flex:1">${icon('search')}<input class="ctl" id="feat-q" placeholder="Search live products" aria-label="Search live products"></div><select class="ctl" id="feat-cat" style="width:200px" aria-label="Category"><option value="">All categories</option>${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <ul class="list" id="feat-list">${rows()}</ul></div>
    <div class="d-foot"><button type="button" class="btn btn-pri" data-act="saveFeatured">Save featured</button></div>`);
  const refresh = () => { document.getElementById('feat-list').innerHTML = rows(document.getElementById('feat-q').value, document.getElementById('feat-cat').value); };
  document.getElementById('feat-q').oninput = refresh; document.getElementById('feat-cat').onchange = refresh;
  document.getElementById('feat-list').onchange = (e) => { const id = e.target.dataset.feat; if (!id) return; e.target.checked ? picked.add(id) : picked.delete(id); document.getElementById('feat-count').textContent = `${picked.size} selected`; };
  featuredDrawer.picked = picked;
}

/* ---------- INSIGHT ---------- */
import { hbars } from './renderers.js';
import {
  INS, AB, VERDICT, STAGES, STAGE_TONE, REC_TONE, abCarts, insList, secs, pc, ago, sumBy,
} from './insights.js';
export function insightDrawer(id) {
  const p = PROD[id]; const x = INS[id];
  const head = (t, sub) => `<div class="d-head">${p ? sw(p, 'lg') : ''}<div class="grow"><h2 class="d-title" id="dTitle">${esc(t)}</h2>${sub}</div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>`;
  if (!p) return;
  if (!x) return openDrawer(`${head(p.name, '')}<div class="d-body"><p class="empty"><strong>No data yet</strong>Insights start once the product is live and has visitors.</p></div>`);
  const [tone, advice] = VERDICT[x.verdict];
  const same = insList.filter((y) => PROD[y.id].cat === p.cat); const catTime = same.length ? sumBy(same, 'avgTime') / same.length : x.avgTime;
  const myCarts = abCarts.filter((a) => a.pids.includes(id)); const reach = myCarts.filter((a) => a.contactable && a.status === 'Not contacted');
  const funnelRows = (steps) => steps.map(([s, n], i) => `<div class="hbar"><span>${esc(s)}${i ? `<span class="sub">${(steps[i - 1][1] ? (n / steps[i - 1][1] * 100).toFixed(0) : 0)}% of the step before</span>` : ''}</span><div class="bar"><span style="width:${steps[0][1] ? (n / steps[0][1] * 100) : 0}%"></span></div><span class="strong">${nf.format(n)}</span></div>`).join('');
  openDrawer(`${head(p.name, `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">${pill(x.verdict, tone)}<span class="small muted">${esc(CAT[p.cat].name)}, ${inr(p.price)}, last 30 days</span></div>`)}
    <div class="d-body">
      <div class="note n-info">${esc(advice)}</div>
      <div class="d-sec" style="margin-top:18px"><h3>From view to payment</h3>${funnelRows([['Viewed', x.views], ['Added to cart', x.carts], ['Started checkout', x.checkouts], ['Paid', x.units]])}
        <p class="sub">${nf.format(x.removed)} removed it from the cart. ${nf.format(x.wish)} saved it to a wishlist. ${pc(x.returnRate, 0)} of buyers returned it.</p></div>
      <div class="grid g2 d-grid">
        <div class="d-sec"><h3>Price acceptance</h3><dl class="sum"><dt>Against the aisle’s middle price</dt><dd class="strong ${x.priceIdx > 1.25 ? 't-bad' : ''}">${x.priceIdx >= 1 ? '+' : ''}${Math.round((x.priceIdx - 1) * 100)}%</dd><dt>Left soon after the price</dt><dd>${pc(x.priceBounce, 0)}</dd><dt>Sales that used a coupon</dt><dd>${pc(x.couponShare, 0)}</dd><dt>Strike price shown</dt><dd>${p.compareAt ? inr(p.compareAt) : 'No'}</dd></dl></div>
        <div class="d-sec"><h3>On the page</h3><dl class="sum"><dt>Time on page</dt><dd class="strong">${secs(x.avgTime)}</dd><dt>Aisle average</dt><dd>${secs(catTime)}</dd><dt>Read weave and zari</dt><dd>${pc(x.details, 0)}</dd><dt>Reached reviews</dt><dd>${pc(x.reviewsReached, 0)}</dd><dt>Swiped photos</dt><dd>${pc(x.swipes, 0)}</dd><dt>Zoomed</dt><dd>${pc(x.zoom, 0)}</dd><dt>Played the video</dt><dd>${p.video ? pc(x.videoPlays, 0) : '<span class="t-warn">No video</span>'}</dd></dl></div>
      </div>
      <div class="d-sec"><h3>By colour</h3><ul class="list">${x.colours.map(({ v, share }) => `<li>${swv(v, p, '')}<span class="grow">${esc(v.colour)}${v.size ? `, size ${v.size}` : ''}<span class="sub">${nf.format(Math.round(x.views * share))} views, ${nf.format(Math.round(x.carts * share))} carts</span></span>${v.stock ? `<span class="small muted">${v.stock} in stock</span>` : pill('Sold out', 'bad')}</li>`).join('')}</ul></div>
      <div class="d-sec"><h3>Where viewers came from</h3>${hbars(x.sources, { fmt: (v) => `${v}%`, tone: 'zari' })}</div>
      <div class="d-sec"><h3>Carts you can act on</h3><p class="small muted" style="margin:0">${plural(myCarts.length, 'cart')} with contact details hold this product; ${reach.length} not yet reminded.</p></div>
    </div>
    <div class="d-foot"><button type="button" class="btn btn-ghost" data-open="product:${p.id}" style="margin-right:auto">Edit product</button>${reach.length ? `<button type="button" class="btn btn-pri" data-act="cartRemindProduct" data-id="${p.id}">Remind ${plural(reach.length, 'shopper')}</button>` : ''}</div>`);
}

/* ---------- CART ---------- */
export function cartDrawer(id) {
  const a = AB[id]; if (!a) return;
  const c = a.cid ? CUST[a.cid] : null; const si = STAGES.indexOf(a.stage);
  const steps = [['Viewed the product', 0.5], ['Added to cart', 0.35], ...(si >= 1 ? [['Entered the delivery address', 0.2]] : []), ...(si >= 2 ? [['Reached payment options', 0.1]] : []), ...(si === 3 ? [[`Payment failed: ${a.reason}`, 0.05]] : []), ['Left the site', 0]];
  openDrawer(`<div class="d-head"><div class="grow"><h2 class="d-title" id="dTitle">Cart ${a.id}</h2><div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">${pill(a.stage, STAGE_TONE[a.stage])}${pill(a.status, REC_TONE[a.status], true)}<span class="small muted">Left ${ago(a.hrs)}, on ${esc(a.device.toLowerCase())}</span></div></div><button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body">
      <div class="d-sec"><h3>Shopper ${c ? `<button type="button" class="link small" data-open="customer:${c.id}">View in CRM</button>` : ''}</h3>${c ? who(c.name, `${c.city}, ${c.orderCount} orders`) : `<b>Guest</b><span class="sub">${esc(a.phone || 'No contact details')}</span>`}
        <p class="sub" style="margin-top:8px">${a.optIn ? 'Agreed to WhatsApp messages.' : 'Did not agree to messages. Do not contact.'}</p></div>
      <div class="d-sec"><h3>In the cart <span class="strong">${inr(a.value)}</span></h3><ul class="list">${a.pids.map((pid) => `<li class="click" data-open="insight:${pid}" style="cursor:pointer">${sw(PROD[pid], 'sm')}<span class="grow">${esc(PROD[pid].name)}<span class="sub">${inr(PROD[pid].price)}</span></span></li>`).join('')}</ul></div>
      <div class="d-sec"><h3>What happened</h3><ol class="timeline">${steps.map(([s, back], i) => `<li class="${i === steps.length - 1 || s.startsWith('Payment failed') ? 'bad' : 'done'}">${esc(s)}<span class="sub">${esc(dtF.format(new Date(Date.now() - (a.hrs + back) * 3600e3)))}</span></li>`).join('')}</ol>
        <p class="sub">Likely reason: ${esc(a.reason)}.</p></div>
    </div>
    <div class="d-foot">${a.contactable && !['Recovered', 'Expired'].includes(a.status) ? `<button type="button" class="btn btn-pri" data-act="cartRemind" data-id="${a.id}">${a.status === 'Reminder sent' ? 'Send a second reminder' : 'Send WhatsApp reminder'}</button>` : ''}</div>`);
}

/* ---------- PIECE ---------- */
export function pieceDrawer(code) {
  const needle = String(code || '').toUpperCase();
  const u = PIECE[needle] || PIECE[code] || pieces.find((x) => (x.code || x.id) === needle);
  if (!u) return;
  const p = PROD[u.pid];
  const r = varRef(u.vid);
  const v = r?.v;
  const hist = moves.filter((m) => m.code === (u.code || u.id));
  const cat = p && CAT[p.cat];
  const params = [
    ['Product', p?.name],
    ['Category', cat?.name],
    ['Weave', p?.weave],
    ['Fabric', p?.fabric],
    ['Zari', p?.zari],
    ['Border', p?.border],
    ['Colour', v?.colour],
    ['Size', v?.size],
    ['Length', p?.length],
    ['Width', p?.width],
    ['Blouse piece', cat?.saree ? (p?.blousePiece ? 'Included' : 'Not included') : null],
    ['Occasion', p?.occasion],
    ['SKU', v?.sku],
    ['HSN', p?.hsn],
    ['MRP', p?.price != null ? inr(p.price) : null],
    ['Received', fmtD(u.received)],
  ].filter(([, x]) => x && x !== '—');

  openDrawer(`<div class="d-head">${v ? swv(v, p, 'lg') : sw(p, 'lg')}<div class="grow"><h2 class="d-title" id="dTitle">${esc(u.code || u.id)}</h2>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">${pill(u.status === 'Shipped' ? 'Sold, shipped' : u.status, PIECE_TONE[u.status], true)}${u.oid ? `<button type="button" class="link small" data-open="order:${esc(u.oid)}">Order ${esc(u.oid)}</button>` : ''}${u.printed ? '' : pill('Label not printed', 'warn')}</div></div>
      <button type="button" class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="d-body">
      <div class="bc-big">${code128(u.code || u.id, 72)}<div class="pl-code">${esc(u.code || u.id)}</div></div>
      <div class="d-sec" style="margin-top:18px"><h3>What the label says</h3><dl class="kv">${params.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl></div>
      <div class="d-sec"><h3>History</h3>${hist.length ? `<ol class="timeline">${hist.slice().reverse().map((m) => `<li class="${m.to === 'Written off' ? 'bad' : 'done'}">${esc(m.to === 'Shipped' ? 'Sold and shipped' : m.to)}: ${esc(m.note || '')}<span class="sub">${esc(dtF.format(new Date(m.at)))}, ${esc(m.by)}</span></li>`).join('')}</ol>` : `<p class="small muted" style="margin:0">In stock since ${esc(fmtD(u.received))}.</p>`}</div>
    </div>
    <div class="d-foot"><button type="button" class="btn btn-ghost" data-act="printPiece" data-id="${esc(u.code || u.id)}" style="margin-right:auto">${icon('barcode')}Print label</button>${u.status === 'Returned' ? `<button type="button" class="btn btn-pri" data-act="pieceRestock" data-id="${esc(u.code || u.id)}">Inspected, back to stock</button>` : ''}${['In stock', 'Returned'].includes(u.status) ? `<button type="button" class="btn btn-bad" data-act="pieceWriteOff" data-id="${esc(u.code || u.id)}">Write off</button>` : ''}</div>`);
}

/* ---------- Entity router ---------- */
export function openEntity(ref) {
  const [kind, id] = ref.split(':');
  ({ order: orderDrawer, product: productDrawer, customer: customerDrawer, return: returnDrawer, article: articleDrawer, insight: insightDrawer, cart: cartDrawer, piece: pieceDrawer })[kind]?.(id);
}
