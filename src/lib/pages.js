// Page render functions — each returns an HTML string (same approach as the original).
import {
  esc, pill, nf, inr, inrS, fmtD, dF, dmF, tF, dtF, icon, plural, cap, rel, daysFrom, pct,
  TODAY, toDate, addDays, iso, ov, ol, who, code128,
} from './utils.js';
import {
  categories, CAT, COLORS, OCCASIONS, OCCASIONS_FULL, SIZES, products, PROD, stockOf, customers, CUST,
  orders, ORD, jobs, STITCH_STAGES, returns, POLICY, shipLog, COURIERS, coupons,
  reviews, journal, SCENES, PAGES_CMS, SETTINGS, analytics, CRM, STORE_STATE,
  featured, M_FIELDS, paid, codToCollect, inDays, queue, BORDERS, PRICE_RANGES,
  pieces, moves, PIECE, PIECE_TONE, piecesOf, varRef,
} from './data.js';
import {
  ORDER_TONE, PAY_TONE, RET_TONE, sw, swv, prodCell, variantOf, seg, gstLines,
  areaChart, hbars, listView, LV, lvSelected,
} from './renderers.js';

/* Page state kept on module (equivalent to closures in the original) */
let dashRange = 7;
export const setDashRange = (v) => { dashRange = v; };

let setTab = 'store';
export const setSetTab = (v) => { setTab = v; };
export const getSetTab = () => setTab;

export const PAGES = {};

/* =============== DASHBOARD =============== */
PAGES.dashboard = () => {
  const q = queue();
  const sum = (from, to) => orders.filter((o) => paid(o) && inDays(o, from, to)).reduce((a, o) => a + o.total, 0);
  const cur = orders.filter((o) => paid(o) && inDays(o, 0, dashRange)), prev = orders.filter((o) => paid(o) && inDays(o, dashRange, dashRange * 2));
  const rev = cur.reduce((a, o) => a + o.total, 0), prevRev = prev.reduce((a, o) => a + o.total, 0);
  // COD cash still with the courier across all time (not period-scoped — it's a liability counter).
  const codPending = orders.filter(codToCollect);
  const codPendingAmt = codPending.reduce((a, o) => a + o.total, 0);
  const delta = (a, b) => { if (!b) return '<span class="faint">—</span>'; const d = ((a - b) / b) * 100; return `<span class="${d >= 0 ? 't-ok' : 't-bad'} strong">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%</span>`; };
  const repeatCust = customers.filter((c) => c.orderCount >= 2).length, buyers = customers.filter((c) => c.orderCount >= 1).length;
  const kpi = (l, v, f) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-val">${v}</div><div class="kpi-foot">${f}</div></div>`;
  const days = Array.from({ length: 30 }, (_, i) => addDays(TODAY, i - 29));
  const byCat = (ids) => days.map((d) => orders.filter((o) => paid(o) && daysFrom(o.placed) === daysFrom(d)).flatMap((o) => o.items).filter((it) => ids.includes(PROD[it.pid].cat)).reduce((a, it) => a + it.price, 0));
  const items = [
    [q.ndr, 'Failed deliveries to act on', 'Shiprocket raised an NDR. Reattempt, update the address or return to origin.', '/orders', 'bad'],
    [q.pending, 'Payments pending in Razorpay', 'Usually a UPI payment not yet confirmed. The order is pushed to Shiprocket once it clears.', '/orders', 'warn'],
    [q.retReview, 'Return requests to review', 'Approve to raise a reverse pickup with Shiprocket.', '/returns', 'warn'],
    [q.retRefund, 'Returns received, refund due', 'Refund through Razorpay; a credit note is generated automatically.', '/returns', 'warn'],
    [q.reviews, 'Reviews to moderate', 'Reviews publish only after approval.', '/reviews', 'neutral'],
    [q.webhook, 'Shipping updates that failed to arrive', 'A Shiprocket webhook did not reach the store. It retries automatically.', '/shipping', 'bad'],
    [q.oos, 'Live products with a colour out of stock', 'The colour shows as sold out on the store.', '/products', 'neutral'],
    [q.drafts, 'Draft products not yet live', 'Missing photos or details.', '/products', 'neutral'],
  ].filter((x) => x[0] > 0);
  const toneBg = { warn: 'var(--warn-tint);color:var(--warn)', pri: 'var(--pri-tint);color:var(--pri)', bad: 'var(--bad-tint);color:var(--bad)', neutral: 'var(--neutral-tint);color:var(--ink-2)' };
  return `<div class="page-head"><div><h1 class="h1">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}</h1><p class="lede">${dF.format(new Date())}. What needs doing, and how the house is selling.</p></div>
      <div class="seg" role="group" aria-label="Period">${[[1, 'Today'], [7, '7 days'], [30, '30 days']].map(([v, l]) => `<button type="button" data-act="dashRange" data-v="${v}" aria-pressed="${dashRange === v}">${l}</button>`).join('')}</div></div>
    <div class="kpis">
      ${kpi('Payments received', inrS(rev), `${delta(rev, prevRev)}<span class="faint">vs previous period</span>`)}
      ${kpi('COD to collect', inrS(codPendingAmt), `<span class="faint">${nf.format(codPending.length)} order${codPending.length === 1 ? '' : 's'} with the courier</span>`)}
      ${kpi('Orders', nf.format(cur.length), `${delta(cur.length, prev.length)}<span class="faint">${cur.filter((o) => o.payment.method === 'Cash on delivery').length} on COD</span>`)}
      ${kpi('Average order', inrS(cur.length ? rev / cur.length : 0), `${delta(cur.length ? rev / cur.length : 0, prev.length ? prevRev / prev.length : 0)}<span></span>`)}
      ${kpi('Visitors on the site now', nf.format(analytics.live), `<span class="faint">Average visit ${analytics.avgSession}</span>`)}
      ${kpi('Repeat customers', `${Math.round(pct(repeatCust, buyers))}%`, `<span class="faint">${repeatCust} of ${buyers} buyers</span>`)}
    </div>
    <div class="grid g-main">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Needs doing</h2><p>Work waiting on the team right now.</p></div></div>
        <ul class="queue" style="margin-top:12px">${items.map(([n, t, d, href, tone]) => `<li><a href="${href}"><span class="count" style="background:${toneBg[tone]}">${n}</span><span class="what"><b>${esc(t)}</b><span>${esc(d)}</span></span><span class="go">Open</span></a></li>`).join('') || '<li class="empty"><strong>All clear</strong></li>'}</ul></section>
      <div class="grid" style="align-content:start">
        <section class="panel"><div class="panel-head"><h2 class="h2">Payments</h2><a class="link" href="/analytics">Analytics</a></div><div class="panel-body"><dl class="sum"><dt>Today</dt><dd class="strong">${inr(sum(0, 1))}</dd><dt>This week</dt><dd class="strong">${inr(sum(0, 7))}</dd><dt>This month</dt><dd class="strong">${inr(sum(0, 30))}</dd></dl></div></section>
        <section class="panel"><div class="panel-head"><h2 class="h2">Sales by category, 30 days</h2></div><div class="panel-body">${hbars(categories.map((c) => ({ label: c.name, value: orders.filter((o) => paid(o) && inDays(o, 0, 30)).flatMap((o) => o.items).filter((it) => PROD[it.pid].cat === c.id).reduce((a, it) => a + it.price, 0) })).sort((a, b) => b.value - a.value), { fmt: inrS })}</div></section>
      </div>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="h2">Payments received, last 30 days</h2><p>Stacked by category group. Hover a day for the split.</p></div><div class="legend"><span><i style="background:#05380d"></i>Silk</span><span><i style="background:#E0AE6D"></i>Cotton, designer and ethnic sets</span></div></div>
      <div class="panel-body">${areaChart([byCat(['silk']), byCat(['cotton', 'designer', 'lehenga', 'acc'])], days.map((d) => dmF.format(d)), { names: ['Silk', 'Cotton, designer, ethnic'] })}</div></section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h2 class="h2">Latest orders</h2><a class="link" href="/orders">All orders</a></div>
      <div class="scroll" style="margin-top:12px"><table class="t" style="min-width:820px"><thead><tr><th><span>Order</span></th><th><span>Customer</span></th><th><span>Product</span></th><th><span>Payment</span></th><th class="r"><span>Total</span></th><th><span>Status</span></th></tr></thead><tbody>
      ${orders.slice(0, 6).map((o) => `<tr class="click" data-open="order:${o.id}"><td><b>${o.id}</b><span class="sub">${esc(tF.format(new Date(o.placed)))}</span></td><td>${esc(CUST[o.cid].name)}<span class="sub">${esc(CUST[o.cid].city)}</span></td><td>${prodCell(PROD[o.items[0].pid], o.items.length > 1 ? `, and ${o.items.length - 1} more` : '')}</td><td>${pill(o.payment.status, PAY_TONE[o.payment.status])}<span class="sub">${esc(o.payment.method)}</span></td><td class="r strong">${inr(o.total)}</td><td>${pill(o.status, ORDER_TONE[o.status], true)}</td></tr>`).join('')}
      </tbody></table></div></section>`;
};

/* =============== ORDERS =============== */
PAGES.orders = () => `<div class="page-head"><div><h1 class="h1">Orders</h1><p class="lede">Paid orders are pushed to Shiprocket automatically and a label is generated.</p></div>
    <button type="button" class="btn btn-sec" data-act="exportExcel" data-what="orders">${icon('dl')}Export CSV</button></div>
  ${listView('orders', {
    rows: orders, noun: 'order', placeholder: 'Order number, customer, city, AWB or payment ID', minWidth: 1180, open: 'order',
    text: (o) => `${o.id} ${CUST[o.cid].name} ${CUST[o.cid].city} ${o.ship.awb || ''} ${o.payment.rzp || ''}`,
    tabs: [
      { id: 'open', label: 'Open', filter: (o) => !['Delivered', 'Returned to origin', 'Cancelled'].includes(o.status) },
      { id: 'pending', label: 'Payment pending', filter: (o) => o.status === 'Payment pending', hot: true, note: 'Razorpay has not confirmed these payments yet. They update automatically when the webhook arrives, or you can cancel them.' },
      { id: 'label', label: 'Label generated', filter: (o) => o.status === 'Label generated' },
      { id: 'transit', label: 'In transit', filter: (o) => o.status === 'In transit' },
      { id: 'ndr', label: 'Delivery failed', filter: (o) => o.status === 'Delivery failed', hot: true, note: 'Failed delivery alerts (NDR) from Shiprocket. Choose reattempt, update address or return to origin.' },
      { id: 'delivered', label: 'Delivered', filter: (o) => o.status === 'Delivered' },
      { id: 'all', label: 'All', filter: null },
    ],
    filters: [
      { id: 'pay', label: 'All payments', options: ['Paid', 'Pending', 'COD pending', 'COD collected', 'Refunded'], test: (o, v) => o.payment.status === v },
      { id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (o, v) => o.items.some((it) => PROD[it.pid].cat === v) },
    ],
    bulk: [['bulkLabels', 'Print labels'], ['bulkInvoices', 'Download tax invoices'], ['exportSelected', 'Export CSV']],
    sort: { key: 'placed', dir: 'desc' },
    columns: [
      { key: 'placed', label: 'Order', sort: true, render: (o) => `<b>${o.id}</b><span class="sub">${esc(dtF.format(new Date(o.placed)))}</span>` },
      { key: 'cust', label: 'Customer', sort: (o) => CUST[o.cid].name, render: (o) => `${esc(CUST[o.cid].name)}<span class="sub">${esc(CUST[o.cid].city)}, ${esc(o.ship.pin)}</span>` },
      { key: 'items', label: 'Products', render: (o) => prodCell(PROD[o.items[0].pid], o.items.length > 1 ? `, and ${o.items.length - 1} more` : '') },
      { key: 'pay', label: 'Payment', sort: (o) => o.payment.status, render: (o) => `${pill(o.payment.status, PAY_TONE[o.payment.status])}<span class="sub">${esc(o.payment.method)}</span>` },
      { key: 'total', label: 'Total', sort: (o) => o.total, align: 'r', render: (o) => `<span class="strong">${inr(o.total)}</span>${o.coupon ? `<span class="sub">${esc(o.coupon)}</span>` : ''}` },
      { key: 'ship', label: 'Shipment', render: (o) => (o.ship.awb ? `${esc(o.ship.courier)}<span class="sub">${o.ship.awb}</span>` : '<span class="faint">—</span>') },
      { key: 'status', label: 'Status', sort: true, render: (o) => `${pill(o.status, ORDER_TONE[o.status], true)}${o.ndr ? `<span class="sub t-bad">${esc(o.ndr)}</span>` : ''}` },
    ],
  })}`;

/* =============== RETURNS =============== */
PAGES.returns = () => `<div class="page-head"><div><h1 class="h1">Returns</h1><p class="lede">Customers request returns from their account within ${POLICY.window} days of delivery. Approving raises a reverse pickup with Shiprocket; refunds go back through Razorpay with a GST credit note.</p></div></div>
  ${listView('returns', {
    rows: returns, noun: 'return', placeholder: 'Return, order or customer', minWidth: 1000, open: 'return',
    text: (r) => `${r.id} ${r.oid} ${CUST[r.cid].name} ${PROD[r.pid].name}`,
    tabs: [
      { id: 'open', label: 'Open', filter: (r) => !['Refunded', 'Rejected', 'Not eligible'].includes(r.status) },
      { id: 'review', label: 'To review', filter: (r) => r.status === 'Requested', hot: true },
      { id: 'refund', label: 'Refund due', filter: (r) => r.status === 'Received', hot: true },
      { id: 'ineligible', label: 'Not eligible', filter: (r) => r.status === 'Not eligible', note: 'Blocked by your returns policy: stitched blouses, falls and pico work and customised pieces. Set these in Settings, Returns policy.' },
      { id: 'closed', label: 'Closed', filter: (r) => ['Refunded', 'Rejected'].includes(r.status) },
    ],
    columns: [
      { key: 'id', label: 'Return', sort: true, render: (r) => `<b>${r.id}</b><span class="sub">Order ${r.oid}</span>` },
      { key: 'p', label: 'Product', render: (r) => prodCell(PROD[r.pid]) },
      { key: 'c', label: 'Customer', render: (r) => esc(CUST[r.cid].name) },
      { key: 'reason', label: 'Reason', sort: true, render: (r) => esc(r.reason) },
      { key: 'amount', label: 'Value', sort: true, align: 'r', render: (r) => inr(r.amount) },
      { key: 'requested', label: 'Requested', sort: true, render: (r) => esc(cap(rel(daysFrom(r.requested)))) },
      { key: 'status', label: 'Status', sort: true, render: (r) => `${pill(r.status, RET_TONE[r.status], true)}${r.awb ? `<span class="sub">Reverse AWB ${r.awb}</span>` : ''}` },
    ],
  })}`;

/* =============== SHIPPING =============== */
PAGES.shipping = () => `<div class="page-head"><div><h1 class="h1">Shipping</h1><p class="lede">Every update Shiprocket sends: order pushes, labels, pickups, tracking, failed deliveries and reverse pickups. Couriers are whatever Shiprocket offers on the day.</p></div><a class="btn btn-sec" href="/settings" data-act="setTabLink" data-v="shipping">Weight slabs and rates</a></div>
  ${listView('shipping', {
    rows: shipLog, noun: 'event', placeholder: 'Order or AWB', minWidth: 900, text: (s) => `${s.oid} ${s.awb}`,
    tabs: [{ id: 'all', label: 'All updates', filter: null }, { id: 'ndr', label: 'Failed deliveries', filter: (s) => s.type === 'NDR raised', hot: true }, { id: 'reverse', label: 'Reverse pickups', filter: (s) => s.type === 'Reverse pickup created' }, { id: 'fail', label: 'Webhook failures', filter: (s) => s.webhook !== 'Received', hot: true, note: 'These updates did not reach the store. Shiprocket retries for 24 hours; after that, use “Sync now” to pull the latest status.' }],
    filters: [{ id: 'courier', label: 'All couriers', options: COURIERS, test: (s, v) => s.courier === v }],
    columns: [
      { key: 'at', label: 'When', sort: true, render: (s) => esc(dtF.format(new Date(s.at))) },
      { key: 'type', label: 'Update', sort: true, render: (s) => `<b>${esc(s.type)}</b>${s.detail ? `<span class="sub t-bad">${esc(s.detail)}</span>` : ''}` },
      { key: 'oid', label: 'Order', sort: true, render: (s) => `<button type="button" class="link" data-open="order:${s.oid}">${s.oid}</button>` },
      { key: 'courier', label: 'Courier', sort: true, render: (s) => `${esc(s.courier)}<span class="sub">${s.awb}</span>` },
      { key: 'webhook', label: 'Received by store', render: (s) => (s.webhook === 'Received' ? pill('Received', 'ok') : `${pill('Failed, retrying', 'bad')} <button type="button" class="link small" data-act="syncNow" data-id="${s.id}">Sync now</button>`) },
    ],
  })}`;

/* =============== PRODUCTS =============== */
PAGES.products = () => `<div class="page-head"><div><h1 class="h1">Products</h1><p class="lede">Each product carries its weave, zari, border and blouse piece as fields that drive the store’s filters. Stock is held per colour variant.</p></div>
    <button type="button" class="btn btn-pri" data-act="newProduct">${icon('plus')}Add product</button></div>
  ${listView('products', {
    rows: products, noun: 'product', placeholder: 'Name, weave or SKU', minWidth: 1180, open: 'product',
    text: (p) => `${p.name} ${p.weave} ${p.variants.map((v) => `${v.sku} ${v.colour}`).join(' ')}`,
    tabs: [{ id: 'all', label: 'All', filter: null }, ...categories.map((c) => ({ id: c.id, label: c.name, filter: (p) => p.cat === c.id })), { id: 'draft', label: 'Drafts', filter: (p) => p.status === 'Draft' }, { id: 'oos', label: 'Colour out of stock', filter: (p) => p.variants.some((v) => v.stock === 0), hot: true }],
    filters: [
      { id: 'zari', label: 'Any zari', options: ['Pure zari', 'Tested zari', 'No zari'], test: (p, v) => p.zari === v },
      { id: 'occ', label: 'All occasions', options: OCCASIONS, test: (p, v) => p.occasion === v },
      { id: 'blouse', label: 'Blouse piece', options: [['y', 'Included'], ['n', 'Not included']], test: (p, v) => (v === 'y') === p.blousePiece },
    ],
    bulk: [['bulkStatus', 'Change status'], ['bulkFeature', 'Feature on homepage'], ['exportSelected', 'Export CSV']],
    sort: { key: 'created', dir: 'desc' },
    columns: [
      { key: 'name', label: 'Product', sort: true, render: (p) => prodCell(p) },
      { key: 'weave', label: 'Weave and zari', sort: true, render: (p) => `${esc(p.weave)}<span class="sub">${esc([p.fabric !== '—' ? p.fabric : '', p.zari].filter(Boolean).join(', ') || '—')}</span>` },
      { key: 'variants', label: 'Colours and stock', render: (p) => `<span style="display:inline-flex;gap:4px">${p.variants.map((v) => `<span title="${esc(v.colour)}${v.size ? `, ${v.size}` : ''}: ${v.stock} in stock" style="position:relative;opacity:${v.stock ? 1 : .35}">${swv(v, p)}</span>`).join('')}</span><span class="sub ${p.variants.some((v) => !v.stock) ? 't-warn' : ''}">${stockOf(p)} in stock${p.variants.some((v) => !v.stock) ? `, ${p.variants.filter((v) => !v.stock).length} sold out` : ''}</span>` },
      { key: 'blouse', label: 'Blouse piece', render: (p) => (CAT[p.cat].saree ? (p.blousePiece ? 'Included<span class="sub">Stitching offered</span>' : '<span class="faint">Not included</span>') : '<span class="faint">—</span>') },
      { key: 'price', label: 'Price', sort: true, align: 'r', render: (p) => `<span class="strong">${inr(p.price)}</span>${p.compareAt ? `<span class="sub"><s>${inr(p.compareAt)}</s></span>` : ''}` },
      { key: 'rating', label: 'Reviews', sort: (p) => Number(p.rating), render: (p) => (p.reviews ? `★ ${p.rating}<span class="sub">${plural(p.reviews, 'review')}</span>` : '<span class="faint">None yet</span>') },
      { key: 'created', label: 'Added', sort: true, render: (p) => esc(fmtD(p.created)) },
      { key: 'status', label: 'Status', sort: true, render: (p) => pill(p.status === 'Active' ? 'Live' : p.status, p.status === 'Active' ? 'ok' : p.status === 'Draft' ? 'warn' : 'neutral', true) },
    ],
  })}`;

/* =============== CATEGORIES =============== */
PAGES.categories = () => `<div class="page-head"><div><h1 class="h1">Categories</h1><p class="lede">Each category has its own landing page, story section and filters. New categories inherit the standard filters and product template.</p></div>
    <button type="button" class="btn btn-pri" data-act="newCategory">${icon('plus')}New category</button></div>
  <section class="panel"><div class="scroll" style="border-top:0"><table class="t" style="min-width:880px"><thead><tr><th><span>Category</span></th><th><span>Weaves and types</span></th><th class="r"><span>Products</span></th><th class="r"><span>Sales, 30 days</span></th><th><span>Default shipping weight</span></th><th><span>Shown on store</span></th><th><span></span></th></tr></thead><tbody>
  ${categories.map((c) => `<tr><td><div style="display:flex;align-items:center;gap:12px"><span class="cat-thumb">${c.image ? `<img src="${esc(c.image)}" alt="">` : ''}</span><span><b>${esc(c.name)}</b><span class="sub">${esc(c.story || 'No story text yet')}</span></span></div></td><td class="wrap muted">${esc(c.weaves.join(', '))}</td><td class="r">${products.filter((p) => p.cat === c.id).length}</td><td class="r strong">${inrS(orders.filter((o) => paid(o) && inDays(o, 0, 30)).flatMap((o) => o.items).filter((it) => PROD[it.pid].cat === c.id).reduce((a, it) => a + it.price, 0))}</td><td>${nf.format(c.weight)} g</td><td><label class="switch"><input type="checkbox" ${c.visible !== false ? 'checked' : ''} data-act="toggleCat" data-id="${c.id}" aria-label="Show ${esc(c.name)} on the store"><span></span></label></td><td class="r"><button type="button" class="btn btn-ghost btn-sm" data-act="editCategory" data-id="${c.id}">Edit</button></td></tr>`).join('')}
  </tbody></table></div><div class="tfoot"><span>Store filters: category, weave, fabric, colour, occasion, zari type, border and price.</span></div></section>`;

/* =============== SHOP BY PRICE =============== */
PAGES.priceRanges = () => {
  const bandLabel = (b) => b.max == null ? `${inr(b.min)} and above` : b.min === 0 ? `Under ${inr(b.max)}` : `${inr(b.min)} to ${inr(b.max)}`;
  const inBand = (b, price) => price >= (b.min || 0) && (b.max == null || price < b.max);
  const row = (b) => {
    const match = products.filter((p) => inBand(b, p.price));
    const live = match.filter((p) => p.status === 'Active').length;
    return `<tr>
      <td><b>${esc(b.label || bandLabel(b))}</b><span class="sub">${esc(bandLabel(b))}</span></td>
      <td class="r">${nf.format(match.length)}</td>
      <td class="r">${nf.format(live)}</td>
      <td><label class="switch"><input type="checkbox" ${b.visible !== false ? 'checked' : ''} data-act="togglePriceRange" data-id="${b.id || b._id}" aria-label="Show ${esc(b.label)} on the store"><span></span></label></td>
      <td class="r">
        <button type="button" class="btn btn-ghost btn-sm" data-act="editPriceRange" data-id="${b.id || b._id}">Edit</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="deletePriceRange" data-id="${b.id || b._id}">Delete</button>
      </td>
    </tr>`;
  };
  return `<div class="page-head"><div><h1 class="h1">Shop by price</h1><p class="lede">Price buckets shown on the storefront’s “Shop by price” rail. Each bucket collects every live product whose price falls inside it.</p></div>
      <button type="button" class="btn btn-pri" data-act="newPriceRange">${icon('plus')}New price range</button></div>
    <section class="panel"><div class="scroll" style="border-top:0"><table class="t" style="min-width:720px">
      <thead><tr><th><span>Band</span></th><th class="r"><span>Products</span></th><th class="r"><span>Live products</span></th><th><span>Shown on store</span></th><th class="r"><span></span></th></tr></thead>
      <tbody>${PRICE_RANGES.length ? PRICE_RANGES.map(row).join('') : '<tr><td colspan="5" class="empty"><strong>No price ranges yet</strong>Add the first one to show a “Shop by price” rail on the storefront.</td></tr>'}</tbody>
    </table></div>
    <div class="tfoot"><span>Overlapping bands are allowed — a product can appear in more than one.</span></div></section>`;
};

/* =============== OCCASIONS =============== */
PAGES.occasions = () => {
  const usageOf = (name) => products.filter((p) => p.occasion === name);
  const tops = OCCASIONS_FULL.filter((o) => !o.parent).sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
  const subsOf = (parent) => OCCASIONS_FULL.filter((o) => o.parent === parent).sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
  const safeId = (name) => name.replace(/[^a-zA-Z0-9]+/g, '-');

  // Thumbnail + hidden file input + the image-management links directly under it.
  // Clicking the tile opens the file picker; the "Replace image" link and the
  // "Remove" link live here so the image column owns everything about the image.
  const tile = (o, size = 'md') => {
    const id = `occ-img-${safeId(o.name)}`;
    const hasImg = Boolean(o.image);
    const links = hasImg
      ? `<div class="occ-tile-links">
           <label class="link xs" for="${id}">Replace image</label>
           <button type="button" class="link xs" data-act="removeOccasionImage" data-id="${esc(o.name)}">Remove</button>
         </div>`
      : `<div class="occ-tile-links">
           <label class="link xs" for="${id}">Upload image</label>
         </div>`;
    return `<div class="occ-tile-wrap">
      <label class="occ-tile occ-tile-${size}${hasImg ? ' has-img' : ''}" for="${id}" title="${hasImg ? 'Replace image' : 'Upload image'}">
        ${hasImg ? `<img src="${esc(o.image)}" alt="${esc(o.name)}" loading="lazy">` : `<span class="occ-tile-ph">${icon('plus', size === 'sm' ? 12 : 14)}</span>`}
      </label>
      <input type="file" id="${id}" data-occ-img="${esc(o.name)}" accept="image/*" hidden>
      ${links}
    </div>`;
  };

  // Parent occasion — full table row, 56px tile, image controls live under the tile.
  const parentRow = (o) => {
    const used = usageOf(o.name);
    const liveUsed = used.filter((p) => p.status === 'Active').length;
    const nSubs = subsOf(o.name).length;
    return `<tr class="occ-parent">
      <td>${tile(o, 'md')}</td>
      <td><b>${esc(o.name)}</b>${nSubs ? `<span class="sub">${plural(nSubs, 'sub-category')}</span>` : ''}</td>
      <td class="r">${used.length}</td>
      <td class="r">${liveUsed}</td>
      <td class="r">
        <button type="button" class="btn btn-sec btn-sm" data-act="newSubOccasion" data-id="${esc(o.name)}">${icon('plus')}Sub-category</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="renameOccasion" data-id="${esc(o.name)}">Rename</button>
        ${nSubs ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-act="moveOccasion" data-id="${esc(o.name)}">Move under…</button>`}
        <button type="button" class="btn btn-ghost btn-sm" data-act="deleteOccasion" data-id="${esc(o.name)}">Delete</button>
      </td>
    </tr>`;
  };

  // Sub-category — rendered as a card inside a single wide row that spans all columns.
  const subCard = (o, parentName) => {
    const used = usageOf(o.name);
    const liveUsed = used.filter((p) => p.status === 'Active').length;
    return `<div class="occ-sub">
      ${tile(o, 'sm')}
      <div class="occ-sub-main">
        <div class="occ-sub-title">${esc(o.name)}</div>
        <div class="occ-sub-meta">under <b>${esc(parentName)}</b> · ${plural(used.length, 'product')} · ${liveUsed} live</div>
      </div>
      <div class="occ-sub-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-act="renameOccasion" data-id="${esc(o.name)}">Rename</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="moveOccasion" data-id="${esc(o.name)}">Move…</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="deleteOccasion" data-id="${esc(o.name)}">Delete</button>
      </div>
    </div>`;
  };

  const subsRow = (o) => {
    const subs = subsOf(o.name);
    if (!subs.length) return '';
    return `<tr class="occ-subs-row"><td colspan="5">
      <div class="occ-subs-wrap">
        <div class="occ-subs-head">
          <span class="occ-subs-label">Sub-categories of ${esc(o.name)}</span>
          <button type="button" class="link small" data-act="newSubOccasion" data-id="${esc(o.name)}">+ Add another</button>
        </div>
        <div class="occ-subs-grid">${subs.map((s) => subCard(s, o.name)).join('')}</div>
      </div>
    </td></tr>`;
  };

  const groupRows = (o) => parentRow(o) + subsRow(o);

  const body = tops.length
    ? tops.map(groupRows).join('')
    : '<tr><td colspan="5" class="empty"><strong>No occasions yet</strong>Add the first one to use it in product filters.</td></tr>';

  return `<div class="page-head"><div><h1 class="h1">Occasions</h1><p class="lede">Shopping occasions attached to each product. Each top-level occasion can hold its own sub-categories — for example “Wedding” with “Bridal”, “Haldi”, “Reception”, “Sangeeth”. Add a tile image for the storefront rail.</p></div>
    <button type="button" class="btn btn-pri" data-act="newOccasion">${icon('plus')}New occasion</button></div>
    <section class="panel"><div class="scroll" style="border-top:0"><table class="t occ-table" style="min-width:960px">
      <thead><tr><th><span>Image</span></th><th><span>Occasion</span></th><th class="r"><span>Products</span></th><th class="r"><span>Live products</span></th><th class="r"><span></span></th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <div class="tfoot"><span>Images upload to the server. Renaming an occasion re-tags every product and sub-category that referenced the old name.</span></div></section>`;
};

/* =============== CUSTOMERS =============== */
PAGES.customers = () => `<div class="page-head"><div><h1 class="h1">Customers</h1><p class="lede">Every customer, the weaves she has bought, the occasions she buys for and her saved blouse measurements. Segments update automatically from spend and recency.</p></div>
    <button type="button" class="btn btn-sec" data-act="exportExcel" data-what="segment">${icon('dl')}Export this segment to Excel</button></div>
  ${listView('customers', {
    rows: customers, noun: 'customer', placeholder: 'Name, phone, email or city', minWidth: 1120, open: 'customer',
    text: (c) => `${c.name} ${c.phone} ${c.email} ${c.city} ${(c.weaves || []).join(' ')}`,
    tabs: [{ id: 'all', label: 'All', filter: null }, { id: 'vip', label: 'VIP', filter: (c) => c.segment === 'VIP' }, { id: 'repeat', label: 'Repeat', filter: (c) => c.segment === 'Repeat' }, { id: 'new', label: 'New', filter: (c) => c.segment === 'New' }, { id: 'dormant', label: 'Dormant', filter: (c) => c.segment === 'Dormant', note: `No order in ${CRM.dormantDays} days. Export this segment for your own outreach before the season turns.` }, { id: 'measure', label: 'Has measurements', filter: (c) => c.profiles.length }],
    filters: [
      { id: 'weave', label: 'Bought any weave', options: [...new Set(products.map((p) => p.weave))].sort(), test: (c, v) => c.weaves.includes(v) },
      { id: 'occ', label: 'Any occasion', options: OCCASIONS, test: (c, v) => c.occasions.includes(v) },
      { id: 'city', label: 'All cities', options: [...new Set(customers.map((c) => c.city))].sort(), test: (c, v) => c.city === v },
    ],
    bulk: [['exportSelected', 'Export CSV'], ['bulkNote', 'Add note']],
    sort: { key: 'ltv', dir: 'desc' },
    columns: [
      { key: 'name', label: 'Customer', sort: true, render: (c) => who(c.name, `${c.city}, ${c.phone}`) },
      { key: 'segment', label: 'Segment', sort: true, render: (c) => seg(c.segment) },
      { key: 'weaves', label: 'Weaves bought', render: (c) => (c.weaves.length ? `<span class="tags">${c.weaves.slice(0, 3).map((w) => `<span class="tag">${esc(w)}</span>`).join('')}${c.weaves.length > 3 ? `<span class="tag">+${c.weaves.length - 3}</span>` : ''}</span>` : '<span class="faint">—</span>') },
      { key: 'orderCount', label: 'Orders', sort: true, align: 'r', render: (c) => nf.format(c.orderCount) },
      { key: 'ltv', label: 'Lifetime value', sort: true, align: 'r', render: (c) => `<span class="strong">${inr(c.ltv)}</span>` },
      { key: 'last', label: 'Last purchase', sort: (c) => c.lastOrder || '', render: (c) => (c.lastOrder ? esc(cap(rel(daysFrom(c.lastOrder)))) : '<span class="faint">Never</span>') },
      { key: 'm', label: 'Measurement profiles', render: (c) => (c.profiles.length ? esc(c.profiles.map((p) => p.who).join(', ')) : '<span class="faint">None</span>') },
    ],
  })}`;

/* =============== REVIEWS =============== */
PAGES.reviews = () => `<div class="page-head"><div><h1 class="h1">Reviews</h1><p class="lede">Reviews publish on the store only after you approve them. Replies appear under the review.</p></div></div>
  ${listView('reviews', {
    rows: reviews, noun: 'review', placeholder: 'Product, customer or text', minWidth: 980, text: (r) => `${PROD[r.pid].name} ${CUST[r.cid].name} ${r.text}`,
    tabs: [{ id: 'pending', label: 'To approve', filter: (r) => r.status === 'Pending', hot: true }, { id: 'pub', label: 'Published', filter: (r) => r.status === 'Published' }, { id: 'rej', label: 'Rejected', filter: (r) => r.status === 'Rejected' }],
    bulk: [['approveReviews', 'Approve', 'btn-pri'], ['rejectReviews', 'Reject', 'btn-bad']],
    columns: [
      { key: 'rating', label: 'Rating', sort: true, render: (r) => `<span class="${r.rating >= 4 ? 't-ok' : r.rating === 3 ? 't-warn' : 't-bad'} strong">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>` },
      { key: 'text', label: 'Review', wrap: true, render: (r) => `${esc(r.text)}<span class="sub">${esc(CUST[r.cid].name)}, ${esc(cap(rel(daysFrom(r.at))))}</span>${r.reply ? `<span class="sub t-pri">Your reply: ${esc(r.reply)}</span>` : ''}` },
      { key: 'p', label: 'Product', render: (r) => prodCell(PROD[r.pid]) },
      { key: 'act', label: '', render: (r) => (r.status === 'Pending' ? `<div style="display:inline-flex;gap:6px"><button type="button" class="btn btn-ghost btn-sm" data-act="rejectReview" data-id="${r.id}">Reject</button><button type="button" class="btn btn-sec btn-sm" data-act="replyReview" data-id="${r.id}">Reply</button><button type="button" class="btn btn-pri btn-sm" data-act="approveReview" data-id="${r.id}">Approve</button></div>` : `<button type="button" class="btn btn-ghost btn-sm" data-act="replyReview" data-id="${r.id}">${r.reply ? 'Edit reply' : 'Reply'}</button>`) },
    ],
  })}`;

/* =============== COUPONS =============== */
PAGES.coupons = () => `<div class="page-head"><div><h1 class="h1">Coupons</h1><p class="lede">Codes customers enter at checkout.</p></div><button type="button" class="btn btn-pri" data-act="newCoupon">${icon('plus')}New coupon</button></div>
  <section class="panel"><div class="scroll" style="border-top:0"><table class="t" style="min-width:860px"><thead><tr><th><span>Code</span></th><th><span>Discount</span></th><th class="r"><span>Minimum order</span></th><th><span>Applies to</span></th><th class="r"><span>Used</span></th><th><span>Ends</span></th><th><span>Active</span></th><th></th></tr></thead><tbody>
  ${coupons.map((c) => `<tr><td><b>${esc(c.code)}</b></td><td>${c.kind === 'Percent' ? `${c.value}% off` : `${inr(c.value)} off`}</td><td class="r">${inr(c.min)}</td><td class="muted">${esc(c.scope)}</td><td class="r">${nf.format(c.uses)}${c.limit ? `<span class="sub">of ${c.limit}</span>` : ''}</td><td>${c.ends ? esc(fmtD(c.ends)) : '<span class="faint">No end date</span>'}</td><td><label class="switch"><input type="checkbox" ${c.on ? 'checked' : ''} data-act="toggleCoupon" data-id="${esc(c.code)}" aria-label="${esc(c.code)} active"><span></span></label></td><td class="r"><button type="button" class="btn btn-ghost btn-sm" data-act="deleteCoupon" data-id="${esc(c.code)}">Delete</button></td></tr>`).join('')}
  </tbody></table></div></section>`;

/* =============== JOURNAL =============== */
PAGES.journal = () => `<div class="page-head"><div><h1 class="h1">Journal</h1><p class="lede">Draping guides, weave guides, zari care and occasion lookbooks. Each article has its own search title and description.</p></div><button type="button" class="btn btn-pri" data-act="newArticle">${icon('plus')}New article</button></div>
  ${listView('journal', {
    rows: journal, noun: 'article', placeholder: 'Title', minWidth: 820, open: 'article', text: (j) => j.title,
    tabs: [{ id: 'all', label: 'All', filter: null }, { id: 'pub', label: 'Published', filter: (j) => j.status === 'Published' }, { id: 'draft', label: 'Drafts and scheduled', filter: (j) => j.status !== 'Published' }],
    filters: [{ id: 'type', label: 'All types', options: ['Draping guide', 'Weave guide', 'Zari care', 'Lookbook'], test: (j, v) => j.type === v }],
    sort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'title', label: 'Article', sort: true, render: (j) => `<b>${esc(j.title)}</b><span class="sub">/journal/${esc(j.slug)}</span>` },
      { key: 'type', label: 'Type', sort: true, render: (j) => esc(j.type) },
      { key: 'date', label: 'Date', sort: true, render: (j) => esc(fmtD(j.date)) },
      { key: 'views', label: 'Views, 30 days', sort: true, align: 'r', render: (j) => (j.views ? nf.format(j.views) : '<span class="faint">—</span>') },
      { key: 'status', label: 'Status', sort: true, render: (j) => pill(j.status, j.status === 'Published' ? 'ok' : j.status === 'Scheduled' ? 'info' : 'warn', true) },
    ],
  })}`;

/* =============== STOREFRONT =============== */
PAGES.storefront = () => `<div class="page-head"><div><h1 class="h1">Storefront pages</h1><p class="lede">The words and picks on the customer pages. Product, category and journal pages fill themselves from the catalogue.</p></div></div>
  <section class="panel"><div class="panel-head"><div><h2 class="h2">Homepage story</h2><p>Scroll scenes shown on the homepage. The last scene is shown to returning customers.</p></div><button type="button" class="btn btn-sec btn-sm" data-act="addScene">Add scene</button></div>
    <div class="panel-body">${SCENES.map((s, i) => `<div class="setrow" style="align-items:flex-end"><div class="field" style="flex:0 0 200px"><span class="lbl">Scene ${i + 1}${i === SCENES.length - 1 ? ', shown to returning customers' : ''}</span><input class="ctl" id="scene-n-${i}" value="${esc(s.name)}" aria-label="Scene ${i + 1} name"></div><div class="field" style="flex:1 1 320px;max-width:520px"><span class="lbl">Line</span><input class="ctl" id="scene-${i}" value="${esc(s.line)}" aria-label="${esc(s.name)} line"></div><button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="delScene" data-i="${i}" aria-label="Remove ${esc(s.name)}"${SCENES.length <= 1 ? ' disabled' : ''}>${icon('x', 16)}</button></div>`).join('')}</div>
    <div class="tfoot"><span></span><button type="button" class="btn btn-pri btn-sm" data-act="saveScenes">Save homepage lines</button></div></section>
  <section class="panel"><div class="panel-head"><div><h2 class="h2">Featured weaves</h2><p>Shown on the homepage after the story, in this order. New arrivals fill automatically from the latest products.</p></div><button type="button" class="btn btn-sec btn-sm" data-act="pickFeatured">Choose products</button></div>
    <div class="panel-body"><ul class="list">${featured.map((pid, i) => `<li>${sw(PROD[pid], 'sm')}<span class="grow">${esc(PROD[pid].name)}<span class="sub">${inr(PROD[pid].price)}</span></span><button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="moveFeatured" data-id="${pid}" data-dir="-1" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="moveFeatured" data-id="${pid}" data-dir="1" aria-label="Move down"${i === featured.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="btn btn-ghost btn-sm" data-act="unfeature" data-id="${pid}">Remove</button></li>`).join('') || '<li class="muted">No featured products. The homepage shows new arrivals only.</li>'}</ul></div></section>
  <section class="panel"><div class="panel-head"><div><h2 class="h2">Pages</h2><p>Each page has a hero banner shown above the content. Recommended: 1600×500 px, under 500 KB.</p></div></div><div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>Page</span></th><th><span>What it holds</span></th><th><span>Banner</span></th><th><span>Last updated</span></th><th><span></span></th></tr></thead><tbody>
    ${PAGES_CMS.map((p, i) => `<tr><td><b>${esc(p.name)}</b></td><td class="wrap muted">${esc(p.desc)}</td><td><div style="display:flex;gap:8px;align-items:center">${p.banner ? `<img src="${esc(p.banner)}" alt="" style="width:88px;height:32px;object-fit:cover;border-radius:4px;border:1px solid var(--line)">` : '<span class="small muted">No banner</span>'}<label class="btn btn-sec btn-sm" for="pg-banner-${i}">${p.banner ? 'Replace' : 'Upload'}</label><input type="file" id="pg-banner-${i}" accept="image/*" hidden data-i="${i}">${p.banner ? `<button type="button" class="btn btn-ghost btn-sm" data-act="removePageBanner" data-i="${i}">Remove</button>` : ''}</div></td><td>${esc(fmtD(p.updated))}</td><td class="r"><button type="button" class="btn btn-ghost btn-sm" data-act="editPage" data-i="${i}">Edit</button></td></tr>`).join('')}
  </tbody></table></div></section>`;

/* =============== ANALYTICS =============== */
PAGES.analytics = () => {
  const sum = (f) => orders.filter((o) => paid(o) && f(o)).reduce((a, o) => a + o.total, 0);
  const byCity = Object.entries(orders.filter((o) => paid(o) && inDays(o, 0, 30)).reduce((a, o) => { const c = CUST[o.cid].city; a[c] = (a[c] || 0) + o.total; return a; }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const repeaters = customers.filter((c) => c.orderCount >= 2);
  const gaps = repeaters.map((c) => { const ds = c.orders.map((id) => new Date(ORD[id].placed)).sort((a, b) => a - b); return (ds[ds.length - 1] - ds[0]) / 864e5 / (ds.length - 1); }).filter((x) => x > 0);
  const f0 = analytics.funnel[0][1];
  const topProducts = products.filter((p) => p.status === 'Active').sort((a, b) => b.views - a.views).slice(0, 6);
  return `<div class="page-head"><div><h1 class="h1">Analytics</h1><p class="lede">Payments from Razorpay, and visitor behaviour from the analytics tool. Visitor numbers miss people who decline tracking or use ad blockers.</p></div></div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Payments today</div><div class="kpi-val">${inrS(sum((o) => inDays(o, 0, 1)))}</div></div>
      <div class="kpi"><div class="kpi-label">This week</div><div class="kpi-val">${inrS(sum((o) => inDays(o, 0, 7)))}</div></div>
      <div class="kpi"><div class="kpi-label">This month</div><div class="kpi-val">${inrS(sum((o) => inDays(o, 0, 30)))}</div></div>
      <div class="kpi"><div class="kpi-label">On the site now</div><div class="kpi-val">${analytics.live}</div><div class="kpi-foot"><span class="faint">${analytics.pagesPerSession} pages a visit</span></div></div>
      <div class="kpi"><div class="kpi-label">Average visit</div><div class="kpi-val" style="font-size:1.25rem">${analytics.avgSession}</div></div>
    </div>
    <div class="grid g2">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">From home to payment, 30 days</h2><p>Visitors reaching each step, and how many dropped off.</p></div></div><div class="panel-body">
        ${analytics.funnel.map(([s, n], i) => `<div class="hbar"><span>${esc(s)}${i ? `<span class="sub">${Math.round(100 - pct(n, analytics.funnel[i - 1][1]))}% dropped off</span>` : ''}</span><div class="bar"><span style="width:${pct(n, f0)}%"></span></div><span class="strong">${nf.format(n)}</span></div>`).join('')}</div></section>
      <section class="panel"><div class="panel-head"><h2 class="h2">Payments by category, 30 days</h2></div><div class="panel-body">${hbars(categories.map((c) => ({ label: c.name, value: orders.filter((o) => paid(o) && inDays(o, 0, 30)).flatMap((o) => o.items).filter((it) => PROD[it.pid].cat === c.id).reduce((a, it) => a + it.price, 0) })).sort((a, b) => b.value - a.value), { fmt: inrS })}</div></section>
      <section class="panel"><div class="panel-head"><h2 class="h2">Payments by city, 30 days</h2></div><div class="panel-body">${hbars(byCity, { fmt: inrS })}</div></section>
      <section class="panel"><div class="panel-head"><h2 class="h2">Where visitors came from</h2></div><div class="panel-body">${hbars(analytics.sources.map(([label, value]) => ({ label, value })), { fmt: (v) => `${v}%`, tone: 'zari' })}<p class="sub">Only where the browser reports it.</p></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Most viewed products</h2><p>What holds attention, 30 days.</p></div></div><div class="panel-body"><ul class="list">${topProducts.map((p) => `<li>${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${(pct(p.carts, p.views)).toFixed(1)}% added to cart</span></span><span class="strong">${nf.format(p.views)}</span></li>`).join('')}</ul></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Top category pages and articles</h2></div></div><div class="panel-body">${hbars([...categories.map((c, i) => ({ label: c.name, value: [8420, 6110, 3980, 2870, 2240, 1510][i] })), ...journal.filter((j) => j.views).slice(0, 3).map((j) => ({ label: j.title, value: j.views, tone: 'zari' }))].sort((a, b) => b.value - a.value), {})}</div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Abandoned carts, 30 days</h2><p>${nf.format(analytics.carts.count)} carts left, ${inrS(analytics.carts.value)} in value.</p></div></div><div class="panel-body"><ul class="list">${analytics.carts.top.map(([pid, n]) => `<li>${sw(PROD[pid], 'sm')}<span class="grow">${esc(PROD[pid].name)}<span class="sub">${inr(PROD[pid].price)}</span></span><span class="strong">${n} carts</span></li>`).join('')}</ul></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Repeat customers</h2></div></div><div class="panel-body"><dl class="sum"><dt>Ordered more than once</dt><dd class="strong">${repeaters.length} customers, ${Math.round(pct(repeaters.length, customers.filter((c) => c.orderCount).length))}%</dd><dt>Average days between orders</dt><dd class="strong">${gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : '—'} days</dd></dl></div></section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="h2">Returning customers by first-order month</h2><p>Of customers whose first order was in each month, the share who ordered again in each following month.</p></div></div>
      <div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>First order</span></th><th class="r"><span>Customers</span></th>${['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4'].map((m) => `<th class="r"><span>${m}</span></th>`).join('')}</tr></thead><tbody>
      ${analytics.cohorts.map((c) => `<tr><td><b>${c.m}</b></td><td class="r">${c.size}</td>${[0, 1, 2, 3, 4].map((k) => `<td class="r">${c.ret[k] !== undefined ? `<span style="display:inline-block;min-width:46px;padding:3px 6px;border-radius:4px;background:rgba(123,35,66,${(c.ret[k] / 100) * 0.9 + 0.05});color:${c.ret[k] > 50 ? '#fff' : 'var(--ink)'}">${c.ret[k]}%</span>` : ''}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></section>`;
};

/* =============== PRODUCT ANALYTICS =============== */
PAGES.productAnalytics = () => {
  const soldByPid = {};
  const revenueByPid = {};
  orders.filter(paid).forEach((o) => {
    const scale = o.sub ? o.total / o.sub : 1;
    o.items.forEach((it) => {
      if (!PROD[it.pid]) return;
      soldByPid[it.pid] = (soldByPid[it.pid] || 0) + it.qty;
      revenueByPid[it.pid] = (revenueByPid[it.pid] || 0) + it.price * it.qty * scale;
    });
  });
  const prodList = products.map((p) => ({ ...p, sold: soldByPid[p.id] || 0, revenue: revenueByPid[p.id] || 0 }));
  const topSold = [...prodList].filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 10);
  const topRev = [...prodList].filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const catRows = categories.map((c) => {
    const inCat = products.filter((p) => p.cat === c.id);
    return {
      ...c,
      views: inCat.reduce((a, p) => a + (p.views || 0), 0),
      carts: inCat.reduce((a, p) => a + (p.carts || 0), 0),
      sold: inCat.reduce((a, p) => a + (soldByPid[p.id] || 0), 0),
      revenue: inCat.reduce((a, p) => a + (revenueByPid[p.id] || 0), 0),
    };
  }).sort((a, b) => b.views - a.views);
  const topProduct = topSold[0];
  const topCategory = catRows[0];
  const totalSold = Object.values(soldByPid).reduce((a, b) => a + b, 0);
  const totalRev = Object.values(revenueByPid).reduce((a, b) => a + b, 0);
  const emptyList = (msg) => `<li class="empty"><strong>${esc(msg)}</strong></li>`;
  return `<div class="page-head"><div><h1 class="h1">Product analytics</h1><p class="lede">What’s selling, what’s being looked at, and where interest turns into orders. Sold counts are from paid orders; views come from storefront analytics.</p></div></div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Top-selling product</div><div class="kpi-val" style="font-size:1.05rem;line-height:1.3">${topProduct ? esc(topProduct.name) : '—'}</div><div class="kpi-foot"><span class="faint">${topProduct ? `${plural(topProduct.sold, 'unit')} · ${inrS(topProduct.revenue)}` : 'No sales yet'}</span></div></div>
      <div class="kpi"><div class="kpi-label">Most visited category</div><div class="kpi-val" style="font-size:1.05rem;line-height:1.3">${topCategory && topCategory.views ? esc(topCategory.name) : '—'}</div><div class="kpi-foot"><span class="faint">${topCategory && topCategory.views ? `${nf.format(topCategory.views)} views` : 'No views tracked'}</span></div></div>
      <div class="kpi"><div class="kpi-label">Units sold</div><div class="kpi-val">${nf.format(totalSold)}</div><div class="kpi-foot"><span class="faint">${plural(orders.filter(paid).length, 'paid order')}</span></div></div>
      <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-val">${inrS(totalRev)}</div></div>
    </div>
    <div class="grid g2">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Most sold products</h2><p>By units shipped on paid orders.</p></div></div>
        <div class="panel-body"><ul class="list">${topSold.length ? topSold.map((p) => `<li data-open="product:${p.id}">${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${esc(CAT[p.cat].name)} · ${inrS(p.revenue)}</span></span><span class="strong">${plural(p.sold, 'unit')}</span></li>`).join('') : emptyList('No sales yet')}</ul></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Most visited categories</h2><p>Page views summed across each category’s products.</p></div></div>
        <div class="panel-body">${catRows.some((c) => c.views) ? hbars(catRows.map((c) => ({ label: c.name, value: c.views })), {}) : `<p class="empty"><strong>No category views tracked yet</strong></p>`}</div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Top revenue earners</h2></div></div>
        <div class="panel-body"><ul class="list">${topRev.length ? topRev.map((p) => `<li data-open="product:${p.id}">${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${plural(p.sold, 'unit')} · ${inr(p.price)}</span></span><span class="strong">${inrS(p.revenue)}</span></li>`).join('') : emptyList('No revenue yet')}</ul></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Category performance</h2><p>Views, carts and units sold by category.</p></div></div>
        <div class="panel-body"><div class="scroll"><table class="t"><thead><tr><th>Category</th><th class="r">Views</th><th class="r">Carts</th><th class="r">Units</th><th class="r">Revenue</th></tr></thead><tbody>
          ${catRows.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="r">${nf.format(c.views)}</td><td class="r">${nf.format(c.carts)}</td><td class="r">${nf.format(c.sold)}</td><td class="r">${c.revenue ? inrS(c.revenue) : '<span class="faint">—</span>'}</td></tr>`).join('')}
        </tbody></table></div></div></section>
    </div>`;
};

/* =============== PRODUCT INSIGHTS =============== */
import {
  INS, insList, VERDICT, LOW_C2B, abCarts, STAGES, STAGE_TONE, REC_TONE,
  BEH, pairs, colourDemand, priceBands, priceChanges,
  secs, pc, ago, sumBy, getInsTab, getInsCat, isBuilt,
} from './insights.js';

const INS_TABS = [['overview', 'Overview'], ['products', 'Products'], ['carts', 'Abandoned carts'], ['pricing', 'Price acceptance'], ['behaviour', 'Shopper behaviour'], ['demand', 'Demand signals'], ['tracking', 'How it’s tracked']];
const kpiBox = (l, v, f = '') => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-val">${v}</div>${f ? `<div class="kpi-foot">${f}</div>` : ''}</div>`;
const panel = (title, sub, body, extra = '') => `<section class="panel"><div class="panel-head"><div><h2 class="h2">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${extra}</div><div class="panel-body">${body}</div></section>`;
const toTab = (id, label) => `<button type="button" class="link small" data-act="insTab" data-v="${id}">${label}</button>`;
const vbars = (rows) => { const max = Math.max(...rows.map((r) => r.value), 1); return `<div class="vbars">${rows.map((r) => `<div class="col-v"><b>${esc(r.top)}</b><div class="well"><i style="height:${(r.value / max) * 100}%;${r.color ? `background:${r.color}` : ''}"></i></div><span>${esc(r.label)}</span>${r.sub ? `<span class="t-${r.tone || 'pri'} strong">${esc(r.sub)}</span>` : ''}</div>`).join('')}</div>`; };
const funnelRows = (steps) => steps.map(([s, n], i) => `<div class="hbar"><span>${esc(s)}${i ? `<span class="sub">${pc(pct(n, steps[i - 1][1]), 0)} of the step before</span>` : ''}</span><div class="bar"><span style="width:${pct(n, steps[0][1])}%"></span></div><span class="strong">${nf.format(n)}</span></div>`).join('');

function insFindings() {
  const out = [];
  const silk = priceBands('silk'); const gap = silk.slice().sort((a, b) => (b.viewShare - b.unitShare) - (a.viewShare - a.unitShare))[0];
  if (gap && gap.viewShare - gap.unitShare > 5) out.push([`Silk sarees in one price band get ${pc(gap.viewShare, 0)} of silk views but ${pc(gap.unitShare, 0)} of silk sales. Shoppers look, then buy cheaper.`, 'pricing', 'See price bands']);
  const insPool = Object.keys(INS).map((id) => PROD[id]).filter(Boolean);
  const noVid = insPool.filter((p) => CAT[p.cat]?.saree && !p.video).length;
  if (BEH) out.push([`Shoppers who play a product video buy ${(BEH.convVideo / BEH.convNoVideo).toFixed(1)}× as often. ${noVid} live sarees have no video yet.`, 'behaviour', 'See behaviour']);
  const rc = {}; abCarts.forEach((a) => { rc[a.reason] = (rc[a.reason] || 0) + 1; }); const topEntry = Object.entries(rc).sort((a, b) => b[1] - a[1])[0];
  if (topEntry) out.push([`The most common point of abandonment: “${topEntry[0]}”, in ${pc(pct(topEntry[1], abCarts.length), 0)} of carts with contact details.`, 'carts', 'See abandoned carts']);
  if (BEH) { const b = BEH.buckets; out.push([`Visitors who stay over 2 minutes on a product buy at ${pc((b[4].conv * b[4].share + b[5].conv * b[5].share) / (b[4].share + b[5].share))}; under 30 seconds, ${pc((b[0].conv * b[0].share + b[1].conv * b[1].share) / (b[0].share + b[1].share))}.`, 'behaviour', 'See time on page']); }
  if (BEH) { const zero = BEH.searches.filter((s) => !s.res); if (zero.length) out.push([`${nf.format(sumBy(zero, 'n'))} searches found nothing: ${zero.map((s) => s.q).join(', ')}. That is demand the store does not stock.`, 'demand', 'See demand']); }
  const oos = insList.filter((x) => x.oosViews);
  if (oos.length) out.push([`${nf.format(sumBy(oos, 'oosViews'))} views landed on sold-out colours, and ${nf.format(sumBy(oos, 'notify'))} shoppers asked to be told when they are back.`, 'demand', 'See sold-out demand']);
  return out;
}

const INS_VIEW = {};
INS_VIEW.overview = () => {
  if (!BEH) return '<p class="muted">Insights ready once products load.</p>';
  const T = { views: sumBy(insList, 'views'), carts: sumBy(insList, 'carts'), checkouts: sumBy(insList, 'checkouts'), units: sumBy(insList, 'units'), abVal: sumBy(insList, 'abandonedValue') };
  const counts = Object.keys(VERDICT).filter((v) => v !== 'Steady').map((v) => [v, insList.filter((x) => x.verdict === v).length]).filter(([, n]) => n);
  const top = [...insList].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const stuck = [...insList].sort((a, b) => b.abandonedValue - a.abandonedValue).slice(0, 6);
  const li = (x, right, sub) => `<li class="click" data-open="insight:${x.id}" style="cursor:pointer">${sw(PROD[x.id], 'sm')}<span class="grow">${esc(PROD[x.id].name)}<span class="sub">${sub}</span></span><span class="strong">${right}</span></li>`;
  return `<div class="kpis">
      ${kpiBox('Product page views', nf.format(T.views), `<span class="faint">${nf.format(sumBy(insList, 'visitors'))} visitors</span>`)}
      ${kpiBox('Added to cart', pc(pct(T.carts, T.views)), `<span class="faint">${nf.format(T.carts)} adds</span>`)}
      ${kpiBox('Carts that were paid for', pc(pct(T.units, T.carts), 0), `<span class="faint">${nf.format(T.units)} sold</span>`)}
      ${kpiBox('Left in carts', inrS(T.abVal), `<span class="faint">${nf.format(T.carts - T.units)} carts</span>`)}
      ${kpiBox('Time on a product page', `<span style="font-size:1.25rem">${secs(BEH.avgTime)}</span>`, '<span class="faint">Average, visible tab only</span>')}
    </div>
    <div class="grid g-main">
      ${panel('What the data says', 'Worked out from the last 30 days. Each one links to the detail.', `<ul class="list findings">${insFindings().map(([t, tab, l]) => `<li><span class="mark" aria-hidden="true"></span><span class="grow">${esc(t)}</span>${toTab(tab, l)}</li>`).join('')}</ul>`)}
      ${panel('From product page to payment', 'Every live product, added together.', funnelRows([['Viewed a product', T.views], ['Added to cart', T.carts], ['Started checkout', T.checkouts], ['Paid', T.units]]))}
    </div>
    <div class="grid g3" style="margin-top:16px">
      ${panel('How products are selling', 'Every live product sorts into one group.', `<ul class="list">${counts.map(([v, n]) => `<li><span class="grow">${pill(v, VERDICT[v][0])}<span class="sub">${esc(VERDICT[v][1].split('. ')[0])}.</span></span><button type="button" class="link" data-act="insVerdict" data-v="${esc(v)}">${plural(n, 'product')}</button></li>`).join('')}</ul>`)}
      ${panel('Selling best', 'By payments received.', `<ul class="list">${top.map((x) => li(x, inrS(x.revenue), `${plural(x.units, 'sold', 'sold')}, ${pc(x.conv)} of viewers bought`)).join('')}</ul>`)}
      ${panel('Carted most, bought least', 'Value left in carts.', `<ul class="list">${stuck.map((x) => li(x, inrS(x.abandonedValue), `${nf.format(x.carts)} carts, ${pc(x.cartToBuy, 0)} paid`)).join('')}</ul>`)}
    </div>`;
};

INS_VIEW.products = () => listView('insights', {
  rows: insList, noun: 'product', placeholder: 'Product name or weave', minWidth: 1260, open: 'insight',
  text: (x) => `${PROD[x.id].name} ${PROD[x.id].weave}`,
  tabs: [{ id: 'all', label: 'All', filter: null }, ...Object.keys(VERDICT).filter((v) => v !== 'Steady').map((v) => ({ id: v, label: v, filter: (x) => x.verdict === v, note: VERDICT[v][1], hot: ['Carted, not bought', 'Return risk'].includes(v) }))],
  filters: [{ id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (x, v) => PROD[x.id].cat === v }],
  tools: `<button type="button" class="btn btn-sec btn-sm" data-act="exportExcel" data-what="insights">${icon('dl')}Export CSV</button>`,
  sort: { key: 'revenue', dir: 'desc' },
  columns: [
    { key: 'name', label: 'Product', sort: (x) => PROD[x.id].name, render: (x) => prodCell(PROD[x.id], `, ${inr(PROD[x.id].price)}`) },
    { key: 'views', label: 'Views', sort: true, align: 'r', render: (x) => `${nf.format(x.views)}<span class="sub">${nf.format(x.visitors)} people</span>` },
    { key: 'avgTime', label: 'Time on page', sort: true, align: 'r', render: (x) => secs(x.avgTime) },
    { key: 'cartRate', label: 'Added to cart', sort: true, align: 'r', render: (x) => `${pc(x.cartRate)}<span class="sub">${nf.format(x.carts)} adds</span>` },
    { key: 'cartToBuy', label: 'Cart to paid', sort: true, align: 'r', render: (x) => `<span class="${x.cartToBuy <= LOW_C2B ? 't-bad' : x.cartToBuy >= 40 ? 't-ok' : ''} strong">${pc(x.cartToBuy, 0)}</span>` },
    { key: 'units', label: 'Sold', sort: true, align: 'r', render: (x) => `${nf.format(x.units)}<span class="sub">${pc(x.conv, 2)} of views</span>` },
    { key: 'revenue', label: 'Payments', sort: true, align: 'r', render: (x) => `<span class="strong">${inrS(x.revenue)}</span>` },
    { key: 'abandonedValue', label: 'Left in carts', sort: true, align: 'r', render: (x) => `${inrS(x.abandonedValue)}<span class="sub">${nf.format(x.abandoned)} carts</span>` },
    { key: 'returnRate', label: 'Returned', sort: true, align: 'r', render: (x) => `<span class="${x.returnRate >= 15 ? 't-bad strong' : ''}">${pc(x.returnRate, 0)}</span>` },
    { key: 'verdict', label: 'Group', sort: true, render: (x) => pill(x.verdict, VERDICT[x.verdict][0]) },
  ],
});

INS_VIEW.carts = () => {
  const total = sumBy(insList, 'abandoned'), totalVal = sumBy(insList, 'abandonedValue');
  const contactable = abCarts.filter((a) => a.contactable);
  const sent = abCarts.filter((a) => a.status === 'Reminder sent' || a.status === 'Recovered'), rec = abCarts.filter((a) => a.status === 'Recovered');
  const tally = (k) => { const m = {}; abCarts.forEach((a) => { m[a[k]] = (m[a[k]] || 0) + 1; }); return Object.entries(m).map(([label, n]) => ({ label, value: pct(n, abCarts.length) })).sort((a, b) => b.value - a.value); };
  const stuck = [...insList].sort((a, b) => b.abandonedValue - a.abandonedValue).slice(0, 5);
  return `<div class="kpis">
      ${kpiBox('Carts left, 30 days', nf.format(total), `<span class="faint">${inrS(totalVal)} in value</span>`)}
      ${kpiBox('With contact details', nf.format(contactable.length), '<span class="faint">Logged in, or phone given, and opted in</span>')}
      ${kpiBox('Waiting for a reminder', nf.format(abCarts.filter((a) => a.status === 'Not contacted').length), '<span class="faint">Left in the last 7 days</span>')}
      ${kpiBox('Recovered after a reminder', pc(pct(rec.length, sent.length), 0), `<span class="faint">${rec.length} of ${sent.length} reminded</span>`)}
      ${kpiBox('Recovered value', inrS(sumBy(rec, 'value')), '<span class="faint">Paid within 7 days of the reminder</span>')}
    </div>
    <div class="grid g3">
      ${panel('Where shoppers stopped', 'The last step reached before leaving.', hbars(tally('stage'), { fmt: (v) => pc(v, 0) }))}
      ${panel('Likely reasons', 'From the last thing they did on the site. A signal, not a certainty.', hbars(tally('reason').slice(0, 7), { fmt: (v) => pc(v, 0), tone: 'warn' }))}
      ${panel('Left in carts most', 'Value, all shoppers.', `<ul class="list">${stuck.map((x) => `<li class="click" data-open="insight:${x.id}" style="cursor:pointer">${sw(PROD[x.id], 'sm')}<span class="grow">${esc(PROD[x.id].name)}<span class="sub">${nf.format(x.abandoned)} carts</span></span><span class="strong">${inrS(x.abandonedValue)}</span></li>`).join('')}</ul>`)}
    </div>
    <div style="margin-top:16px">${listView('carts', {
      rows: abCarts, noun: 'cart', placeholder: 'Shopper, phone or product', minWidth: 1180, open: 'cart',
      text: (a) => `${a.cid ? CUST[a.cid].name : 'Guest'} ${a.phone || ''} ${a.pids.map((id) => PROD[id].name).join(' ')}`,
      tabs: [
        { id: 'todo', label: 'Not contacted', filter: (a) => a.status === 'Not contacted', hot: true, note: 'Reminders go on WhatsApp only to shoppers who agreed to messages. One reminder per cart; send a second only with a coupon.' },
        { id: 'sent', label: 'Reminder sent', filter: (a) => a.status === 'Reminder sent' },
        { id: 'rec', label: 'Recovered', filter: (a) => a.status === 'Recovered' },
        { id: 'no', label: 'Can’t remind', filter: (a) => a.status === 'Not contactable' || a.status === 'Expired', note: 'Guests who left before giving a phone number, shoppers who did not opt in, and carts older than 7 days.' },
        { id: 'all', label: 'All', filter: null },
      ],
      filters: [{ id: 'stage', label: 'All stages', options: STAGES, test: (a, v) => a.stage === v }],
      bulk: [['cartRemindBulk', 'Send WhatsApp reminder']],
      sort: { key: 'hrs', dir: 'asc' },
      columns: [
        { key: 'who', label: 'Shopper', render: (a) => (a.cid ? who(CUST[a.cid].name, CUST[a.cid].city) : `<b>Guest</b><span class="sub">${esc(a.phone || 'No contact details')}</span>`) },
        { key: 'items', label: 'In the cart', render: (a) => prodCell(PROD[a.pids[0]], a.pids.length > 1 ? `, and ${a.pids.length - 1} more` : '') },
        { key: 'value', label: 'Value', sort: true, align: 'r', render: (a) => `<span class="strong">${inr(a.value)}</span>` },
        { key: 'stage', label: 'Got as far as', sort: (a) => STAGES.indexOf(a.stage), render: (a) => pill(a.stage, STAGE_TONE[a.stage]) },
        { key: 'reason', label: 'Likely reason', wrap: true, render: (a) => esc(a.reason) },
        { key: 'hrs', label: 'Left', sort: true, render: (a) => `${ago(a.hrs)}<span class="sub">${esc(a.device)}</span>` },
        { key: 'status', label: 'Recovery', sort: true, render: (a) => `${pill(a.status, REC_TONE[a.status], true)}${a.coupon ? `<span class="sub">With ${esc(a.coupon)}</span>` : ''}` },
      ],
    })}</div>`;
};

INS_VIEW.pricing = () => {
  const insCat = getInsCat();
  const bands = priceBands(insCat);
  const catX = insList.filter((x) => PROD[x.id].cat === insCat);
  const avgCart = catX.length ? sumBy(catX, 'carts') / Math.max(1, sumBy(catX, 'views')) * 100 : 0;
  const priced = catX.filter((x) => x.priceIdx >= 1.25 && x.cartRate < avgCart * 0.8).sort((a, b) => b.views - a.views).slice(0, 6);
  const bandLabel = (b) => b.hi === Infinity ? `${inr(b.lo)} and above` : b.lo === 0 ? `Under ${inr(b.hi)}` : `${inr(b.lo)} to ${inr(b.hi)}`;
  return `<div class="page-head" style="margin-bottom:12px"><p class="lede" style="margin:0">Pick an aisle. Bands compare how shoppers respond at each price level.</p>
      <div class="seg" role="group" aria-label="Category">${categories.map((c) => `<button type="button" data-act="insCat" data-v="${c.id}" aria-pressed="${insCat === c.id}">${esc(c.name)}</button>`).join('')}</div></div>
    <section class="panel"><div class="panel-head"><div><h2 class="h2">${esc(CAT[insCat].name)} by price band</h2><p>“Left soon after the price” means they left within 15 seconds of the price coming into view.</p></div></div>
      <div class="scroll" style="margin-top:12px"><table class="t" style="min-width:980px"><thead><tr>${['Price band', 'Products', 'Share of views', 'Added to cart', 'Bought', 'Share of sales', 'Earned per view', 'Left soon after the price'].map((h, i) => `<th class="${i > 1 ? 'r' : ''}"><span>${h}</span></th>`).join('')}</tr></thead><tbody>
      ${bands.length ? bands.map((b) => `<tr><td><b>${esc(bandLabel(b))}</b>${b.best ? ` ${pill('Earns the most per view', 'ok')}` : ''}</td><td>${b.n}</td><td class="r">${pc(b.viewShare, 0)}</td><td class="r">${pc(b.cartRate)}</td><td class="r">${pc(b.conv, 2)}</td><td class="r"><span class="${b.unitShare < b.viewShare - 5 ? 't-bad' : b.unitShare > b.viewShare + 5 ? 't-ok' : ''} strong">${pc(b.unitShare, 0)}</span></td><td class="r strong">${inr(b.rpv)}</td><td class="r">${pc(b.bounce, 0)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty"><strong>No live products in this aisle</strong></td></tr>'}
      </tbody></table></div></section>
    <div class="grid g2" style="margin-top:16px">
      ${panel('Priced above what shoppers accept', `More than 25% above the aisle’s middle price, with fewer carts than the aisle average of ${pc(avgCart)}.`, priced.length ? `<ul class="list">${priced.map((x) => `<li class="click" data-open="insight:${x.id}" style="cursor:pointer">${sw(PROD[x.id], 'sm')}<span class="grow">${esc(PROD[x.id].name)}<span class="sub">${inr(PROD[x.id].price)}, ${Math.round((x.priceIdx - 1) * 100)}% above the aisle’s middle. ${pc(x.priceBounce, 0)} left soon after the price.</span></span><span class="strong t-bad">${pc(x.cartRate)}</span></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Nothing in this aisle is priced out of reach.</p>')}
      ${panel('Price changes and what happened', 'The 14 days before each change against the 14 days after. Earned per view is the number that matters.', priceChanges.length ? `<div class="scroll" style="border:0"><table class="t"><thead><tr><th><span>Product</span></th><th><span>Change</span></th><th class="r"><span>RPV</span></th><th><span>Result</span></th></tr></thead><tbody>${priceChanges.map((c) => { const d = ((c.to - c.from) / c.from) * 100; const ok = c.rpvA >= c.rpvB; return `<tr class="click" data-open="insight:${c.pid}"><td>${prodCell(PROD[c.pid])}</td><td>${inr(c.from)} to ${inr(c.to)}<span class="sub">${d > 0 ? '+' : ''}${d.toFixed(0)}%, on ${fmtD(c.at)}</span></td><td class="r">${inr(c.rpvB)} to <b>${inr(c.rpvA)}</b></td><td>${pill(ok ? 'Paid off' : 'Earned less', ok ? 'ok' : 'bad')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">No recent price changes.</p>')}
    </div>`;
};

INS_VIEW.behaviour = () => {
  if (!BEH) return '';
  const maxHeat = Math.max(...BEH.heat.flatMap((r) => r.cells));
  return `<div class="kpis">
      ${kpiBox('Time on a product page', `<span style="font-size:1.25rem">${secs(BEH.avgTime)}</span>`, '<span class="faint">Average, visible tab only</span>')}
      ${kpiBox('Read the weave and zari details', pc(BEH.details, 0))}
      ${kpiBox('Reached the reviews', pc(BEH.reviews, 0))}
      ${kpiBox('Played the video', pc(BEH.videoRate, 0), '<span class="faint">On products that have one</span>')}
      ${kpiBox('On mobile', pc(BEH.mobile, 0))}
    </div>
    <div class="grid g2">
      ${panel('Time on page, and who buys', 'Share of visits in each band. Below, share who bought.', vbars(BEH.buckets.map((b) => ({ label: b.label, value: b.share, top: pc(b.share, 0), sub: `${pc(b.conv)} bought`, tone: b.conv > 2 ? 'ok' : 'pri' }))))}
      ${panel('How far down the page they get', 'Of everyone who opened a product page.', hbars([{ label: 'Saw the price', value: 100 }, { label: 'Swiped the photos', value: BEH.swipes }, { label: 'Read weave and zari', value: BEH.details }, { label: 'Zoomed into a photo', value: BEH.zoom }, { label: 'Reached reviews', value: BEH.reviews }], { fmt: (v) => pc(v, 0) }))}
      ${panel('Photos and video', 'Bought, of visitors who did and did not.', `<dl class="sum"><dt>Played the video</dt><dd class="strong t-ok">${pc(BEH.convVideo)}</dd><dt>Did not play it</dt><dd>${pc(BEH.convNoVideo)}</dd><dt>Zoomed into a photo</dt><dd class="strong t-ok">${pc(BEH.convZoom)}</dd><dt>Did not zoom</dt><dd>${pc(BEH.convNoZoom)}</dd></dl>`)}
      ${panel('Devices', '', hbars(BEH.devices.map(([label, value]) => ({ label, value })), { fmt: (v) => pc(v, 0) }))}
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="h2">When shoppers browse</h2><p>Product page views by day and time, 30 days.</p></div></div>
      <div class="panel-body"><div class="scroll" style="border:0"><table class="heat"><thead><tr><th></th>${BEH.hours.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${BEH.heat.map((r) => `<tr><th>${r.d}</th>${r.cells.map((v) => { const k = v / maxHeat; return `<td style="background:rgba(5,56,13,${(k * 0.9 + 0.05).toFixed(2)});color:${k > 0.55 ? '#fff' : 'var(--ink-2)'}" title="${r.d}: ${nf.format(v)} views">${nf.format(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div></section>
    <div class="grid g2" style="margin-top:16px">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">What they search for</h2><p>Searches on the store. “No results” is demand you don’t stock.</p></div></div>
        <div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>Search</span></th><th class="r"><span>Searches</span></th><th class="r"><span>Results</span></th><th class="r"><span>Bought</span></th></tr></thead><tbody>${BEH.searches.map((s) => `<tr><td><b>${esc(s.q)}</b></td><td class="r">${nf.format(s.n)}</td><td class="r">${s.res ? s.res : pill('No results', 'bad')}</td><td class="r">${s.res ? pc(s.conv) : '<span class="faint">—</span>'}</td></tr>`).join('')}</tbody></table></div></section>
      <div class="grid" style="align-content:start">
        ${panel('Filters used', 'Share of category visits that used each filter.', hbars(BEH.filters.map(([label, value]) => ({ label, value })), { fmt: (v) => pc(v, 0), tone: 'zari' }))}
        ${panel('Common paths to a purchase', 'Share of paid orders.', `<ul class="list">${BEH.paths.map(([steps, n]) => `<li><span class="grow small">${steps.map(esc).join(' <span class="faint">›</span> ')}</span><span class="strong">${n}%</span></li>`).join('')}</ul>`)}
      </div>
    </div>`;
};

INS_VIEW.demand = () => {
  const oos = insList.filter((x) => x.oosViews).sort((a, b) => b.notify - a.notify).slice(0, 8);
  const low = insList.filter((x) => x.daily > 0 && x.cover < 30).sort((a, b) => a.cover - b.cover).slice(0, 8);
  const wish = insList.filter((x) => x.wish >= 10).sort((a, b) => (b.wish - b.units) - (a.wish - a.units)).slice(0, 6);
  const zero = BEH ? BEH.searches.filter((s) => !s.res) : [];
  return `<div class="grid g2">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Sold-out colours people still want</h2><p>Views on a colour that shows as sold out, and “Notify me” requests.</p></div></div>
        <div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>Product</span></th><th><span>Sold out</span></th><th class="r"><span>Views</span></th><th class="r"><span>Notify me</span></th></tr></thead><tbody>${oos.length ? oos.map((x) => { const p = PROD[x.id]; return `<tr class="click" data-open="product:${p.id}"><td>${prodCell(p)}</td><td>${p.variants.filter((v) => v.stock === 0).map((v) => `${swv(v, p)} ${esc(v.colour)}`).join('<br>')}</td><td class="r">${nf.format(x.oosViews)}</td><td class="r strong">${x.notify}</td></tr>`; }).join('') : '<tr><td colspan="4" class="empty"><strong>Nothing sold out</strong></td></tr>'}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Running low against sales</h2><p>Days of stock left at the last 30 days’ pace.</p></div></div>
        <div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>Product</span></th><th class="r"><span>In stock</span></th><th class="r"><span>Sold, 30 days</span></th><th class="r"><span>Days left</span></th></tr></thead><tbody>${low.length ? low.map((x) => `<tr class="click" data-open="product:${x.id}"><td>${prodCell(PROD[x.id])}</td><td class="r">${x.stock}</td><td class="r">${x.units}</td><td class="r">${pill(`${Math.max(0, Math.floor(x.cover))} days`, x.cover < 7 ? 'bad' : x.cover < 21 ? 'warn' : 'neutral')}</td></tr>`).join('') : '<tr><td colspan="4" class="empty"><strong>Stock is comfortable</strong></td></tr>'}</tbody></table></div></section>
      ${panel('Bought together', 'Pairs to show beside each other on the product page and in the cart.', pairs.length ? `<ul class="list">${pairs.map((pr) => `<li>${sw(PROD[pr.a], 'sm')}${sw(PROD[pr.b], 'sm')}<span class="grow">${esc(PROD[pr.a].name)}<span class="sub">with ${esc(PROD[pr.b].name)}. ${pr.attach}% of buyers add the second.</span></span><span class="strong">${pr.n} orders</span></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Not enough orders with more than one item yet.</p>')}
      ${panel('Wishlisted, not bought', 'Candidates for a price-drop or back-in-stock message.', `<ul class="list">${wish.map((x) => `<li class="click" data-open="insight:${x.id}" style="cursor:pointer">${sw(PROD[x.id], 'sm')}<span class="grow">${esc(PROD[x.id].name)}<span class="sub">${inr(PROD[x.id].price)}, ${nf.format(x.units)} sold</span></span><span class="strong">${nf.format(x.wish)} saved</span></li>`).join('')}</ul>`)}
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Colour demand against stock</h2><p>Share of product views against share of pieces in stock. Buy more of the colours in red.</p></div></div>
        <div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>Colour</span></th><th class="r"><span>Share of views</span></th><th class="r"><span>Share of stock</span></th></tr></thead><tbody>${colourDemand.map((c) => `<tr><td><span class="sw sm" style="--b:${c.hex};--z:${c.hex};vertical-align:middle;margin-right:8px"></span>${esc(c.colour)}</td><td class="r">${pc(c.viewShare)}</td><td class="r"><span class="${c.gap > 1.5 ? 't-bad strong' : ''}">${pc(c.stockShare)}</span></td></tr>`).join('')}</tbody></table></div></section>
      ${panel('Searches that found nothing', 'Weaves and styles shoppers asked for that the store does not carry.', `<ul class="list">${zero.map((s) => `<li><span class="grow"><b>${esc(s.q)}</b></span><span class="strong">${nf.format(s.n)} searches</span></li>`).join('')}</ul>`)}
    </div>`;
};

INS_VIEW.tracking = () => {
  const ev = [
    ['product_viewed', 'A product page opens', 'product, colour, price, where they came from', 'Browser'],
    ['product_engaged', 'Every 5 seconds while the page is on screen', 'product, seconds', 'Browser'],
    ['section_reached', 'A section scrolls into view', 'product, section', 'Browser'],
    ['media_used', 'Photo swipe, zoom, video play or finished', 'product, kind, photo number', 'Browser'],
    ['added_to_cart / removed_from_cart', 'Cart changes', 'product, colour, price', 'Browser and server'],
    ['wishlist_added, notify_me', 'Saved, or asked for a sold-out colour', 'product, colour', 'Server'],
    ['checkout_step', 'Address, shipping, payment options', 'step, cart value, pincode, COD, shipping fee', 'Server'],
    ['payment_failed', 'Razorpay reports a failed attempt', 'method, failure reason', 'Server, Razorpay webhook'],
    ['order_paid', 'Razorpay confirms payment', 'order, items, value, coupon', 'Server, Razorpay webhook'],
    ['search, filter_applied', 'Store search or a filter used', 'query, result count, filter, value', 'Browser'],
  ];
  return `<section class="panel"><div class="panel-head"><div><h2 class="h2">Events the store records</h2><p>Sales numbers come from the server, never the browser.</p></div></div>
      <div class="scroll" style="margin-top:12px"><table class="t" style="min-width:900px"><thead><tr><th><span>Event</span></th><th><span>Sent when</span></th><th><span>Carries</span></th><th><span>From</span></th></tr></thead><tbody>${ev.map(([e, w, c, s]) => `<tr><td><b>${esc(e)}</b></td><td class="wrap">${esc(w)}</td><td class="wrap">${esc(c)}</td><td>${pill(s, s.startsWith('Server') ? 'ok' : 'info')}</td></tr>`).join('')}</tbody></table></div></section>`;
};

PAGES.insights = () => {
  if (!isBuilt()) return '<div class="page-head"><h1 class="h1">Product insights</h1></div><p class="muted">Loading data…</p>';
  const insTab = getInsTab();
  return `<div class="page-head"><div><h1 class="h1">Product insights</h1><p class="lede">What sells, what gets carted and left, how shoppers react to price, and how long they spend on each product. Last 30 days.</p></div></div>
    <div class="panel ins-tabs"><div class="tabs" role="tablist" aria-label="Insights sections">${INS_TABS.map(([id, l]) => `<button type="button" role="tab" class="tab" aria-selected="${insTab === id}" data-act="insTab" data-v="${id}">${l}</button>`).join('')}</div></div>
    ${INS_VIEW[insTab] ? INS_VIEW[insTab]() : ''}`;
};

/* =============== SETTINGS =============== */
/* =============== BARCODES AND STOCK =============== */
let bcTab = 'labels';
let labelFmt = 'thermal';
export const setBcTab = (v) => { bcTab = v; };
export const getBcTab = () => bcTab;
export const setLabelFmt = (v) => { labelFmt = v; };
export const getLabelFmt = () => labelFmt;
export const LABEL_FMT = {
  thermal: ['Thermal roll, 75 × 50 mm', '@page { size: 75mm 50mm; margin: 0; }'],
  a4:      ['A4 sheet, 14 per page (99 × 38 mm)', '@page { size: A4; margin: 15.1mm 4.65mm 0; }'],
};
const BC_TABS = [['labels', 'Labels'], ['pieces', 'Pieces'], ['moves', 'Stock movements'], ['setup', 'Printer and scanner setup']];

const varRows = () => products.flatMap((p) => p.variants.filter((v) => v.sku).map((v) => {
  const ps = piecesOf(v.id);
  return {
    id: v.id, p, v,
    inStock: ps.filter((u) => u.status === 'In stock').length,
    reserved: ps.filter((u) => ['Reserved', 'Packed'].includes(u.status)).length,
    sold30: ps.filter((u) => u.status === 'Shipped' && daysFrom(u.at) >= -30).length,
    unprinted: ps.filter((u) => !u.printed && ['In stock', 'Reserved', 'Returned'].includes(u.status)).length,
  };
}));

const BC_VIEW = {};
BC_VIEW.labels = () => {
  const rows = varRows();
  const unprinted = rows.reduce((a, r) => a + r.unprinted, 0);
  return `<div class="page-head" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Label format">${Object.entries(LABEL_FMT).map(([k, [l]]) => `<button type="button" data-act="labelFmt" data-v="${k}" aria-pressed="${labelFmt === k}">${esc(l)}</button>`).join('')}</div>
    <button type="button" class="btn btn-pri" data-act="printUnprinted" ${unprinted ? '' : 'disabled'}>${icon('barcode')}Print ${plural(unprinted, 'new label')}</button></div>
    ${listView('labels', {
      rows, noun: 'colour', placeholder: 'Product, colour or SKU', minWidth: 1100,
      text: (r) => `${r.p.name} ${r.v.colour} ${r.v.sku}`,
      tabs: [
        { id: 'new', label: 'Labels to print', filter: (r) => r.unprinted > 0, hot: true, note: 'Pieces received but not yet labelled. Label them before they go on the shelf, or the packing bench can’t scan them.' },
        { id: 'all', label: 'All colours', filter: null },
      ],
      filters: [{ id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (r, v) => r.p.cat === v }],
      bulk: [['printSelected', 'Print labels for pieces in stock']],
      sort: { key: 'unprinted', dir: 'desc' },
      columns: [
        { key: 'name', label: 'Product', sort: (r) => r.p.name, render: (r) => prodCell(r.p) },
        { key: 'colour', label: 'Colour', sort: (r) => r.v.colour, render: (r) => `<span style="display:inline-flex;align-items:center;gap:10px">${swv(r.v, r.p)}${esc(r.v.colour)}${r.v.size ? `, ${r.v.size}` : ''}</span>` },
        { key: 'sku', label: 'SKU', sort: (r) => r.v.sku, render: (r) => esc(r.v.sku) },
        { key: 'inStock', label: 'In stock', sort: true, align: 'r', render: (r) => (r.inStock ? nf.format(r.inStock) : '<span class="t-bad strong">0</span>') },
        { key: 'reserved', label: 'Reserved', sort: true, align: 'r', render: (r) => nf.format(r.reserved) },
        { key: 'sold30', label: 'Sold, 30 days', sort: true, align: 'r', render: (r) => nf.format(r.sold30) },
        { key: 'unprinted', label: 'Labels to print', sort: true, align: 'r', render: (r) => (r.unprinted ? pill(`${r.unprinted} new`, 'warn') : '<span class="faint">—</span>') },
        { key: 'act', label: '', render: (r) => `<button type="button" class="btn btn-sec btn-sm" data-act="stockIn" data-id="${esc(r.v.id)}">Receive stock</button>` },
      ],
    })}`;
};

BC_VIEW.pieces = () => listView('pieces', {
  rows: pieces, noun: 'piece', placeholder: 'Piece code, product or order', minWidth: 1100, open: 'piece',
  text: (u) => `${u.code || u.id} ${PROD[u.pid]?.name || ''} ${u.oid || ''}`,
  tabs: ['In stock', 'Reserved', 'Packed', 'Shipped', 'Returned', 'Written off'].map((s) => ({
    id: s, label: s === 'Shipped' ? 'Sold and shipped' : s, filter: (u) => u.status === s, hot: s === 'Returned',
  })).concat([{ id: 'all', label: 'All', filter: null }]),
  filters: [{ id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (u, v) => PROD[u.pid]?.cat === v }],
  sort: { key: 'at', dir: 'desc' },
  columns: [
    { key: 'code', label: 'Piece', sort: true, render: (u) => `<b>${esc(u.code || u.id)}</b>${u.printed ? '' : '<span class="sub t-warn">Label not printed</span>'}` },
    { key: 'prod', label: 'Product', render: (u) => { const r = varRefLocal(u.vid); return prodCell(PROD[u.pid], '', r ? r.v : null); } },
    { key: 'colour', label: 'Colour', render: (u) => { const r = varRefLocal(u.vid); return r ? `${esc(r.v.colour)}${r.v.size ? `, ${r.v.size}` : ''}` : '—'; } },
    { key: 'status', label: 'Status', sort: true, render: (u) => pill(u.status === 'Shipped' ? 'Sold, shipped' : u.status, PIECE_TONE[u.status], true) },
    { key: 'oid', label: 'Order', sort: true, render: (u) => (u.oid ? `<button type="button" class="link" data-open="order:${esc(u.oid)}">${esc(u.oid)}</button>` : '<span class="faint">—</span>') },
    { key: 'at', label: 'Last moved', sort: true, render: (u) => esc(dtF.format(new Date(u.at))) },
    { key: 'received', label: 'Received', sort: true, render: (u) => esc(fmtD(u.received)) },
  ],
});

BC_VIEW.moves = () => listView('moves', {
  rows: moves, noun: 'movement', placeholder: 'Piece code, product or order', minWidth: 1100,
  text: (m) => `${m.code} ${PROD[m.pid]?.name || ''} ${m.oid || ''} ${m.note || ''}`,
  tabs: [
    { id: 'all', label: 'All', filter: null },
    { id: 'in', label: 'Received', filter: (m) => m.from === '—' },
    { id: 'sold', label: 'Shipped', filter: (m) => m.to === 'Shipped' },
    { id: 'ret', label: 'Returned', filter: (m) => m.to === 'Returned' || (m.from === 'Returned' && m.to === 'In stock') },
    { id: 'off', label: 'Written off', filter: (m) => m.to === 'Written off' },
  ],
  sort: { key: 'at', dir: 'desc' },
  columns: [
    { key: 'at', label: 'When', sort: true, render: (m) => esc(dtF.format(new Date(m.at))) },
    { key: 'code', label: 'Piece', sort: true, render: (m) => `<button type="button" class="link" data-open="piece:${esc(m.code)}"><b>${esc(m.code)}</b></button><span class="sub">${esc(PROD[m.pid]?.name || '')}</span>` },
    { key: 'move', label: 'Moved', render: (m) => `${m.from === '—' ? '<span class="faint">New</span>' : pill(m.from, PIECE_TONE[m.from])} <span class="faint">›</span> ${pill(m.to === 'Shipped' ? 'Sold, shipped' : m.to, PIECE_TONE[m.to])}` },
    { key: 'note', label: 'Detail', wrap: true, render: (m) => esc(m.note || '') },
    { key: 'by', label: 'By', sort: true, render: (m) => esc(m.by) },
  ],
});

BC_VIEW.setup = () => {
  const sample = pieces.find((u) => u.status === 'In stock');
  return `<div class="grid g2">
    <section class="panel"><div class="panel-head"><div><h2 class="h2">Sample label</h2><p>Scan it with a scanner, or use a phone camera app, to confirm the symbology is readable.</p></div></div>
      <div class="panel-body">${sample ? `<div class="bc-sample">${code128(sample.code || sample.id, 60)}<div class="pl-code">${esc(sample.code || sample.id)}</div></div>` : '<p class="muted" style="margin:0">Receive some stock first.</p>'}</div></section>
    <section class="panel"><div class="panel-head"><div><h2 class="h2">Scanner settings</h2><p>Any USB or Bluetooth 1D/2D scanner that works as a keyboard.</p></div></div>
      <div class="panel-body"><ul class="list small">
        <li><span class="grow"><b>Mode</b><span class="sub">Keyboard (HID). Most scanners ship this way.</span></span></li>
        <li><span class="grow"><b>Suffix</b><span class="sub">Enter (carriage return) after each scan.</span></span></li>
        <li><span class="grow"><b>Symbologies</b><span class="sub">Code 128 on. Labels, packing slips and courier AWBs all use it.</span></span></li>
        <li><span class="grow"><b>Keyboard layout</b><span class="sub">Match the computer’s (usually US English), or hyphens in piece codes come through wrong.</span></span></li>
      </ul></div></section>
    <section class="panel"><div class="panel-head"><div><h2 class="h2">Label printer</h2></div></div>
      <div class="panel-body"><ul class="list small">
        <li><span class="grow"><b>Thermal roll</b><span class="sub">Any 203 dpi direct-thermal label printer with 75 × 50 mm labels. Print dialog: that label size, scale 100%, no margins.</span></span></li>
        <li><span class="grow"><b>A4 sheet</b><span class="sub">14-up sheets of 99 × 38 mm labels. Print at 100% (Actual size), not Fit to page.</span></span></li>
        <li><span class="grow"><b>Quality</b><span class="sub">Print a test label and scan it from 15 cm before printing a batch.</span></span></li>
      </ul></div></section>
    <section class="panel"><div class="panel-head"><div><h2 class="h2">What goes on each label</h2></div></div>
      <div class="panel-body"><ul class="list small">
        <li><span class="grow">Brand, product name, weave, fabric, zari, border, colour, size, length and whether a blouse piece is included.</span></li>
        <li><span class="grow">MRP inclusive of all taxes, net quantity, packer’s name and address, and customer care contact.</span></li>
        <li><span class="grow">The barcode and the piece code in plain text, so a piece can be keyed in if a label is damaged.</span></li>
      </ul><p class="sub" style="margin-top:8px">Confirm the declarations required on your labels with your accountant or a Legal Metrology consultant.</p></div></section>
  </div>`;
};

// Local helper to avoid an import cycle with data.js — mirrors varRef() but inline.
const varRefLocal = (vid) => {
  for (const p of products) { const v = p.variants.find((x) => x.id === vid); if (v) return { p, v }; }
  return null;
};

PAGES.barcodes = () => `<div class="page-head"><div><h1 class="h1">Barcodes and stock</h1><p class="lede">Every piece carries a Code 128 label. The barcode holds the piece code; the label prints its weave, colour, size and price. Scan any label, anywhere in the admin, to open it.</p></div></div>
  <div class="panel ins-tabs"><div class="tabs" role="tablist" aria-label="Barcode sections">${BC_TABS.map(([id, l]) => `<button type="button" role="tab" class="tab" aria-selected="${bcTab === id}" data-act="bcTab" data-v="${id}">${esc(l)}</button>`).join('')}</div></div>
  ${BC_VIEW[bcTab] ? BC_VIEW[bcTab]() : ''}`;

/* =============== PACKING =============== */
// pack: { oid, got: { itemIndex: pieceCode }, ticks: { itemIndex: true } }
let pack = null;
let packFb = { tone: 'info', text: 'Scan an order number, the courier label, or any piece to start.' };
export const scanStats = { today: 0, wrong: 0, shipped: [] };

export const getPack = () => pack;
export const setPack = (next) => { pack = next; };
export const getPackFb = () => packFb;
export const setPackFb = (tone, text) => { packFb = { tone, text }; };

export const readyToPack = () => orders
  .filter((o) => o.status === 'Label generated')
  .sort((a, b) => (a.promised && b.promised ? (a.promised < b.promised ? -1 : 1) : 0));

export const packDone = (o) => o.items.every((it, i) => pack?.got[i] && (!it.stitch || pack.ticks[i]));

PAGES.packing = () => {
  const ready = readyToPack();
  const o = pack && ORD[pack.oid];
  const fbTone = { ok: 'n-ok', bad: 'n-bad', warn: 'n-warn', info: 'n-info' }[packFb.tone] || 'n-info';
  const shortItems = ready.flatMap((x) => x.items.filter((it) => it.short));
  const kpiBox = (l, v, f = '') => `<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-val">${v}</div>${f ? `<div class="kpi-foot">${f}</div>` : ''}</div>`;
  const panel = (title, desc, body) => `<section class="panel"><div class="panel-head"><div><h2 class="h2">${esc(title)}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div></div><div class="panel-body">${body}</div></section>`;
  return `<div class="page-head"><div><h1 class="h1">Packing</h1><p class="lede">Scan the order or its courier label, scan every piece into the box, then scan the label again or press Mark as shipped. Shipped pieces count as sold.</p></div></div>
    <div class="kpis">
      ${kpiBox('Ready to pack', nf.format(ready.length), `<span class="faint">${ready.filter((x) => x.promised && daysFrom(x.promised) <= 0).length} due today or late</span>`)}
      ${kpiBox('Shipped this session', nf.format(scanStats.shipped.length), `<span class="faint">${plural(scanStats.shipped.reduce((a, s) => a + s.n, 0), 'piece')}</span>`)}
      ${kpiBox('Scans today', nf.format(scanStats.today))}
      ${kpiBox('Wrong scans stopped', nf.format(scanStats.wrong), scanStats.wrong ? '<span class="faint">Caught before the box was sealed</span>' : '')}
      ${kpiBox('No piece in stock', nf.format(shortItems.length), shortItems.length ? '<span class="t-bad">Restock or contact the customer</span>' : '<span class="faint">Every order is covered</span>')}
    </div>
    <div class="grid g-main">
      <section class="panel">
        <div class="scan-box"><span class="scan-ico" aria-hidden="true">${icon('barcode', 22)}</span><input class="ctl" id="scanIn" data-scan="pack" autocomplete="off" spellcheck="false" placeholder="Scan here: order, courier label or piece" aria-label="Scan box"></div>
        <div class="note ${fbTone} scan-fb" role="status">${esc(packFb.text)}</div>
        ${o ? `<div class="panel-head" style="padding-top:0"><div><h2 class="h2">Order ${esc(o.id)} <span class="faint">for</span> ${esc(CUST[o.cid].name)}</h2><p>${esc(CUST[o.cid].city)} ${esc(o.ship.pin || '')}. ${esc(o.ship.courier || '')}, AWB ${esc(o.ship.awb || '')}. ${o.promised ? `Ship by ${esc(fmtD(o.promised))}.` : ''}</p></div><span class="strong">${Object.keys(pack.got).length} of ${o.items.length}</span></div>
          <div class="panel-body"><ul class="list pack-list">${o.items.map((it, i) => {
            const p = PROD[it.pid]; const v = variantOf(it); const got = pack.got[i];
            return `<li><span class="pack-state ${got ? 'done' : 'todo'}" aria-hidden="true">${got ? '✓' : i + 1}</span>${swv(v, p, '')}
              <span class="grow"><b>${esc(p.name)}</b><span class="sub">${esc(v.colour)}${v.size ? `, size ${v.size}` : ''}. ${got ? `Scanned ${esc(got)}` : it.piece ? `Reserved piece ${esc(it.piece)}, or any piece of this colour in stock` : it.short ? '<span class="t-bad">No piece in stock</span>' : 'Any piece of this colour'}</span>
              ${it.stitch ? `<label class="small" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" data-act="packTick" data-i="${i}" ${pack.ticks[i] ? 'checked' : ''}> Stitched blouse for ${esc(it.stitch.profile)} is in the box</label>` : ''}</span>
              ${got ? pill('Packed', 'info') : pill('To scan', 'neutral')}</li>`;
          }).join('')}</ul></div>
          <div class="d-foot" style="border-radius:0 0 var(--r-lg) var(--r-lg)"><button type="button" class="btn btn-ghost" data-act="packSlip" data-id="${esc(o.id)}" style="margin-right:auto">Print packing slip</button><button type="button" class="btn btn-sec" data-act="packCancel">Cancel packing</button><button type="button" class="btn btn-pri" data-act="packShip" ${packDone(o) ? '' : 'disabled'}>Mark as shipped</button></div>`
        : '<div class="panel-body"><p class="empty" style="padding:28px 0"><strong>Nothing on the bench</strong>Scan an order, or pick one from the list.</p></div>'}
      </section>
      <div class="grid" style="align-content:start">
        ${panel('Ready to pack', 'Paid, label generated, oldest promise first.', ready.length ? `<ul class="list">${ready.slice(0, 12).map((x) => `<li><span class="grow"><b>${esc(x.id)}</b><span class="sub">${esc(CUST[x.cid].name)}, ${plural(x.items.length, 'piece')}. ${x.promised ? `Ship by ${esc(dmF.format(toDate(x.promised)))}` : ''}</span></span>${x.items.some((it) => it.short) ? pill('Short', 'bad') : ''}<button type="button" class="btn btn-sec btn-sm" data-act="packLoad" data-id="${esc(x.id)}">Pack</button></li>`).join('')}</ul>${ready.length > 12 ? `<p class="sub">And ${ready.length - 12} more.</p>` : ''}` : '<p class="muted" style="margin:0">Nothing waiting. Orders arrive here once paid and labelled.</p>')}
        ${panel('Shipped this session', '', scanStats.shipped.length ? `<ul class="list">${scanStats.shipped.map((s) => `<li class="click" data-open="order:${esc(s.oid)}" style="cursor:pointer"><span class="grow"><b>${esc(s.oid)}</b><span class="sub">${plural(s.n, 'piece')}</span></span><span class="small muted">${esc(tF.format(new Date(s.at)))}</span></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Nothing yet.</p>')}
      </div>
    </div>`;
};

/* Pack-scan logic. Called by the scanner module when the current route is /packing. */
export function packStartScan(o) {
  // Pre-seed got[] from pieces already Packed for this order.
  pack = { oid: o.id, got: {}, ticks: {} };
  o.items.forEach((it, i) => {
    const u = it.piece && PIECE[it.piece];
    if (u && u.status === 'Packed' && u.oid === o.id) pack.got[i] = u.code || u.id;
  });
}

export function packCancelLocal(why = 'Packing cancelled') {
  if (!pack) return;
  pack = null;
  packFb = { tone: 'info', text: why };
}

export function recordShipped(o, codes) {
  scanStats.shipped.unshift({ oid: o.id, at: new Date().toISOString(), n: codes.length });
  pack = null;
  packFb = { tone: 'ok', text: `${o.id} shipped. ${plural(codes.length, 'piece')} marked sold. Scan the next order.` };
}

PAGES.settings = () => {
  const S_ = SETTINGS;
  const tabs = [['store', 'Store details'], ['shipping', 'Shipping'], ['gst', 'GST and invoices'], ['returns', 'Returns policy'], ['account', 'Admin login']];
  const row = (t, d, ctl) => `<div class="setrow"><span><b>${t}</b><span>${d}</span></span>${ctl}</div>`;
  const swc = (id, on, l) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${esc(l)}"><span></span></label>`;
  const inp = (id, v, w = 120, l = '') => `<input class="ctl" id="${id}" style="width:${w}px" value="${esc(v)}" aria-label="${esc(l)}">`;
  const field = (id, l, v, hint = '', span = false, area = false) => `<div class="field${span ? ' span2' : ''}"><label for="${id}">${l}</label>${area ? `<textarea class="ctl" id="${id}">${esc(v)}</textarea>` : `<input class="ctl" id="${id}" value="${esc(v)}">`}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const S = {
    store: `<div class="form-grid">${field('st-name', 'Store name', S_.store.name)}${field('st-site', 'Website', S_.store.site)}${field('st-phone', 'Phone and WhatsApp', S_.store.phone)}${field('st-email', 'Email', S_.store.email)}${field('st-addr', 'Registered address', S_.store.address, 'Used on tax invoices and shipping labels', true, true)}</div>`,
    payments: `${row('Razorpay', 'UPI, cards, wallets, netbanking and EMI. Payments are verified by webhook; settlements go straight to your bank.', pill('Connected', 'ok', true))}
      ${Object.keys(S_.pay.methods).map((m) => row(m, '', swc(`pm-${m}`, S_.pay.methods[m], m))).join('')}
      ${row('Cash on delivery', 'Shown at checkout only for pincodes on your COD list.', swc('pm-cod', S_.pay.cod, 'Cash on delivery'))}
      ${row('COD pincodes', `${nf.format(S_.pay.codPins)} pincodes allowed${S_.pay.codFile ? `, from ${esc(S_.pay.codFile)}` : ''}. Upload a CSV or Excel export with one pincode per row to replace the list.`, '<label class="btn btn-sec btn-sm" for="pm-pins">Upload list</label><input type="file" id="pm-pins" accept=".csv,.txt" hidden>')}
      ${row('Maximum COD order value, ₹', 'Optional. Leave empty for no limit.', inp('pm-cap', S_.pay.codCap || '', 120, 'COD cap'))}`,
    shipping: `${row('Shiprocket', 'Orders are pushed on payment success and a label is generated. Couriers are whatever Shiprocket offers on the day.', pill('Connected', 'ok', true))}
      <h3 class="h2" style="margin:18px 0 8px">Weight slabs</h3><p class="small muted" style="margin:0 0 10px">Rates at checkout use the packed weight, so a heavy silk and a light cotton are charged differently.</p>
      <div class="scroll" style="border:1px solid var(--line);border-radius:var(--r-md)"><table class="t"><thead><tr><th><span>Category</span></th><th class="r"><span>Default weight, grams</span></th></tr></thead><tbody>${categories.map((c) => `<tr><td>${esc(c.name)}</td><td class="r"><input class="ctl" style="width:90px;text-align:right" data-weight="${c.id}" value="${c.weight}" inputmode="numeric" aria-label="${esc(c.name)} weight"></td></tr>`).join('')}<tr><td>Packaging, added to every parcel</td><td class="r"><input class="ctl" id="sh-pack" style="width:90px;text-align:right" value="${S_.ship.packaging}" inputmode="numeric" aria-label="Packaging weight"></td></tr></tbody></table></div>
      ${row('Free shipping above, ₹', '', inp('sh-free', S_.ship.freeAbove, 110, 'Free shipping threshold'))}
      <h3 class="h2" style="margin:18px 0 8px">Check a rate</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="ctl" style="width:140px" id="rate-pin" placeholder="6-digit pincode" inputmode="numeric" aria-label="Pincode"><select class="ctl" id="rate-cat" style="width:220px" aria-label="Category">${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button type="button" class="btn btn-sec" data-act="checkRate">Get rates</button></div><div id="rate-out" style="margin-top:12px"></div>`,
    gst: `<div class="form-grid">${field('gs-gstin', 'GSTIN', S_.gst.gstin)}<div class="field"><label>State</label><input class="ctl" value="${STORE_STATE}" disabled></div>${field('gs-inv', 'Invoice number series', S_.gst.inv)}${field('gs-cn', 'Credit note series', S_.gst.cn)}</div>
      <p class="note n-info" style="margin:14px 0 0">Each product has an HSN code and GST rate field; enter what your accountant confirms. Orders to ${STORE_STATE} show CGST and SGST; orders to other states show IGST. Every refund gets a credit note.</p>`,
    returns: `${row('Return window, days', 'Days after delivery a customer can request a return from her account.', inp('rp-window', POLICY.window, 90, 'Return window'))}
      ${row('Stitched blouses are not returnable', '', swc('rp-stitch', POLICY.excludeStitched, 'Exclude stitched'))}${row('Falls and pico work is not returnable', '', swc('rp-falls', POLICY.excludeFalls, 'Exclude falls and pico'))}${row('Customised pieces are not returnable', '', swc('rp-custom', POLICY.excludeCustom, 'Exclude customised'))}
      ${row('Reverse shipping paid by', 'If the customer pays, the fee is deducted from her refund.', `<select class="ctl" id="rp-payer" style="width:200px" aria-label="Reverse shipping"><option value="Store"${POLICY.reversePaidBy === 'Store' ? ' selected' : ''}>The store</option><option value="Customer"${POLICY.reversePaidBy === 'Customer' ? ' selected' : ''}>The customer</option></select>`)}
      ${row('Reverse shipping fee, ₹', 'Used when the customer pays.', inp('rp-fee', POLICY.reverseFee, 90, 'Reverse fee'))}`,
    crm: `<p class="small muted" style="margin:0 0 6px">Customers are tagged automatically. Saving re-tags everyone straight away.</p>
      ${row('VIP', 'Lifetime spend at or above, ₹', inp('crm-vip', CRM.vip, 130, 'VIP threshold'))}${row('Repeat', 'Number of orders at or above', inp('crm-rep', CRM.repeatOrders, 80, 'Repeat orders'))}${row('Dormant', 'No order for this many days', inp('crm-dorm', CRM.dormantDays, 90, 'Dormant days'))}${row('New', 'Everyone with one order who isn’t dormant', '')}
      <p class="sub">Right now: ${['VIP', 'Repeat', 'New', 'Dormant'].map((s) => `${customers.filter((c) => c.segment === s).length} ${s}`).join(', ')}.</p>`,
    account: `<div class="form-grid">${field('ac-email', 'Admin email', S_.account.email)}<div class="field"><span class="lbl">Password</span><button type="button" class="btn btn-sec" data-act="changePassword">Change password</button><span class="hint">Last changed ${esc(fmtD(S_.account.pwChanged))}</span></div></div>
      <h3 class="h2" style="margin:18px 0 8px">Signed-in devices</h3><ul class="list">${S_.account.devices.map((d, i) => `<li><span class="grow"><b>${esc(d.name)}</b><span class="sub">${esc(d.where)}${i === 0 ? ', this device' : ''}</span></span>${i === 0 ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-act="signOutDevice" data-i="${i}">Sign out</button>`}</li>`).join('')}</ul>`,
    integrations: `<div class="integr">${[['Razorpay', 'Payments, refunds and webhooks'], ['Shiprocket', 'Rates, labels, tracking, NDR and reverse pickup'], ['PostHog', 'Visitor behaviour and funnels'], ['Cloudinary', 'Product image optimisation and delivery']].map(([n, d]) => `<div><b>${esc(n)}</b><p class="small muted" style="margin:4px 0 10px">${esc(d)}</p>${pill('Connected', 'ok', true)} <button type="button" class="link small" data-act="testConnection" data-id="${esc(n)}">Test</button></div>`).join('')}</div>
      <p class="sub" style="margin-top:12px">Subscriptions to these services are billed by each provider directly.</p>`,
  };
  const saveable = !['integrations'].includes(setTab);
  return `<div class="page-head"><div><h1 class="h1">Settings</h1><p class="lede">Store-wide rules for payments, shipping, tax, returns and customer segments.</p></div></div>
    <div class="settings"><nav class="panel subnav" aria-label="Settings sections">${tabs.map(([id, l]) => `<button type="button" data-act="setTab" data-v="${id}" aria-current="${setTab === id}">${l}</button>`).join('')}</nav>
      <section class="panel"><div class="panel-head"><h2 class="h2">${tabs.find((t) => t[0] === setTab)[1]}</h2></div><div class="panel-body">${S[setTab]}<p class="note n-bad" id="set-error" role="alert" hidden style="margin-top:14px"></p></div>
      ${saveable ? '<div class="tfoot"><span></span><button type="button" class="btn btn-pri btn-sm" data-act="saveSettings">Save changes</button></div>' : ''}</section></div>`;
};
