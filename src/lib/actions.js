// Actions, modal dialog (ask), toast, exports, palette rendering.
import {
  esc, pill, nf, inr, fmtD, iso, TODAY, plural, ov, ol, icon, pick, between, pct,
  initials, avc, who, rel, daysFrom,
} from './utils.js';
import {
  categories, CAT, COLORS, OCCASIONS, OCCASIONS_FULL, SIZES, products, PROD, customers, CUST,
  orders, ORD, jobs, STITCH_STAGES, returns, POLICY, shipLog, COURIERS, coupons,
  reviews, journal, SCENES, PAGES_CMS, SETTINGS, CRM, featured, setFeatured,
  bumpInv, bumpCn, computeCRM, PRICE_RANGES,
  pieces, PIECE, varRef, refresh,
} from './data.js';
import { ORDER_TONE, PAY_TONE, RET_TONE, sw, swv, prodCell, variantOf, seg, LV, lvSelected } from './renderers.js';
import {
  closeDrawer, orderDrawer, returnDrawer, productDrawer, categoryDrawer, customerDrawer, articleDrawer, pageDrawer, featuredDrawer,
  getDraftP, readProductForm, insightDrawer, cartDrawer, openEntity,
} from './drawers.js';
import { openDoc, docInvoice, docLabel, labelHTML, docPackSlip } from './docs.js';
import {
  setDashRange, setSetTab, getSetTab, setBcTab, setLabelFmt, getLabelFmt, LABEL_FMT,
  getPack, setPackFb, packStartScan, packCancelLocal, recordShipped, packDone, scanStats,
} from './pages.js';
import { bySku, findOrder, findPiece, beep } from './scanner.js';
import { setInsTab, setInsCat, abCarts, AB } from './insights.js';
import { api } from './api.js';

/* Fire-and-forget: run an API call in the background, toast on failure. */
const sync = (promise, label) => Promise.resolve().then(() => promise).catch((err) => toast(`Failed to ${label || 'save'}: ${err.message}`));

const CHECK_ACTS = ['toggleCoupon', 'toggleCat'];

/* ---------- Toast ---------- */
export function toast(m) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = m;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

/* ---------- Modal (ask) ---------- */
export function ask({ title, text = '', ok, danger, fields = [], preview }) {
  const dlg = document.getElementById('dlg');
  document.getElementById('dlgTitle').textContent = title;
  const t = document.getElementById('dlgText');
  t.textContent = text; t.hidden = !text;
  const okBtn = document.getElementById('dlgOk');
  okBtn.textContent = ok; okBtn.className = `btn ${danger ? 'btn-bad' : 'btn-pri'}`;
  const colorHtml = (f) => {
    const initial = (f.value || '#1f5f7a').toLowerCase();
    return `<div class="color-pick"><input type="color" id="f-${f.id}" value="${esc(initial)}"><output class="color-hex" id="f-${f.id}-hex" for="f-${f.id}">${esc(initial.toUpperCase())}</output></div>`;
  };
  document.getElementById('dlgFields').innerHTML = fields.map((f) => `<div class="field" style="margin-top:14px"><label for="f-${f.id}">${esc(f.label)}</label>${f.type === 'color' ? colorHtml(f) : f.type === 'select' ? `<select class="ctl" id="f-${f.id}">${f.options.map((o) => `<option value="${esc(ov(o))}">${esc(ol(o))}</option>`).join('')}</select>` : f.type === 'area' ? `<textarea class="ctl" id="f-${f.id}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>` : `<input class="ctl" id="f-${f.id}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}">`}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`).join('');
  const vals = () => Object.fromEntries(fields.map((f) => [f.id, document.getElementById(`f-${f.id}`).value]));
  const runPreview = () => { document.getElementById('dlgPreview').innerHTML = preview ? `<div style="margin-top:14px">${preview(vals())}</div>` : ''; };
  fields.filter((f) => f.type === 'color').forEach((f) => {
    const input = document.getElementById(`f-${f.id}`);
    const hexOut = document.getElementById(`f-${f.id}-hex`);
    input.addEventListener('input', () => { hexOut.textContent = input.value.toUpperCase(); runPreview(); });
  });
  document.getElementById('dlgFields').oninput = runPreview; runPreview();
  dlg.showModal();
  (fields[0] ? document.getElementById(`f-${fields[0].id}`) : okBtn).focus();
  return new Promise((res) => {
    const done = (v) => { cleanup(); if (dlg.open) dlg.close(); res(v); };
    const okH = () => { const v = vals(); const miss = fields.find((f) => f.required && !v[f.id].trim()); if (miss) { document.getElementById(`f-${miss.id}`).setAttribute('aria-invalid', 'true'); document.getElementById(`f-${miss.id}`).focus(); return; } done(fields.length ? v : true); };
    const cancelH = () => done(null);
    const escH = () => { cleanup(); res(null); };
    function cleanup() { okBtn.removeEventListener('click', okH); document.getElementById('dlgCancel').removeEventListener('click', cancelH); dlg.removeEventListener('cancel', escH); document.getElementById('dlgFields').oninput = null; }
    okBtn.addEventListener('click', okH); document.getElementById('dlgCancel').addEventListener('click', cancelH); dlg.addEventListener('cancel', escH);
  });
}

/* ---------- Palette search ---------- */
export let palSel = 0, palItems = [];
export function renderPalette(q) {
  const s = q.trim().toLowerCase();
  const res = [];
  if (s) {
    orders.filter((o) => `${o.id} ${CUST[o.cid].name} ${CUST[o.cid].phone} ${o.ship.awb || ''} ${o.payment.rzp || ''}`.toLowerCase().includes(s)).slice(0, 5).forEach((o) => res.push(['Orders', `order:${o.id}`, `<span class="grow"><b>${o.id}</b><span class="sub">${esc(CUST[o.cid].name)}, ${inr(o.total)}</span></span>${pill(o.status, ORDER_TONE[o.status])}`]));
    products.filter((p) => `${p.name} ${p.weave} ${p.variants.map((v) => v.sku).join(' ')}`.toLowerCase().includes(s)).slice(0, 5).forEach((p) => res.push(['Products', `product:${p.id}`, `${sw(p, 'sm')}<span class="grow"><b>${esc(p.name)}</b><span class="sub">${esc(CAT[p.cat].name)}, ${inr(p.price)}</span></span>`]));
    customers.filter((c) => `${c.name} ${c.phone} ${c.email} ${c.city}`.toLowerCase().includes(s)).slice(0, 5).forEach((c) => res.push(['Customers', `customer:${c.id}`, `<span class="avatar ${avc(c.name)}">${esc(initials(c.name))}</span><span class="grow"><b>${esc(c.name)}</b><span class="sub">${esc(c.city)}, ${c.orderCount} orders</span></span>${seg(c.segment)}`]));
  } else [['Go to', '/orders', '<span class="grow"><b>Open orders</b></span>'], ['Go to', '/returns', '<span class="grow"><b>Returns to review</b></span>'], ['Go to', '/insights', '<span class="grow"><b>Product insights</b></span>']].forEach((x) => res.push(x));
  palItems = res; palSel = 0;
  let last = '';
  document.getElementById('palRes').innerHTML = res.length ? res.map(([g, ref, html], i) => { const head = g !== last ? `<div class="pal-grp">${g}</div>` : ''; last = g; return `${head}<button type="button" class="pal-item" role="option" aria-selected="${i === 0}" data-pal="${i}">${html}</button>`; }).join('') : '<p class="empty" style="padding:24px"><strong>No matches</strong>Try an order number like GR10405, a SKU, a phone number or a Razorpay payment ID.</p>';
}
export function openPalette() { document.getElementById('palette').showModal(); document.getElementById('palInput').value = ''; renderPalette(''); document.getElementById('palInput').focus(); }
export function choosePalette(i, navigate) {
  const it = palItems[i]; if (!it) return;
  document.getElementById('palette').close();
  if (it[1].startsWith('/') || it[1].startsWith('#')) navigate(it[1]); else openEntity(it[1]);
}

/* ---------- CSV export ---------- */
export function downloadCSV(name, rows) {
  const csv = rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
  try {
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Downloaded ${name} with ${plural(rows.length - 1, 'row')}. It opens in Excel.`);
  } catch { toast('Your browser blocked the download. Open the admin in its own tab and try again.'); }
}
const EXPORTS = {
  orders: (list) => [['Order', 'Date', 'Customer', 'Phone', 'City', 'State', 'Pincode', 'Items', 'Payment method', 'Payment status', 'Razorpay ID', 'Total', 'Status', 'Courier', 'AWB', 'Invoice'], ...list.map((o) => { const c = CUST[o.cid]; return [o.id, fmtD(o.placed), c.name, c.phone, c.city, c.state, o.ship.pin, o.items.map((it) => `${PROD[it.pid].name} (${variantOf(it).colour})`).join('; '), o.payment.method, o.payment.status, o.payment.rzp || '', o.total, o.status, o.ship.courier || '', o.ship.awb || '', o.invoice || '']; })],
  customers: (list) => [['Name', 'Phone', 'Email', 'City', 'State', 'Segment', 'Orders', 'Lifetime value', 'Last purchase', 'Weaves bought', 'Occasions', 'Measurement profiles', 'Notes'], ...list.map((c) => [c.name, c.phone, c.email, c.city, c.state, c.segment, c.orderCount, c.ltv, c.lastOrder ? fmtD(c.lastOrder) : '', c.weaves.join('; '), c.occasions.join('; '), c.profiles.map((p) => p.who).join('; '), c.notes.map((n) => n.text).join('; ')])],
  products: (list) => [['Name', 'Category', 'Weave', 'Colour', 'Size', 'SKU', 'Stock', 'Price', 'HSN', 'GST %', 'Status'], ...list.flatMap((p) => p.variants.map((v) => [p.name, CAT[p.cat].name, p.weave, v.colour, v.size || '', v.sku, v.stock, p.price, p.hsn, p.gst, p.status]))],
};
const LIST_SRC = { orders: () => orders, customers: () => customers, products: () => products };
const BYID = { orders: ORD, customers: CUST, products: PROD };
function exportList(route, listId, onlySelected) {
  const target = listId || route;
  const ids = onlySelected ? lvSelected(target) : null;
  const rows = ids ? ids.map((id) => BYID[target][id]) : (LV[target]?.visible || LIST_SRC[target]());
  downloadCSV(`${target}-${iso(TODAY)}.csv`, EXPORTS[target](rows));
}

const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };

/* ---------- Product save ---------- */
function saveProduct(publish, rerender) {
  readProductForm();
  const p = getDraftP();
  const err = !p.name ? 'Give the product a name.' : !(p.price > 0) ? 'Enter a price greater than zero.' : publish && !p.images ? 'Add at least one image before publishing.' : publish && (!p.hsn || p.gst === '') ? 'Enter the HSN code and GST rate before publishing, so invoices are correct.' : null;
  if (err) { const e = document.getElementById('pf-error'); e.textContent = err; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); return; }
  if (publish) p.status = 'Active';
  p.hex = p.variants[0].hex;
  p.zariHex = p.zari === 'Pure zari' ? '#c9a227' : p.zari === 'Tested zari' ? '#b9a26a' : '#d8cfbf';
  const wasNew = p.id === 'new';
  if (wasNew) {
    // Find the next free P-ID: scan every existing product's id, strip the "P",
    // keep the largest number, add 1. Using `products.length` collides with
    // seeded IDs when gaps exist (deletes) or when the max seeded number
    // happens to equal the current length.
    const maxNum = products.reduce((m, x) => {
      const n = parseInt(String(x.id || x._id || '').replace(/^P/, ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 1000);
    p.id = `P${maxNum + 1}`; p.created = iso(TODAY); p.views = 0; p.carts = 0; p.reviews = 0; p.rating = '0';
    products.unshift(p); PROD[p.id] = p;
  } else Object.assign(PROD[p.id], p);
  PROD[p.id].variants.forEach((v, i) => { if (!v.sku) v.sku = `${p.cat.slice(0, 3).toUpperCase()}-${p.id.slice(1)}${i}`; });
  closeDrawer(); rerender();
  toast(publish ? `“${p.name}” is live on the store.` : `“${p.name}” saved${p.status === 'Active' ? ' and updated on the store' : ' as a draft'}.`);
  const payload = { ...p }; delete payload.id;
  const saveCall = wasNew ? api.products.create({ _id: p.id, ...payload }) : api.products.update(p.id, payload);
  // After save, reconcile pieces to match the typed per-variant stock counts:
  // the backend spawns missing pieces (with fresh labels to print) or writes off
  // extras. Keeps the Products page stock and the Barcodes page piece count in sync.
  // On failure, roll back the optimistic insert so the ghost row doesn't linger.
  saveCall
    .then(() => api.pieces.reconcile(p.id))
    .then(() => Promise.all([refresh('pieces'), refresh('movements'), refresh('products')]))
    .then(() => rerender())
    .catch((err) => {
      if (wasNew) {
        const i = products.findIndex((x) => x.id === p.id);
        if (i >= 0) products.splice(i, 1);
        delete PROD[p.id];
        rerender();
      }
      toast(`Failed to save product: ${err.message}`);
    });
}

/* ---------- Settings save ---------- */
function saveSettings(rerender) {
  const err = (m) => { const e = document.getElementById('set-error'); e.textContent = m; e.hidden = false; };
  const num = (id) => Number(String(val(id)).replace(/[^\d.]/g, ''));
  const S_ = SETTINGS;
  const setTab = getSetTab();
  if (setTab === 'store') {
    if (!val('st-name')) return err('Enter the store name.');
    if (!/^\S+@\S+\.\S+$/.test(val('st-email'))) return err('Enter a valid email address.');
    Object.assign(S_.store, { name: val('st-name'), site: val('st-site'), phone: val('st-phone'), email: val('st-email'), address: val('st-addr') });
    const bn = document.getElementById('brandName'); if (bn) bn.textContent = S_.store.name;
    sync(api.settings.patch('store', S_.store), 'save store details');
  }
  if (setTab === 'payments') {
    Object.keys(S_.pay.methods).forEach((m) => { S_.pay.methods[m] = document.getElementById(`pm-${m}`).checked; });
    if (!Object.values(S_.pay.methods).some(Boolean) && !document.getElementById('pm-cod').checked) return err('Keep at least one way to pay switched on.');
    S_.pay.cod = document.getElementById('pm-cod').checked; S_.pay.codCap = val('pm-cap') ? num('pm-cap') : null;
    sync(api.settings.patch('pay', S_.pay), 'save payments');
  }
  if (setTab === 'shipping') {
    const bad = [...document.querySelectorAll('[data-weight]')].find((el) => !(Number(el.value) > 0));
    if (bad) return err('Every category needs a weight above zero.');
    const weightUpdates = [];
    document.querySelectorAll('[data-weight]').forEach((el) => { CAT[el.dataset.weight].weight = Number(el.value); weightUpdates.push([el.dataset.weight, Number(el.value)]); });
    S_.ship.packaging = num('sh-pack') || 0; S_.ship.freeAbove = num('sh-free') || 0;
    sync(api.settings.patch('ship', S_.ship), 'save shipping');
    weightUpdates.forEach(([id, weight]) => sync(api.categories.update(id, { weight }), 'save category weight'));
  }
  if (setTab === 'gst') {
    if (!/^\d{2}[A-Z0-9]{13}$/.test(val('gs-gstin').toUpperCase())) return err('A GSTIN is 15 characters: 2 digits for the state, then 13 letters and numbers.');
    Object.assign(S_.gst, { gstin: val('gs-gstin').toUpperCase(), inv: val('gs-inv'), cn: val('gs-cn') });
    sync(api.settings.patch('gst', S_.gst), 'save GST');
  }
  if (setTab === 'returns') {
    const w = num('rp-window'); if (!(w >= 0 && w <= 60)) return err('Set a return window between 0 and 60 days.');
    Object.assign(POLICY, { window: w, excludeStitched: document.getElementById('rp-stitch').checked, excludeFalls: document.getElementById('rp-falls').checked, excludeCustom: document.getElementById('rp-custom').checked, reversePaidBy: val('rp-payer'), reverseFee: num('rp-fee') || 0 });
    sync(api.settings.patch('policy', POLICY), 'save returns policy');
  }
  if (setTab === 'crm') {
    const v = num('crm-vip'), r = num('crm-rep'), d = num('crm-dorm');
    if (!(v > 0 && r >= 2 && d >= 30)) return err('VIP spend must be above zero, Repeat at least 2 orders, and Dormant at least 30 days.');
    Object.assign(CRM, { vip: v, repeatOrders: r, dormantDays: d }); computeCRM();
    sync(api.settings.patch('crm', CRM), 'save CRM thresholds');
  }
  if (setTab === 'account') {
    if (!/^\S+@\S+\.\S+$/.test(val('ac-email'))) return err('Enter a valid email address.');
    S_.account.email = val('ac-email');
    sync(api.settings.patch('account', S_.account), 'save account');
  }
  rerender(); toast(setTab === 'crm' ? 'Saved. Every customer has been re-tagged.' : 'Settings saved.');
}

/* ---------- Factory: build the actions table given rerender/renderNav/renderPage/navigate ---------- */
export function buildActions({ rerender, renderPage, renderNav, navigate, routeRef }) {
  const selectedOrders = () => lvSelected('orders').map((id) => ORD[id]);

  // WhatsApp cart-reminder flow used by the insights "Abandoned carts" tab + insight drawer.
  async function sendReminder(list, after) {
    const ok = list.filter((a) => a && a.contactable && !['Recovered', 'Expired'].includes(a.status));
    if (!ok.length) return toast('None of these shoppers can be reminded: they did not opt in, have already paid, or the cart is over 7 days old.');
    const second = ok.some((a) => a.status === 'Reminder sent');
    const first = ok[0]; const name = first.cid ? CUST[first.cid].name.split(' ')[0] : '';
    const v = await ask({
      title: ok.length === 1 ? 'Send a cart reminder' : `Remind ${plural(ok.length, 'shopper')}`,
      text: `Sent on WhatsApp with the approved cart-reminder template.${list.length > ok.length ? ` ${plural(list.length - ok.length, 'shopper')} skipped: not opted in, already paid or over 7 days old.` : ''}`,
      ok: 'Send',
      fields: [{ id: 'coupon', label: second ? 'Coupon (needed for a second reminder)' : 'Add a coupon', type: 'select', options: [...(second ? [] : [['', 'No coupon']]), ...coupons.filter((c) => c.on).map((c) => [c.code, `${c.code}, ${c.kind === 'Percent' ? `${c.value}% off` : `${inr(c.value)} off`}, on orders over ${inr(c.min)}`])] }],
      preview: (vals) => `<div class="note n-info">Hi${name ? ` ${esc(name)}` : ''}, you left ${esc(PROD[first.pids[0]].name)} in your cart at House of GnanRudh. It’s still there for you: houseofgnanrudh.com/cart${vals.coupon ? ` Use ${esc(vals.coupon)} at checkout.` : ''}</div>`,
    });
    if (!v) return;
    const cp = coupons.find((c) => c.code === v.coupon);
    let noCoupon = 0;
    ok.forEach((a) => { a.status = 'Reminder sent'; a.coupon = cp && a.value >= cp.min ? cp.code : null; if (cp && !a.coupon) noCoupon += 1; });
    toast(`${plural(ok.length, 'reminder')} sent on WhatsApp.${noCoupon ? ` ${noCoupon} went without the coupon: cart below its minimum.` : ''}`);
    if (LV.carts) LV.carts.sel.clear();
    renderPage(); renderNav(); after?.();
  }

  return {
    closeDrawer: () => closeDrawer(),
    dashRange: (el) => { setDashRange(Number(el.dataset.v)); renderPage(); },
    setTab: (el) => { setSetTab(el.dataset.v); renderPage(); },
    insTab: (el) => { setInsTab(el.dataset.v); renderPage(); try { window.scrollTo(0, 0); } catch { /* ignore */ } },
    insCat: (el) => { setInsCat(el.dataset.v); renderPage(); },
    insVerdict: (el) => { LV.insights ||= { tab: 'all', q: '', sort: { key: 'revenue', dir: 'desc' }, sel: new Set(), f: {} }; LV.insights.tab = el.dataset.v; setInsTab('products'); renderPage(); },
    cartRemind: (el) => sendReminder([AB[el.dataset.id]], () => cartDrawer(el.dataset.id)),
    cartRemindBulk: () => sendReminder(lvSelected('carts').map((id) => AB[id])),
    cartRemindProduct: (el) => sendReminder(abCarts.filter((a) => a.pids.includes(el.dataset.id) && a.status === 'Not contacted'), () => insightDrawer(el.dataset.id)),
    setTabLink: (el, e) => { e.preventDefault(); setSetTab(el.dataset.v); navigate('/settings'); },
    viewStore: (el, e) => { e.preventDefault(); toast(`The storefront is at ${SETTINGS.store.site}. It isn’t part of this admin prototype.`); },
    exportExcel: (el) => exportList(routeRef.current, el.dataset.what === 'segment' ? 'customers' : el.dataset.what),
    exportSelected: () => exportList(routeRef.current, null, true),
    invoice: (el) => { const o = ORD[el.dataset.id]; openDoc(`Tax invoice ${o.invoice}`, docInvoice(o) + (o.creditNote ? docInvoice(o, true) : '')); },
    printLabel: (el) => { const o = ORD[el.dataset.id]; openDoc(`Shipping label, ${o.id}`, docLabel(o)); },
    bulkLabels: () => { const list = selectedOrders().filter((o) => o.ship.awb); if (!list.length) return toast('None of the selected orders has a label yet. Labels are generated when an order is pushed to Shiprocket.'); openDoc(`${plural(list.length, 'shipping label')}`, list.map(docLabel).join('')); },
    bulkInvoices: () => { const list = selectedOrders().filter((o) => o.invoice); if (!list.length) return toast('None of the selected orders has an invoice yet.'); openDoc(`${plural(list.length, 'tax invoice')}`, list.map((o) => docInvoice(o)).join('')); },
    printDoc: () => window.print(),
    closeDoc: () => document.getElementById('docDlg').close(),
    checkPayment: (el) => { const o = ORD[el.dataset.id]; o.payment.status = 'Paid'; o.status = 'Label generated'; o.ship.courier = pick(COURIERS); o.ship.awb = `${between(10000000, 99999999)}11`; shipLog.unshift({ id: `SL${shipLog.length}`, oid: o.id, type: 'Order pushed', at: new Date().toISOString(), courier: o.ship.courier, awb: o.ship.awb, webhook: 'Received' }); if (!o.invoice) o.invoice = `${SETTINGS.gst.inv}${String(bumpInv()).padStart(4, '0')}`; toast('Razorpay confirmed the payment. Pushed to Shiprocket and a label generated.'); orderDrawer(o.id); renderPage(); renderNav(); sync(api.orders.confirmPayment(o.id).then((srv) => { Object.assign(o, srv); o.id = srv._id || o.id; }), 'confirm payment'); },
    cancelOrder: async (el) => { const ok = await ask({ title: `Cancel ${el.dataset.id}?`, text: 'The customer is told by email. If Razorpay later confirms the payment, it is refunded automatically.', ok: 'Cancel order', danger: true }); if (!ok) return; const id = el.dataset.id; ORD[id].status = 'Cancelled'; toast('Order cancelled.'); closeDrawer(); rerender(); sync(api.orders.cancel(id), 'cancel order'); },
    ndrReattempt: (el) => { const o = ORD[el.dataset.id]; o.status = 'In transit'; o.ndr = null; shipLog.unshift({ id: `SL${shipLog.length}`, oid: o.id, type: 'NDR action sent: reattempt', at: new Date().toISOString(), courier: o.ship.courier, awb: o.ship.awb, webhook: 'Received' }); toast('Reattempt requested through Shiprocket.'); orderDrawer(o.id); renderPage(); renderNav(); sync(api.orders.ndr(o.id, { action: 'reattempt' }), 'request reattempt'); },
    ndrAddress: async (el) => { const o = ORD[el.dataset.id]; const v = await ask({ title: 'Update delivery address', ok: 'Send to Shiprocket', fields: [{ id: 'a', label: 'Address', type: 'area', required: true }, { id: 'pin', label: 'Pincode', value: o.ship.pin, required: true }, { id: 'p', label: 'Phone for the courier', value: CUST[o.cid].phone }] }); if (!v) return; if (!/^\d{6}$/.test(v.pin)) return toast('That pincode isn’t 6 digits. Nothing was sent.'); o.ship.pin = v.pin; o.status = 'In transit'; o.ndr = null; shipLog.unshift({ id: `SL${shipLog.length}`, oid: o.id, type: 'NDR action sent: new address', at: new Date().toISOString(), courier: o.ship.courier, awb: o.ship.awb, webhook: 'Received' }); toast('Address updated with the courier through Shiprocket.'); orderDrawer(o.id); renderPage(); renderNav(); sync(api.orders.ndr(o.id, { action: 'address', pin: v.pin, address: v.a, phone: v.p }), 'update address'); },
    ndrRto: async (el) => { const ok = await ask({ title: 'Return to origin?', text: 'The parcel comes back to your warehouse. Stock is restored when it arrives. Forward and return freight are charged by Shiprocket.', ok: 'Return to origin', danger: true }); if (!ok) return; const o = ORD[el.dataset.id]; o.status = 'Returned to origin'; o.ndr = null; shipLog.unshift({ id: `SL${shipLog.length}`, oid: o.id, type: 'RTO initiated', at: new Date().toISOString(), courier: o.ship.courier, awb: o.ship.awb, webhook: 'Received' }); toast('Return to origin requested.'); orderDrawer(o.id); renderPage(); renderNav(); sync(api.orders.ndr(o.id, { action: 'rto' }), 'return to origin'); },
    refundOrder: async (el) => { const o = ORD[el.dataset.id]; const v = await ask({ title: `Refund ${o.id}`, text: 'Refunded through Razorpay to the original payment method. A GST credit note is generated.', ok: 'Refund', fields: [{ id: 'amt', label: 'Amount, ₹', value: String(o.total) }] }); if (!v) return; const amt = Number(v.amt.replace(/[^\d.]/g, '')); if (!(amt > 0 && amt <= o.total)) return toast(`Enter an amount between ₹1 and ${inr(o.total)}.`); o.payment.status = 'Refunded'; o.creditNote = `${SETTINGS.gst.cn}${String(bumpCn()).padStart(4, '0')}`; toast(`${inr(amt)} refund sent to Razorpay. Credit note ${o.creditNote} generated.`); orderDrawer(o.id); renderPage(); sync(api.orders.refund(o.id, amt).then((srv) => { Object.assign(o, srv); o.id = srv._id || o.id; }), 'refund'); },
    approveReturn: (el) => { const r = returns.find((x) => x.id === el.dataset.id); r.status = 'Pickup scheduled'; r.awb = `R${between(10000000, 99999999)}`; shipLog.unshift({ id: `SL${shipLog.length}`, oid: r.oid, type: 'Reverse pickup created', at: new Date().toISOString(), courier: 'Delhivery', awb: r.awb, webhook: 'Received' }); toast('Reverse pickup raised with Shiprocket. She gets the pickup details by email.'); returnDrawer(r.id); renderPage(); renderNav(); sync(api.returns.approve(r.id).then((srv) => { Object.assign(r, srv); r.id = srv._id || r.id; }), 'approve return'); },
    markPicked: (el) => { const id = el.dataset.id; returns.find((x) => x.id === id).status = 'Picked up'; returnDrawer(id); renderPage(); sync(api.returns.picked(id), 'mark picked up'); },
    markReceived: (el) => { const id = el.dataset.id; returns.find((x) => x.id === id).status = 'Received'; toast('Marked received. Inspect it, then refund.'); returnDrawer(id); renderPage(); renderNav(); sync(api.returns.received(id), 'mark received'); },
    refundReturn: (el) => { const r = returns.find((x) => x.id === el.dataset.id); r.status = 'Refunded'; const o = ORD[r.oid]; o.creditNote = `${SETTINGS.gst.cn}${String(bumpCn()).padStart(4, '0')}`; o.payment.status = 'Refunded'; const v = variantOf(o.items.find((it) => it.pid === r.pid)); v.stock += 1; toast(`Refunded through Razorpay. Credit note ${o.creditNote} generated; ${v.colour} stock back to ${v.stock}.`); returnDrawer(r.id); renderPage(); renderNav(); sync(api.returns.refund(r.id), 'refund return'); },
    rejectReturn: async (el) => { const v = await ask({ title: 'Reject return', text: 'She is told the reason by email.', ok: 'Reject', danger: true, fields: [{ id: 'r', label: 'Reason', type: 'area', required: true }] }); if (!v) return; const id = el.dataset.id; returns.find((x) => x.id === id).status = 'Rejected'; toast('Return rejected.'); returnDrawer(id); renderPage(); renderNav(); sync(api.returns.reject(id), 'reject return'); },
    syncNow: (el) => { const id = el.dataset.id; const s = shipLog.find((x) => x.id === id); if (s) s.webhook = 'Received'; toast('Latest status pulled from Shiprocket.'); renderPage(); renderNav(); sync(api.shipping.sync(id), 'sync shipping event'); },
    newProduct: () => productDrawer('new'),
    saveProduct: () => saveProduct(false, rerender),
    publishProduct: () => saveProduct(true, rerender),
    discardProduct: async () => {
      const ok = await ask({ title: 'Discard changes?', text: 'Any edits made in this drawer will be lost.', ok: 'Discard', danger: true });
      if (!ok) return;
      closeDrawer();
      toast('Changes discarded.');
    },
    addVariant: async () => {
      readProductForm();
      const dp = getDraftP();
      const c = CAT[dp.cat];
      const v = await ask({ title: 'Add a colour', ok: 'Add colour', fields: [{ id: 'c', label: 'Colour', type: 'color', value: '#1f5f7a' }, { id: 'n', label: 'Colour name', required: true, placeholder: 'For example: Peacock blue' }, ...(c.sized ? [{ id: 's', label: 'Size', type: 'select', options: SIZES }] : []), { id: 'q', label: 'Stock', value: '1' }] });
      if (!v) return;
      dp.variants.push({ id: `nv${Date.now()}`, colour: v.n.trim(), hex: v.c, size: v.s || null, stock: Math.max(0, parseInt(v.q, 10) || 0), sku: '' });
      productDrawer('__redraw');
    },
    removeVariant: (el) => { readProductForm(); getDraftP().variants.splice(Number(el.dataset.i), 1); productDrawer('__redraw'); },
    removeImage: (el) => { readProductForm(); const dp = getDraftP(); const i = Number(el.dataset.i); dp.imageUrls.splice(i, 1); dp.images -= 1; productDrawer('__redraw'); },
    removeVideo: () => { readProductForm(); const dp = getDraftP(); dp.video = false; dp.videoName = ''; productDrawer('__redraw'); },
    bulkStatus: async () => { const ids = lvSelected('products'); const v = await ask({ title: `Change status of ${plural(ids.length, 'product')}`, ok: 'Apply', fields: [{ id: 's', label: 'Status', type: 'select', options: [['Active', 'Live'], 'Draft', 'Hidden'] }] }); if (!v) return; ids.forEach((id) => { PROD[id].status = v.s; }); LV.products.sel.clear(); toast(`${plural(ids.length, 'product')} set to ${v.s === 'Active' ? 'live' : v.s.toLowerCase()}.`); rerender(); sync(api.products.bulkStatus(ids, v.s), 'update product statuses'); },
    bulkFeature: () => { const ids = lvSelected('products').filter((id) => PROD[id].status === 'Active'); ids.forEach((id) => { if (!featured.includes(id)) featured.push(id); }); LV.products.sel.clear(); toast(ids.length ? `${plural(ids.length, 'product')} added to featured weaves.` : 'Only live products can be featured.'); renderPage(); if (ids.length) sync(api.featured.set(featured), 'update featured'); },
    newCategory: () => categoryDrawer('new'),
    editCategory: (el) => categoryDrawer(el.dataset.id),
    saveCategory: (el) => {
      const name = val('cat-name'); const e = document.getElementById('cat-error');
      if (!name) { e.textContent = 'Give the category a name.'; e.hidden = false; return; }
      const weaves = val('cat-weaves').split(',').map((x) => x.trim()).filter(Boolean);
      if (!weaves.length) { e.textContent = 'Add at least one weave or type, so the category has a filter.'; e.hidden = false; return; }
      const image = categoryDrawer.image || '';
      const data = { name, story: val('cat-story'), weaves, weight: Number(val('cat-weight')) || 400, saree: val('cat-saree') === 'yes', image };
      if (el.dataset.id === 'new') { const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); if (CAT[id]) { e.textContent = 'A category with that name already exists.'; e.hidden = false; return; } const c = { id, ...data, visible: true, price: [1000, 5000] }; categories.push(c); CAT[id] = c; toast(`${name} created. It appears on the store once it has live products.`); sync(api.categories.create({ _id: id, ...data, visible: true, price: [1000, 5000] }), 'create category'); }
      else { Object.assign(CAT[el.dataset.id], data); toast(`${name} saved.`); sync(api.categories.update(el.dataset.id, data), 'update category'); }
      categoryDrawer.image = '';
      closeDrawer(); renderPage();
    },
    removeCategoryImage: () => {
      categoryDrawer.image = '';
      const preview = document.getElementById('cat-img-preview');
      if (preview) preview.innerHTML = '<span class="muted small">No image yet</span>';
      // Flip the button label from "Replace" to "Upload".
      const label = document.querySelector('label.btn[for="cat-image"]');
      if (label) label.textContent = 'Upload';
      // Hide the Remove button (it only exists while there's an image).
      const removeBtn = document.querySelector('[data-act="removeCategoryImage"]');
      if (removeBtn) removeBtn.remove();
    },
    toggleCat: (el) => { const c = CAT[el.dataset.id]; c.visible = el.checked; toast(el.checked ? `${c.name} is shown on the store.` : `${c.name} is hidden from the store. Its products stay in the catalogue.`); sync(api.categories.update(c.id, { visible: c.visible }), 'toggle category'); },
    newOccasion: async () => {
      const v = await ask({ title: 'New occasion', ok: 'Add', fields: [{ id: 'n', label: 'Name', required: true, placeholder: 'For example: Pongal' }] });
      if (!v) return;
      const name = v.n.trim();
      if (!name) return;
      if (OCCASIONS.includes(name)) return toast(`${name} already exists.`);
      OCCASIONS.push(name);
      OCCASIONS_FULL.push({ name, parent: null, order: OCCASIONS_FULL.length });
      renderPage(); toast(`${name} added.`);
      sync(api.occasions.create(name, null), 'create occasion');
    },
    newSubOccasion: async (el) => {
      const parent = el.dataset.id;
      const v = await ask({ title: `New sub-category for ${parent}`, text: 'Use these for narrower buckets, like Bridal, Haldi or Reception under Wedding.', ok: 'Add', fields: [{ id: 'n', label: 'Sub-category name', required: true, placeholder: 'For example: Bridal' }] });
      if (!v) return;
      const name = v.n.trim();
      if (!name) return;
      if (OCCASIONS.includes(name)) return toast(`${name} already exists.`);
      OCCASIONS.push(name);
      OCCASIONS_FULL.push({ name, parent, order: OCCASIONS_FULL.filter((o) => o.parent === parent).length });
      renderPage(); toast(`${name} added under ${parent}.`);
      sync(api.occasions.create(name, parent), 'create sub-category');
    },
    renameOccasion: async (el) => {
      const current = el.dataset.id;
      const v = await ask({ title: `Rename ${current}`, text: 'Every product and sub-category that references the old name will be re-linked.', ok: 'Rename', fields: [{ id: 'n', label: 'New name', value: current, required: true }] });
      if (!v) return;
      const next = v.n.trim();
      if (!next || next === current) return;
      if (OCCASIONS.includes(next)) return toast(`${next} already exists.`);
      const idx = OCCASIONS.indexOf(current); if (idx >= 0) OCCASIONS[idx] = next;
      const full = OCCASIONS_FULL.find((o) => o.name === current); if (full) full.name = next;
      OCCASIONS_FULL.forEach((o) => { if (o.parent === current) o.parent = next; });
      products.forEach((p) => { if (p.occasion === current) p.occasion = next; });
      renderPage(); toast(`Renamed to ${next}.`);
      sync(api.occasions.rename(current, next), 'rename occasion');
    },
    moveOccasion: async (el) => {
      const name = el.dataset.id;
      const current = OCCASIONS_FULL.find((o) => o.name === name);
      if (!current) return;
      // Eligible parents: any top-level occasion that isn't `name` itself.
      const options = [
        ['', '— Make top-level —'],
        ...OCCASIONS_FULL.filter((o) => !o.parent && o.name !== name).map((o) => [o.name, o.name]),
      ];
      const v = await ask({
        title: `Move ${name}`,
        text: 'Pick a parent occasion to make this a sub-category, or choose top-level to promote it.',
        ok: 'Move',
        fields: [{ id: 'p', label: 'New parent', type: 'select', options }],
      });
      if (!v) return;
      const nextParent = (v.p || '').trim() || null;
      if ((current.parent || null) === nextParent) return;
      current.parent = nextParent;
      renderPage();
      toast(nextParent ? `${name} moved under ${nextParent}.` : `${name} is now top-level.`);
      sync(api.occasions.reparent(name, nextParent), 'move occasion');
    },
    deleteOccasion: async (el) => {
      const name = el.dataset.id;
      const used = products.filter((p) => p.occasion === name).length;
      const subs = OCCASIONS_FULL.filter((o) => o.parent === name).length;
      const pieces = [];
      if (used) pieces.push(`${used} product${used === 1 ? '' : 's'} currently uses this occasion — they’ll have their occasion cleared.`);
      if (subs) pieces.push(`${subs} sub-categor${subs === 1 ? 'y' : 'ies'} will become top-level occasions.`);
      const ok = await ask({ title: `Delete ${name}?`, text: pieces.length ? pieces.join(' ') : 'This occasion isn’t used by any product.', ok: 'Delete', danger: true });
      if (!ok) return;
      const idx = OCCASIONS.indexOf(name); if (idx >= 0) OCCASIONS.splice(idx, 1);
      const fi = OCCASIONS_FULL.findIndex((o) => o.name === name); if (fi >= 0) OCCASIONS_FULL.splice(fi, 1);
      OCCASIONS_FULL.forEach((o) => { if (o.parent === name) o.parent = null; });
      products.forEach((p) => { if (p.occasion === name) p.occasion = null; });
      renderPage(); toast(`${name} deleted.`);
      sync(api.occasions.remove(name), 'delete occasion');
    },
    removeOccasionImage: async (el) => {
      const name = el.dataset.id;
      const o = OCCASIONS_FULL.find((x) => x.name === name);
      if (!o || !o.image) return;
      const ok = await ask({ title: `Remove image from ${name}?`, text: 'The tile will go back to the placeholder. You can upload a new image any time.', ok: 'Remove image', danger: true });
      if (!ok) return;
      o.image = '';
      renderPage(); toast('Image removed.');
      sync(api.occasions.setImage(name, ''), 'remove occasion image');
    },
    newPriceRange: async () => {
      const v = await ask({
        title: 'New price range',
        ok: 'Add',
        fields: [
          { id: 'label', label: 'Name shown on the store', required: true, placeholder: 'For example: Under ₹10,000' },
          { id: 'min', label: 'Minimum price, ₹', value: '0', required: true },
          { id: 'max', label: 'Maximum price, ₹', placeholder: 'Leave blank for “and above”' },
          { id: 'order', label: 'Position (lower first)', value: String(PRICE_RANGES.length) },
        ],
      });
      if (!v) return;
      const min = Number(String(v.min).replace(/[^\d.]/g, '')) || 0;
      const maxRaw = String(v.max || '').replace(/[^\d.]/g, '');
      const max = maxRaw === '' ? null : Number(maxRaw);
      if (max != null && max <= min) return toast('Maximum must be greater than minimum.');
      const doc = { label: v.label.trim(), min, max, order: Number(v.order) || 0, visible: true };
      try {
        const saved = await api.priceRanges.create(doc);
        PRICE_RANGES.push({ ...saved, id: saved._id });
        renderPage(); toast(`${doc.label} added.`);
      } catch (err) {
        toast(`Failed to create price range: ${err.message}`);
      }
    },
    editPriceRange: async (el) => {
      const id = el.dataset.id;
      const b = PRICE_RANGES.find((x) => x._id === id || x.id === id);
      if (!b) return;
      const v = await ask({
        title: `Edit ${b.label}`,
        ok: 'Save',
        fields: [
          { id: 'label', label: 'Name shown on the store', value: b.label, required: true },
          { id: 'min', label: 'Minimum price, ₹', value: String(b.min || 0), required: true },
          { id: 'max', label: 'Maximum price, ₹', value: b.max == null ? '' : String(b.max), placeholder: 'Leave blank for “and above”' },
          { id: 'order', label: 'Position (lower first)', value: String(b.order || 0) },
        ],
      });
      if (!v) return;
      const min = Number(String(v.min).replace(/[^\d.]/g, '')) || 0;
      const maxRaw = String(v.max || '').replace(/[^\d.]/g, '');
      const max = maxRaw === '' ? null : Number(maxRaw);
      if (max != null && max <= min) return toast('Maximum must be greater than minimum.');
      const patch = { label: v.label.trim(), min, max, order: Number(v.order) || 0 };
      Object.assign(b, patch);
      renderPage(); toast('Saved.');
      sync(api.priceRanges.update(id, patch), 'update price range');
    },
    deletePriceRange: async (el) => {
      const id = el.dataset.id;
      const b = PRICE_RANGES.find((x) => x._id === id || x.id === id);
      if (!b) return;
      const ok = await ask({ title: `Delete ${b.label}?`, text: 'Products are not affected — they only lose this bucket on the storefront rail.', ok: 'Delete', danger: true });
      if (!ok) return;
      const idx = PRICE_RANGES.indexOf(b); if (idx >= 0) PRICE_RANGES.splice(idx, 1);
      renderPage(); toast(`${b.label} deleted.`);
      sync(api.priceRanges.remove(id), 'delete price range');
    },
    togglePriceRange: (el) => {
      const id = el.dataset.id;
      const b = PRICE_RANGES.find((x) => x._id === id || x.id === id);
      if (!b) return;
      b.visible = el.checked;
      toast(el.checked ? `${b.label} is shown on the store.` : `${b.label} is hidden.`);
      sync(api.priceRanges.update(id, { visible: b.visible }), 'toggle price range');
    },
    toggleCoupon: (el) => { const c = coupons.find((x) => x.code === el.dataset.id); c.on = el.checked; toast(el.checked ? `${c.code} is active.` : `${c.code} is switched off. Customers can’t use it.`); sync(api.coupons.toggle(c.code), 'toggle coupon'); },
    addNote: async (el) => { const v = await ask({ title: 'Add a note', ok: 'Save note', fields: [{ id: 't', label: 'Note', type: 'area', required: true, placeholder: 'For example: prefers lighter zari' }] }); if (!v) return; const id = el.dataset.id; const at = iso(TODAY); CUST[id].notes.unshift({ text: v.t, at }); customerDrawer(id); sync(api.customers.addNote(id, v.t, at), 'add note'); },
    bulkNote: async () => { const ids = lvSelected('customers'); const v = await ask({ title: `Add a note to ${plural(ids.length, 'customer')}`, ok: 'Save note', fields: [{ id: 't', label: 'Note', type: 'area', required: true }] }); if (!v) return; const at = iso(TODAY); ids.forEach((id) => CUST[id].notes.unshift({ text: v.t, at })); LV.customers.sel.clear(); toast('Note added.'); renderPage(); sync(api.customers.bulkNote(ids, v.t), 'add notes'); },
    approveReview: (el) => { const id = el.dataset.id; reviews.find((r) => r.id === id).status = 'Published'; toast('Published.'); rerender(); sync(api.reviews.approve(id), 'approve review'); },
    rejectReview: (el) => { const id = el.dataset.id; reviews.find((r) => r.id === id).status = 'Rejected'; toast('Rejected. It won’t appear on the store.'); rerender(); sync(api.reviews.reject(id), 'reject review'); },
    replyReview: async (el) => { const id = el.dataset.id; const r = reviews.find((x) => x.id === id); const v = await ask({ title: 'Reply to review', ok: 'Save reply', fields: [{ id: 't', label: 'Reply', type: 'area', value: r.reply, required: true }] }); if (!v) return; r.reply = v.t; toast('Reply saved.'); renderPage(); sync(api.reviews.reply(id, v.t), 'save reply'); },
    approveReviews: () => { const ids = lvSelected('reviews'); ids.forEach((id) => { reviews.find((r) => r.id === id).status = 'Published'; }); LV.reviews.sel.clear(); toast('Published.'); rerender(); sync(api.reviews.bulk('approve', ids), 'approve reviews'); },
    rejectReviews: () => { const ids = lvSelected('reviews'); ids.forEach((id) => { reviews.find((r) => r.id === id).status = 'Rejected'; }); LV.reviews.sel.clear(); toast('Rejected.'); rerender(); sync(api.reviews.bulk('reject', ids), 'reject reviews'); },
    newCoupon: async () => { const v = await ask({ title: 'New coupon', ok: 'Create', fields: [{ id: 'c', label: 'Code', required: true, placeholder: 'For example: SANKRANTI10' }, { id: 'k', label: 'Type', type: 'select', options: [['Percent', 'Percent off'], ['Flat', 'Rupees off']] }, { id: 'v', label: 'Value', value: '10' }, { id: 'm', label: 'Minimum order, ₹', value: '2000' }, { id: 's', label: 'Applies to', type: 'select', options: ['All products', 'First order', ...categories.map((c) => c.name)] }, { id: 'l', label: 'Usage limit', placeholder: 'Optional' }, { id: 'e', label: 'Ends on', placeholder: 'YYYY-MM-DD, optional' }] }); if (!v) return; const code = v.c.toUpperCase().replace(/\s+/g, ''); const value = Number(v.v); if (!/^[A-Z0-9]{3,20}$/.test(code)) return toast('Codes are 3 to 20 letters and numbers. Nothing was created.'); if (coupons.some((c) => c.code === code)) return toast(`${code} already exists.`); if (!(value > 0) || (v.k === 'Percent' && value > 90)) return toast('Enter a discount above zero, and no more than 90%.'); if (v.e && !/^\d{4}-\d{2}-\d{2}$/.test(v.e)) return toast('Use the date format YYYY-MM-DD.'); const doc = { code, kind: v.k, value, min: Number(v.m) || 0, scope: v.s, uses: 0, limit: Number(v.l) || null, ends: v.e || null, on: true }; coupons.unshift(doc); toast(`${code} created and active.`); renderPage(); sync(api.coupons.create({ _id: code, ...doc }), 'create coupon'); },
    deleteCoupon: async (el) => { const code = el.dataset.id; const ok = await ask({ title: `Delete ${code}?`, text: 'Orders that used it keep their discount.', ok: 'Delete', danger: true }); if (!ok) return; coupons.splice(coupons.findIndex((c) => c.code === code), 1); renderPage(); sync(api.coupons.remove(code), 'delete coupon'); },
    newArticle: () => articleDrawer('new'),
    saveArticle: (el) => {
      const mode = el.dataset.mode; const e = document.getElementById('aj-error'); const title = val('aj-title');
      if (!title) { e.textContent = 'Give the article a title.'; e.hidden = false; return; }
      if (mode === 'Published' && val('aj-body').length < 20) { e.textContent = 'Write the article before publishing.'; e.hidden = false; return; }
      if (mode === 'Scheduled' && !(val('aj-date') > iso(TODAY))) { e.textContent = 'Pick a future publish date to schedule.'; e.hidden = false; return; }
      const slug = (val('aj-slug') || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const wasNew = !journal.find((x) => x.id === el.dataset.id);
      let j = journal.find((x) => x.id === el.dataset.id);
      if (!j) { j = { id: `J${Date.now()}`, views: 0, cover: articleDrawer.cover || '' }; journal.unshift(j); }
      Object.assign(j, { title, type: val('aj-type'), body: val('aj-body'), slug, seoTitle: val('aj-seot') || `${title} | ${SETTINGS.store.name}`, seoDesc: val('aj-seod'), status: mode, date: mode === 'Published' ? iso(TODAY) : val('aj-date') });
      articleDrawer.cover = '';
      closeDrawer(); renderPage(); toast(mode === 'Published' ? 'Published to the journal.' : mode === 'Scheduled' ? `Scheduled for ${fmtD(j.date)}.` : 'Saved as draft.');
      const payload = { title: j.title, type: j.type, body: j.body, slug: j.slug, seoTitle: j.seoTitle, seoDesc: j.seoDesc, status: j.status, date: j.date, cover: j.cover, views: j.views };
      if (wasNew) sync(api.journal.create({ _id: j.id, ...payload }), 'save article');
      else sync(api.journal.update(j.id, payload), 'save article');
    },
    saveScenes: () => { SCENES.forEach((s, i) => { s.name = val(`scene-n-${i}`) || s.name; s.line = val(`scene-${i}`) || s.line; }); toast('Homepage lines saved.'); sync(api.scenes.replace(SCENES.map((s, i) => ({ order: i, name: s.name, line: s.line }))), 'save scenes'); },
    addScene: () => { SCENES.forEach((s, i) => { s.name = val(`scene-n-${i}`) || s.name; s.line = val(`scene-${i}`) || s.line; }); SCENES.push({ name: `Scene ${SCENES.length + 1}`, line: '' }); renderPage(); sync(api.scenes.replace(SCENES.map((s, i) => ({ order: i, name: s.name, line: s.line }))), 'add scene'); },
    delScene: (el) => { if (SCENES.length <= 1) return; SCENES.forEach((s, i) => { s.name = val(`scene-n-${i}`) || s.name; s.line = val(`scene-${i}`) || s.line; }); SCENES.splice(Number(el.dataset.i), 1); renderPage(); sync(api.scenes.replace(SCENES.map((s, i) => ({ order: i, name: s.name, line: s.line }))), 'delete scene'); },
    pickFeatured: () => featuredDrawer(),
    saveFeatured: () => { const keep = featured.filter((id) => featuredDrawer.picked.has(id)); featuredDrawer.picked.forEach((id) => { if (!keep.includes(id)) keep.push(id); }); setFeatured(keep); closeDrawer(); renderPage(); toast(`${plural(keep.length, 'product')} featured on the homepage.`); sync(api.featured.set(keep), 'save featured'); },
    moveFeatured: (el) => { const i = featured.indexOf(el.dataset.id); const j = i + Number(el.dataset.dir); const next = [...featured]; [next[i], next[j]] = [next[j], next[i]]; setFeatured(next); renderPage(); sync(api.featured.set(next), 'reorder featured'); },
    unfeature: (el) => { const next = featured.filter((x) => x !== el.dataset.id); setFeatured(next); renderPage(); sync(api.featured.set(next), 'unfeature'); },
    editPage: (el) => pageDrawer(Number(el.dataset.i)),
    removePageBanner: (el) => { const p = PAGES_CMS[Number(el.dataset.i)]; p.banner = ''; p.updated = iso(TODAY); renderPage(); toast(`${p.name} banner removed.`); sync(api.pages.update(p.name, { name: p.name, desc: p.desc, body: p.body, banner: '' }), 'remove banner'); },
    savePage: (el) => { const p = PAGES_CMS[Number(el.dataset.i)]; p.body = val('pg-body'); p.updated = iso(TODAY); closeDrawer(); renderPage(); toast(`${p.name} saved.`); sync(api.pages.update(p.name, { name: p.name, desc: p.desc, body: p.body }), 'save page'); },
    saveSettings: () => saveSettings(rerender),
    checkRate: () => {
      const pin = val('rate-pin'); const out = document.getElementById('rate-out');
      if (!/^\d{6}$/.test(pin)) { out.innerHTML = '<p class="note n-bad">Enter a 6-digit pincode.</p>'; return; }
      const c = CAT[val('rate-cat')]; const w = c.weight + SETTINGS.ship.packaging; const slab = Math.ceil(w / 500) * 0.5; const zone = Math.abs(Number(pin[0]) - 5);
      const rates = [['Delhivery', 42, 2], ['Blue Dart', 64, 1], ['DTDC', 38, 3], ['Xpressbees', 40, 2]].map(([n, base, fast]) => [n, Math.round(base + slab * 30 + zone * 9), 2 + Math.ceil(zone / 2) + fast]).sort((a, b) => a[1] - b[1]);
      out.innerHTML = `<p class="small muted" style="margin:0 0 6px">${esc(c.name)}, ${nf.format(w)} g packed, ${slab} kg slab, to ${pin}. Demo figures; the live store asks Shiprocket.</p><ul class="list">${rates.map(([n, r, d]) => `<li><span class="grow"><b>${n}</b><span class="sub">About ${d} days</span></span><span class="strong">${inr(r)}</span></li>`).join('')}</ul>`;
    },
    changePassword: async () => { const v = await ask({ title: 'Change password', ok: 'Change password', fields: [{ id: 'c', label: 'Current password', required: true }, { id: 'n', label: 'New password', required: true, hint: 'At least 10 characters' }, { id: 'r', label: 'New password again', required: true }] }); if (!v) return; if (v.n.length < 10) return toast('The new password needs at least 10 characters. It wasn’t changed.'); if (v.n !== v.r) return toast('The two new passwords don’t match. It wasn’t changed.'); SETTINGS.account.pwChanged = iso(TODAY); renderPage(); toast('Password changed. Other devices were signed out.'); SETTINGS.account.devices.splice(1); renderPage(); },
    signOutDevice: (el) => { SETTINGS.account.devices.splice(Number(el.dataset.i), 1); renderPage(); toast('Signed out on that device.'); },
    testConnection: (el) => toast(`${el.dataset.id} responded. The connection is working.`),

    /* ---------- Barcodes & Stock ---------- */
    bcTab: (el) => { setBcTab(el.dataset.v); renderPage(); },
    labelFmt: (el) => { setLabelFmt(el.dataset.v); renderPage(); },

    stockIn: async (el) => {
      const vid = el.dataset.id;
      const ref = varRef(vid);
      if (!ref) return toast('That colour has been removed.');
      const { p, v } = ref;
      const vals_ = await ask({
        title: `Receive stock — ${p.name}, ${v.colour}${v.size ? `, ${v.size}` : ''}`,
        text: `A new piece is created for each one. Pieces start as “In stock” and get a Code 128 label.`,
        ok: `Add pieces`,
        fields: [
          { id: 'q', label: 'How many pieces?', value: '1' },
          { id: 'n', label: 'Note', value: 'Received from the weaver' },
        ],
      });
      if (!vals_) return;
      const qty = Math.max(0, parseInt(vals_.q, 10) || 0);
      if (!qty) return toast('Enter a number above zero.');
      try {
        const r = await api.pieces.receive({ pid: p.id, vid, qty, note: vals_.n || 'Received from the weaver' });
        await refresh('pieces');
        await refresh('products');
        toast(`${plural(r.created?.length || qty, 'piece')} received. ${plural(r.created?.length || qty, 'label')} ready to print.`);
        renderPage(); renderNav();
      } catch (err) { toast(`Failed to receive stock: ${err.message}`); }
    },

    printUnprinted: () => {
      const list = pieces.filter((u) => !u.printed && ['In stock', 'Reserved', 'Returned'].includes(u.status));
      if (!list.length) return toast('Every piece on the shelf already has a label.');
      const fmt = getLabelFmt();
      openDoc(`${plural(list.length, 'label')}, ${LABEL_FMT[fmt][0].toLowerCase()}`, `<style>${LABEL_FMT[fmt][1]}</style><div class="plabels ${fmt}">${list.map(labelHTML).join('')}</div>`);
      const codes = list.map((u) => u.code || u.id);
      sync(api.pieces.bulkPrinted(codes).then(() => refresh('pieces').then(renderPage)), 'mark labels printed');
    },

    printSelected: () => {
      const vids = lvSelected('labels');
      if (!vids.length) return toast('Select at least one colour.');
      const list = pieces.filter((u) => vids.includes(u.vid) && u.status === 'In stock');
      if (!list.length) return toast('No pieces in stock for the selected colours.');
      const fmt = getLabelFmt();
      openDoc(`${plural(list.length, 'label')}, ${LABEL_FMT[fmt][0].toLowerCase()}`, `<style>${LABEL_FMT[fmt][1]}</style><div class="plabels ${fmt}">${list.map(labelHTML).join('')}</div>`);
      LV.labels?.sel.clear();
      const codes = list.map((u) => u.code || u.id);
      sync(api.pieces.bulkPrinted(codes).then(() => refresh('pieces').then(renderPage)), 'mark labels printed');
    },

    printPiece: (el) => {
      const code = el.dataset.id;
      const u = PIECE[code]; if (!u) return;
      const fmt = getLabelFmt();
      openDoc(`Label ${code}`, `<style>${LABEL_FMT[fmt][1]}</style><div class="plabels ${fmt}">${labelHTML(u)}</div>`);
      if (!u.printed) sync(api.pieces.printed(code).then(() => { u.printed = true; renderPage(); }), 'mark label printed');
    },

    pieceRestock: async (el) => {
      const code = el.dataset.id;
      try {
        await api.pieces.move(code, { to: 'In stock', note: 'Inspected after return, restocked', by: 'Surekha', oid: null });
        await refresh('pieces'); await refresh('movements'); await refresh('products');
        toast(`${code} is back on the shelf.`); closeDrawer(); renderPage(); renderNav();
      } catch (err) { toast(`Failed to restock: ${err.message}`); }
    },

    pieceWriteOff: async (el) => {
      const code = el.dataset.id;
      const v = await ask({ title: `Write off ${code}?`, text: 'This piece is removed from stock. The movement is logged.', ok: 'Write off', danger: true, fields: [{ id: 'r', label: 'Reason', type: 'area', required: true, placeholder: 'Damaged, lost, sampled, etc.' }] });
      if (!v) return;
      try {
        await api.pieces.move(code, { to: 'Written off', note: v.r, by: 'Surekha' });
        await refresh('pieces'); await refresh('movements'); await refresh('products');
        toast(`${code} written off.`); closeDrawer(); renderPage(); renderNav();
      } catch (err) { toast(`Failed to write off: ${err.message}`); }
    },

    /* ---------- Packing ---------- */
    packLoad: (el) => {
      const o = ORD[el.dataset.id]; if (!o) return;
      if (o.status !== 'Label generated') return toast(`${o.id} is ${o.status.toLowerCase()}. Only labelled orders can be packed.`);
      packStartScan(o);
      setPackFb('ok', `Packing ${o.id} for ${CUST[o.cid].name}. Scan ${plural(o.items.length, 'piece')}.`);
      navigate('/packing'); renderPage();
    },

    packCancel: () => {
      const p = getPack(); if (!p) return;
      const o = ORD[p.oid];
      // Release any pieces we had already moved to Packed for this order.
      const codes = Object.values(p.got);
      if (codes.length) sync(Promise.all(codes.map((code) => api.pieces.move(code, { to: 'Reserved', note: `Unpacked, ${o.id} packing cancelled`, by: 'Packing bench' }))).then(() => refresh('pieces')), 'cancel packing');
      packCancelLocal(`Packing for ${o.id} cancelled. Its pieces are back to reserved.`);
      renderPage();
    },

    packShip: async () => {
      const p = getPack(); if (!p) return;
      const o = ORD[p.oid]; if (!o || !packDone(o)) return;
      const codes = Object.values(p.got);
      try {
        await api.pieces.shipOrder(o.id, codes);
        await api.orders.ship(o.id);
        recordShipped(o, codes);
        await refresh('pieces'); await refresh('orders'); await refresh('shipping'); await refresh('movements');
        toast(`${o.id} marked as shipped. Its pieces now show as sold in stock.`);
        beep(true);
        renderPage(); renderNav();
      } catch (err) { toast(`Failed to ship: ${err.message}`); }
    },

    packTick: (el) => {
      const p = getPack(); if (!p) return;
      const i = Number(el.dataset.i);
      p.ticks[i] = el.checked;
      renderPage();
    },

    packSlip: (el) => {
      const o = ORD[el.dataset.id]; if (!o) return;
      openDoc(`Packing slip ${o.id}`, docPackSlip(o));
    },
  };
}

/* ---------- Global scanner dispatch ---------- */
// Called by scanner.js when a keyboard-wedge burst fires, or by the Packing
// page's dedicated scan box on Enter. Decides whether to drive the packing
// flow or just open the matching entity.
export function handleScan(raw, { navigate, renderPage, renderNav, source }) {
  const code = String(raw || '').trim().toUpperCase();
  if (!code) return;
  scanStats.today += 1;

  // Not on the packing page → just open whatever matches.
  if (source !== 'pack' && !getPack()) {
    const u = findPiece(code);
    if (u) { openEntity(`piece:${u.code || u.id}`); return; }
    const o = findOrder(code);
    if (o) { openEntity(`order:${o.id}`); return; }
    const r = bySku(code);
    if (r) { openEntity(`product:${r.p.id}`); return; }
    beep(false); toast(`Scanned ${code}. Nothing in the store matches it.`); return;
  }

  // Packing flow — step through the current order.
  const o = findOrder(code);
  const pstate = getPack();
  if (o) {
    if (pstate && pstate.oid === o.id && code === (o.ship?.awb || '').toUpperCase()) {
      if (packDone(o)) {
        // User scanned the courier label after every piece — ship.
        const codes = Object.values(pstate.got);
        sync(api.pieces.shipOrder(o.id, codes)
          .then(() => api.orders.ship(o.id))
          .then(() => { recordShipped(o, codes); return Promise.all([refresh('pieces'), refresh('orders'), refresh('shipping'), refresh('movements')]); })
          .then(() => { toast(`${o.id} shipped. ${plural(codes.length, 'piece')} marked sold.`); beep(true); renderPage?.(); renderNav?.(); }),
          'ship order');
        return;
      }
      setPackFb('warn', 'Scan every piece before the courier label.'); beep(false); renderPage?.(); return;
    }
    if (o.status !== 'Label generated') { setPackFb('bad', `${o.id} is ${o.status.toLowerCase()}. Only labelled orders can be packed.`); beep(false); scanStats.wrong += 1; renderPage?.(); return; }
    packStartScan(o);
    setPackFb('ok', `Packing ${o.id} for ${CUST[o.cid].name}. Scan ${plural(o.items.length, 'piece')}.`);
    beep(true);
    if (source !== 'pack') navigate('/packing');
    renderPage?.();
    return;
  }

  // Not an order → piece, or SKU for a swap.
  let u = findPiece(code);
  if (!u) {
    const r = bySku(code);
    if (r && pstate) {
      // SKU of the right colour: find a reserved piece on this order first, else a free one.
      u = pieces.find((x) => x.vid === r.v.id && x.oid === pstate.oid && x.status === 'Reserved') || pieces.find((x) => x.vid === r.v.id && x.status === 'In stock');
    }
    if (!u) { setPackFb('bad', r ? `${r.p.name}, ${r.v.colour}: no piece left in stock.` : `${code} isn’t a piece, order, AWB or invoice this store knows.`); beep(false); scanStats.wrong += 1; renderPage?.(); return; }
  }
  if (!pstate) { setPackFb('warn', `${u.code || u.id}. Scan an order to start packing.`); beep(false); renderPage?.(); return; }
  const ord = ORD[pstate.oid];
  if (Object.values(pstate.got).includes(u.code || u.id)) { setPackFb('warn', `${u.code || u.id} is already scanned for this order.`); beep(false); renderPage?.(); return; }
  const idx = ord.items.findIndex((it, i) => it.vid === u.vid && !pstate.got[i]);
  if (idx < 0) {
    setPackFb('bad', ord.items.some((it) => it.vid === u.vid) ? `${ord.id} needs no more of this colour. Put the piece back.` : `Wrong piece — not in ${ord.id}. Put it back.`);
    beep(false); scanStats.wrong += 1; renderPage?.(); return;
  }
  if (u.status === 'Reserved' && u.oid && u.oid !== ord.id) { setPackFb('bad', `${u.code || u.id} is reserved for ${u.oid}. Put it back.`); beep(false); scanStats.wrong += 1; renderPage?.(); return; }
  // Move → Packed (and Reserved first if needed).
  sync((async () => {
    if (u.status === 'In stock') await api.pieces.move(u.code || u.id, { to: 'Reserved', note: `Picked at the packing bench for ${ord.id}`, by: 'Packing bench', oid: ord.id });
    await api.pieces.move(u.code || u.id, { to: 'Packed', note: `Scanned at the packing bench for ${ord.id}`, by: 'Packing bench' });
    await refresh('pieces');
    pstate.got[idx] = u.code || u.id;
    const n = Object.keys(pstate.got).length;
    setPackFb('ok', packDone(ord)
      ? `${ord.items.length === 1 ? 'The piece is' : `All ${ord.items.length} pieces are`} in. Scan the courier label or press Mark as shipped.`
      : `${n} of ${ord.items.length} scanned.`);
    beep(true);
    renderPage?.();
  })(), 'pack piece');
}

export { CHECK_ACTS };
