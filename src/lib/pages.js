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
  HERO_SLIDES, HOME_BANNERS,
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
  // Phase 4: chart window follows the selected dashRange toggle (Today / 7 / 30 days).
  const chartSpan = Math.max(dashRange, 7); // Today alone would be one point; show a week minimum.
  const days = Array.from({ length: chartSpan }, (_, i) => addDays(TODAY, i - (chartSpan - 1)));
  // Daily paid totals across ALL categories. The old implementation split
  // by seed category ids ('silk', 'cotton', 'designer', 'lehenga', 'acc')
  // which no longer exist in Mongo — admins now create their own
  // categories with generated ids — so both series collapsed to zero and
  // the chart rendered empty even when payments had come in. This single
  // honest series tracks "Payments received per day" instead.
  const paidPerDay = days.map((d) =>
    orders
      .filter((o) => paid(o) && daysFrom(o.placed) === daysFrom(d))
      .reduce((a, o) => a + (o.total || 0), 0),
  );
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
      ${analytics.connected ? kpi('Visitors on the site now', nf.format(analytics.live), `<span class="faint">Average visit ${analytics.avgSession}</span>`) : kpi('Visitors on the site now', '—', '<span class="faint"><a class="link" href="/settings#analytics">Connect analytics</a> to see this</span>')}
      ${kpi('Repeat customers', `${Math.round(pct(repeatCust, buyers))}%`, `<span class="faint">${repeatCust} of ${buyers} buyers</span>`)}
    </div>
    <div class="grid g-main">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Needs doing</h2><p>Work waiting on the team right now.</p></div></div>
        <ul class="queue" style="margin-top:12px">${items.map(([n, t, d, href, tone]) => `<li><a href="${href}"><span class="count" style="background:${toneBg[tone]}">${n}</span><span class="what"><b>${esc(t)}</b><span>${esc(d)}</span></span><span class="go">Open</span></a></li>`).join('') || '<li class="empty"><strong>All clear</strong></li>'}</ul></section>
      <div class="grid" style="align-content:start">
        <section class="panel"><div class="panel-head"><h2 class="h2">Payments</h2><a class="link" href="/analytics">Analytics</a></div><div class="panel-body"><dl class="sum"><dt>Today</dt><dd class="strong">${inr(sum(0, 1))}</dd><dt>Last 7 days</dt><dd class="strong">${inr(sum(0, 7))}</dd><dt>Last 30 days</dt><dd class="strong">${inr(sum(0, 30))}</dd></dl></div></section>
        <section class="panel"><div class="panel-head"><h2 class="h2">Sales by category, 30 days</h2></div><div class="panel-body">${hbars(categories.map((c) => ({ label: c.name, value: orders.filter((o) => paid(o) && inDays(o, 0, 30)).flatMap((o) => o.items).filter((it) => PROD[it.pid].cat === c.id).reduce((a, it) => a + it.price, 0) })).sort((a, b) => b.value - a.value), { fmt: inrS })}</div></section>
      </div>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="h2">Payments received, last ${chartSpan} days</h2><p>Hover a day to see the amount received.</p></div><div class="legend"><span><i style="background:#05380d"></i>Payments received</span></div></div>
      <div class="panel-body">${areaChart([paidPerDay], days.map((d) => dmF.format(d)), { names: ['Payments received'] })}</div></section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h2 class="h2">Latest orders</h2><a class="link" href="/orders">All orders</a></div>
      <div class="scroll" style="margin-top:12px"><table class="t" style="min-width:820px"><thead><tr><th><span>Order</span></th><th><span>Customer</span></th><th><span>Product</span></th><th><span>Payment</span></th><th class="r"><span>Total</span></th><th><span>Status</span></th></tr></thead><tbody>
      ${orders.slice(0, 6).map((o) => `<tr class="click" data-open="order:${o.id}"><td><b>${o.id}</b><span class="sub">${esc(dtF.format(new Date(o.placed)))}</span></td><td>${esc(CUST[o.cid].name)}<span class="sub">${esc(CUST[o.cid].city)}</span></td><td>${prodCell(PROD[o.items[0].pid], o.items.length > 1 ? `, and ${o.items.length - 1} more` : '')}</td><td>${pill(o.payment.status, PAY_TONE[o.payment.status])}<span class="sub">${esc(o.payment.method)}</span></td><td class="r strong">${inr(o.total)}</td><td>${pill(o.status, ORDER_TONE[o.status], true)}</td></tr>`).join('')}
      </tbody></table></div></section>`;
};

/* =============== ORDERS =============== */
PAGES.orders = () => `<div class="page-head"><div><h1 class="h1">Orders</h1><p class="lede">Paid orders are pushed to Shiprocket automatically and a label is generated.</p></div>
    <div style="display:flex;gap:8px"><button type="button" class="btn btn-sec" data-act="exportExcel" data-what="orders">${icon('dl')}Export CSV</button><button type="button" class="btn btn-pri" data-act="newOrder">${icon('plus')}New order</button></div></div>
  ${(() => {
    // Storefront orders carry a cid for a customer the admin's local
    // `customers` cache may not have seen yet (newly signed-up shopper,
    // bootstrap ran before the signup). Reading `.name` on undefined
    // threw — and because that fires inside every row's render, the
    // whole Orders list silently failed to paint, which is why
    // storefront orders looked missing. Same story for `PROD[pid]` when
    // the product was deleted. Every lookup below is now null-safe and
    // falls back to a readable placeholder.
    const cust = (cid) => CUST[cid] || { name: 'Guest', city: '—' };
    const prod = (pid) => PROD[pid] || null;
    return listView('orders', {
    rows: orders, noun: 'order', placeholder: 'Order number, customer, city, AWB or payment ID', minWidth: 1180, open: 'order',
    text: (o) => `${o.id} ${cust(o.cid).name} ${cust(o.cid).city} ${o.ship?.awb || ''} ${o.payment?.rzp || ''}`,
    tabs: [
      { id: 'open', label: 'Open', filter: (o) => !['Delivered', 'Returned to origin', 'Cancelled'].includes(o.status) },
      { id: 'pending', label: 'Payment pending', filter: (o) => o.status === 'Payment pending', hot: true, note: 'Razorpay has not confirmed these payments yet. They update automatically when the webhook arrives, or you can cancel them.' },
      { id: 'label', label: 'Label generated', filter: (o) => o.status === 'Label generated' },
      { id: 'transit', label: 'In transit', filter: (o) => o.status === 'In transit' },
      { id: 'ndr', label: 'Delivery failed', filter: (o) => o.status === 'Delivery failed', hot: true, note: 'Failed delivery alerts (NDR) from Shiprocket. Choose reattempt, update address or return to origin.' },
      { id: 'delivered', label: 'Delivered', filter: (o) => o.status === 'Delivered' },
      // Cancelled orders are kept in the DB (cancelOrder just flips the
      // status flag, it doesn't delete) so the admin can audit who
      // cancelled, when, and whether the piece reservation was released.
      // Shown as its own tab instead of being hidden inside "All" so the
      // volume is actually visible at a glance.
      {
        id: 'cancelled',
        label: 'Cancelled',
        // Catches every write path: admin cancel (`status='Cancelled'`),
        // storefront self-cancel on an unpaid order, and the Razorpay
        // "payment cancelled" flow (which stamps `payment.status`
        // 'Cancelled' alongside the order status). Case-insensitive so
        // a lower-case write from any older code path still shows up.
        filter: (o) => {
          const s = String(o.status || '').toLowerCase();
          const ps = String(o.payment?.status || '').toLowerCase();
          return s === 'cancelled' || ps === 'cancelled';
        },
        note: 'Cancelled by the customer or by staff. Items are released back to stock; refunds (if prepaid) are handled from the order detail.',
      },
      { id: 'all', label: 'All', filter: null },
    ],
    filters: [
      { id: 'pay', label: 'All payments', options: ['Paid', 'Pending', 'COD pending', 'COD collected', 'Refunded'], test: (o, v) => o.payment?.status === v },
      { id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (o, v) => o.items.some((it) => prod(it.pid)?.cat === v) },
    ],
    bulk: [['bulkLabels', 'Print labels'], ['bulkInvoices', 'Download tax invoices'], ['exportSelected', 'Export CSV']],
    sort: { key: 'placed', dir: 'desc' },
    columns: [
      { key: 'placed', label: 'Order', sort: true, render: (o) => `<b>${o.id}</b><span class="sub">${esc(dtF.format(new Date(o.placed)))}</span>` },
      { key: 'cust', label: 'Customer', sort: (o) => cust(o.cid).name, render: (o) => `${esc(cust(o.cid).name)}<span class="sub">${esc(cust(o.cid).city || '—')}, ${esc(o.ship?.pin || '—')}</span>` },
      { key: 'items', label: 'Products', render: (o) => {
          const first = prod(o.items[0]?.pid);
          const more = o.items.length > 1 ? `, and ${o.items.length - 1} more` : '';
          return first ? prodCell(first, more) : `<span class="faint">Product removed</span>${more}`;
        } },
      { key: 'pay', label: 'Payment', sort: (o) => o.payment?.status, render: (o) => `${pill(o.payment?.status || '—', PAY_TONE[o.payment?.status])}<span class="sub">${esc(o.payment?.method || '—')}</span>` },
      { key: 'total', label: 'Total', sort: (o) => o.total, align: 'r', render: (o) => `<span class="strong">${inr(o.total)}</span>${o.coupon ? `<span class="sub">${esc(o.coupon)}</span>` : ''}` },
      { key: 'ship', label: 'Shipment', render: (o) => (o.ship?.awb ? `${esc(o.ship.courier)}<span class="sub">${o.ship.awb}</span>` : '<span class="faint">—</span>') },
      { key: 'status', label: 'Status', sort: true, render: (o) => `${pill(o.status, ORDER_TONE[o.status], true)}${o.ndr ? `<span class="sub t-bad">${esc(o.ndr)}</span>` : ''}` },
    ],
    });
  })()}`;

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
    <div style="display:flex;gap:8px;align-items:center">
      <button type="button" class="btn btn-sec" data-act="bulkAddProductsTemplate">${icon('dl')}Download template</button>
      <button type="button" class="btn btn-sec" data-act="bulkAddProductsOpen">${icon('plus')}Bulk add products</button>
      <button type="button" class="btn btn-pri" data-act="newProduct">${icon('plus')}Add product</button>
    </div></div>
  ${listView('products', {
    rows: products, noun: 'product', placeholder: 'Name, weave or SKU', minWidth: 1180, open: 'product',
    text: (p) => `${p.name} ${p.weave} ${p.variants.map((v) => `${v.sku} ${v.colour}`).join(' ')}`,
    tabs: [{ id: 'all', label: 'All', filter: null }, ...categories.map((c) => ({ id: c.id, label: c.name, filter: (p) => p.cat === c.id })), { id: 'draft', label: 'Drafts', filter: (p) => p.status === 'Draft' }, { id: 'oos', label: 'Colour out of stock', filter: (p) => p.variants.some((v) => piecesOf(v.id, 'In stock').length === 0), hot: true }, { id: 'soldout', label: 'Sold out', filter: (p) => p.status === 'Active' && stockOf(p) === 0, hot: true, note: 'CAT-06: these are live on the store but have zero stock across every colour. The storefront shows them as sold out automatically.' }],
    filters: [
      { id: 'zari', label: 'Any zari', options: ['Pure zari', 'Tested zari', 'No zari'], test: (p, v) => p.zari === v },
      { id: 'occ', label: 'All occasions', options: OCCASIONS, test: (p, v) => p.occasion === v },
      { id: 'blouse', label: 'Blouse piece', options: [['y', 'Included'], ['n', 'Not included']], test: (p, v) => (v === 'y') === p.blousePiece },
    ],
    bulk: [['bulkStatus', 'Change status'], ['bulkFeature', 'Feature on homepage'], ['exportSelected', 'Export CSV']],
    // Freshest first. `created` is YYYY-MM-DD (day precision), so two
    // products added on the same day would tie and fall back to array
    // order; tacking on the numeric suffix of the P-id breaks the tie
    // deterministically (saveProduct allocates P${maxNum + 1}, so the
    // product with the largest suffix is always the newest for that day).
    sort: { key: 'created', dir: 'desc' },
    columns: [
      { key: 'name', label: 'Product', sort: true, render: (p) => prodCell(p) },
      { key: 'weave', label: 'Weave and zari', sort: true, render: (p) => `${esc(p.weave)}<span class="sub">${esc([p.fabric !== '—' ? p.fabric : '', p.zari].filter(Boolean).join(', ') || '—')}</span>` },
      { key: 'variants', label: 'Colours and stock', render: (p) => {
        // Live per-variant piece counts — same source of truth as the
        // Inventory page. The old swatch ring was tied to the stale
        // `v.stock` field, which always read 0, so every swatch always
        // showed the red outline. Dropped entirely — the "N sold out"
        // sub-line below is enough signal.
        const live = p.variants.map((v) => ({ v, n: piecesOf(v.id, 'In stock').length }));
        const soldOut = live.filter(({ n }) => n === 0).length;
        const total = live.reduce((a, x) => a + x.n, 0);
        return `<span style="display:inline-flex;gap:4px">${live.map(({ v, n }) => `<span title="${esc(v.colour)}${v.size ? `, ${v.size}` : ''}: ${n} in stock" style="position:relative;display:inline-block">${swv(v, p)}</span>`).join('')}</span><span class="sub ${soldOut ? 't-warn' : ''}">${total} in stock${soldOut ? `, ${soldOut} sold out` : ''}</span>`;
      } },
      { key: 'blouse', label: 'Blouse piece', render: (p) => (CAT[p.cat]?.saree ? (p.blousePiece ? 'Included<span class="sub">Stitching offered</span>' : '<span class="faint">Not included</span>') : '<span class="faint">—</span>') },
      { key: 'price', label: 'Price', sort: true, align: 'r', render: (p) => `<span class="strong">${inr(p.price)}</span>${p.compareAt ? `<span class="sub"><s>${inr(p.compareAt)}</s></span>` : ''}` },
      { key: 'rating', label: 'Reviews', sort: (p) => Number(p.rating), render: (p) => (p.reviews ? `★ ${p.rating}<span class="sub">${plural(p.reviews, 'review')}</span>` : '<span class="faint">None yet</span>') },
      {
        key: 'created',
        label: 'Added',
        // Composite sort: `created` (YYYY-MM-DD, lexicographically correct
        // for ISO dates) + a zero-padded P-id suffix so products saved on
        // the same day sort by id. Falls back to 0 for seed rows whose id
        // doesn't follow the P<N> pattern, which puts them after any
        // modern admin-created product on the same day — exactly what the
        // admin wants when they just hit "Add product".
        sort: (p) => {
          const n = parseInt(String(p.id || '').replace(/^P/, ''), 10);
          const suffix = Number.isFinite(n) ? String(n).padStart(8, '0') : '00000000';
          return `${p.created || ''}|${suffix}`;
        },
        render: (p) => esc(fmtD(p.created)),
      },
      { key: 'status', label: 'Status', sort: true, render: (p) => {
        // CAT-06: Active + zero stock everywhere = sold out on the store. Shown as
        // a distinct pill so staff see it at a glance; the underlying status stays Active.
        if (p.status === 'Active' && stockOf(p) === 0) return pill('Sold out', 'bad', true);
        return pill(p.status === 'Active' ? 'Live' : p.status, p.status === 'Active' ? 'ok' : p.status === 'Draft' ? 'warn' : 'neutral', true);
      } },
      // Row-level actions. Confirmation on delete is handled by the action
      // in actions.js. The global click handler short-circuits on [data-act]
      // elements before trying to open the row, so clicking Edit/Delete
      // doesn't also trigger the row's open behaviour.
      { key: 'act', label: '', align: 'r', render: (p) => `<span style="display:inline-flex;gap:4px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="editProduct" data-id="${esc(p.id)}" title="Edit" aria-label="Edit ${esc(p.name)}">${icon('edit', 14)}</button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="deleteProduct" data-id="${esc(p.id)}" title="Delete" aria-label="Delete ${esc(p.name)}">${icon('trash', 14)}</button>
      </span>` },
    ],
  })}`;

/* =============== CATEGORIES =============== */
PAGES.categories = () => `<div class="page-head"><div><h1 class="h1">Categories</h1><p class="lede">Each category has its own landing page, story section and filters. New categories inherit the standard filters and product template.</p></div>
    <button type="button" class="btn btn-pri" data-act="newCategory">${icon('plus')}New category</button></div>
  <section class="panel"><div class="scroll" style="border-top:0"><table class="t" style="min-width:880px"><thead><tr><th><span>Category</span></th><th><span>Weaves and types</span></th><th class="r"><span>Products</span></th><th class="r"><span>Sales, 30 days</span></th><th><span>Default shipping weight</span></th><th><span>Shown on store</span></th><th><span></span></th></tr></thead><tbody>
  ${categories.map((c) => {
    const inCat = products.filter((p) => p.cat === c.id);
    const liveInCat = inCat.filter((p) => p.status === 'Active').length;
    // CAT-05: a category with zero live products is hidden from the store even if
    // visible=true. Flag it in the admin so staff see what customers see.
    const autoHidden = liveInCat === 0;
    const storefrontBadge = autoHidden ? '<span class="pill p-neutral" title="Hidden on the store because it has no live products">Empty, auto-hidden</span>' : '';
    const sales30 = orders.filter((o) => paid(o) && inDays(o, 0, 30)).flatMap((o) => o.items).filter((it) => PROD[it.pid]?.cat === c.id).reduce((a, it) => a + it.price, 0);
    // Effective store visibility — the toggle should mirror what the
    // customer actually sees. An empty category is auto-hidden regardless
    // of the stored `c.visible` flag, so the switch renders OFF. Once a
    // live product lands in the category, autoHidden flips to false and
    // the toggle returns to the admin's original on/off choice — so it
    // appears to "auto-switch on" without any explicit admin action.
    const effectivelyVisible = !autoHidden && c.visible !== false;
    return `<tr><td><div style="display:flex;align-items:center;gap:12px"><span class="cat-thumb">${c.image ? `<img src="${esc(c.image)}" alt="">` : ''}</span><span><b>${esc(c.name)}</b> ${storefrontBadge}<span class="sub">${esc(c.story || 'No story text yet')}</span></span></div></td><td class="wrap muted">${esc(c.weaves.join(', '))}</td><td class="r">${inCat.length}<span class="sub">${liveInCat} live</span></td><td class="r strong">${inrS(sales30)}</td><td>${nf.format(c.weight)} g</td><td><label class="switch"><input type="checkbox" ${effectivelyVisible ? 'checked' : ''} data-act="toggleCat" data-id="${c.id}" aria-label="Show ${esc(c.name)} on the store"${autoHidden ? ' disabled title="Add a live product to this category before it can be shown on the store"' : ''}><span></span></label></td><td class="r"><button type="button" class="btn btn-ghost btn-sm" data-act="editCategory" data-id="${c.id}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-act="deleteCategory" data-id="${c.id}">Delete</button></td></tr>`;
  }).join('')}
  </tbody></table></div><div class="tfoot"><span>Store filters: category, weave, fabric, colour, occasion, zari type, border and price.</span></div></section>`;

/* =============== SHOP BY PRICE =============== */
PAGES.priceRanges = () => {
  const bandLabel = (b) => b.max == null ? `${inr(b.min)} and above` : b.min === 0 ? `Under ${inr(b.max)}` : `${inr(b.min)} to ${inr(b.max)}`;
  const inBand = (b, price) => price >= (b.min || 0) && (b.max == null || price < b.max);
  const tile = (b) => {
    const id = `pr-img-${b.id || b._id}`;
    const hasImg = Boolean(b.image);
    const links = hasImg
      ? `<div class="occ-tile-links">
           <label class="link xs" for="${id}">Replace image</label>
           <button type="button" class="link xs" data-act="removePriceRangeImage" data-id="${b.id || b._id}">Remove</button>
         </div>`
      : `<div class="occ-tile-links">
           <label class="link xs" for="${id}">Upload image</label>
         </div>`;
    return `<div class="occ-tile-wrap">
      <label class="occ-tile occ-tile-md${hasImg ? ' has-img' : ''}" for="${id}" title="${hasImg ? 'Replace image' : 'Upload image'}">
        ${hasImg ? `<img src="${esc(b.image)}" alt="${esc(b.label)}" loading="lazy">` : `<span class="occ-tile-ph">${icon('plus', 14)}</span>`}
      </label>
      <input type="file" id="${id}" data-pr-img="${b.id || b._id}" accept="image/*" hidden>
      ${links}
    </div>`;
  };
  const row = (b) => {
    const match = products.filter((p) => inBand(b, p.price));
    const live = match.filter((p) => p.status === 'Active').length;
    const headline = b.title && b.title.trim() ? b.title : (b.label || bandLabel(b));
    const subLine = b.title && b.title.trim() ? (b.label || bandLabel(b)) : bandLabel(b);
    return `<tr>
      <td>${tile(b)}</td>
      <td><b>${esc(headline)}</b><span class="sub">${esc(subLine)}</span>${b.description ? `<span class="sub" style="opacity:.75;margin-top:4px">${esc(b.description)}</span>` : ''}</td>
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
    <section class="panel"><div class="scroll" style="border-top:0"><table class="t" style="min-width:820px">
      <thead><tr><th><span>Image</span></th><th><span>Band</span></th><th class="r"><span>Products</span></th><th class="r"><span>Live products</span></th><th><span>Shown on store</span></th><th class="r"><span></span></th></tr></thead>
      <tbody>${PRICE_RANGES.length ? PRICE_RANGES.map(row).join('') : '<tr><td colspan="6" class="empty"><strong>No price ranges yet</strong>Add the first one to show a “Shop by price” rail on the storefront.</td></tr>'}</tbody>
    </table></div>
    <div class="tfoot"><span>Overlapping bands are allowed — a product can appear in more than one.</span></div></section>`;
};

/* =============== HOME HERO SLIDES (panel) ===============
   Rendered inline inside PAGES.storefront — the standalone nav entry was
   removed so there is one Storefront-pages home. The panel markup lives in
   its own helper so it stays grep-able alongside the other PAGES.*. */
const heroSlidesPanel = () => {
  const tile = (s) => {
    const id = `hs-img-${s.id || s._id}`;
    const hasImg = Boolean(s.image);
    const links = hasImg
      ? `<div class="occ-tile-links">
           <label class="link xs" for="${id}">Replace image</label>
           <button type="button" class="link xs" data-act="removeHeroSlideImage" data-id="${s.id || s._id}">Remove</button>
         </div>`
      : `<div class="occ-tile-links">
           <label class="link xs" for="${id}">Upload image</label>
         </div>`;
    return `<div class="occ-tile-wrap">
      <label class="occ-tile occ-tile-md${hasImg ? ' has-img' : ''}" for="${id}" title="${hasImg ? 'Replace image' : 'Upload image'}">
        ${hasImg ? `<img src="${esc(s.image)}" alt="${esc(s.headline || 'Hero slide')}" loading="lazy">` : `<span class="occ-tile-ph">${icon('plus', 14)}</span>`}
      </label>
      <input type="file" id="${id}" data-hs-img="${s.id || s._id}" accept="image/*" hidden>
      ${links}
    </div>`;
  };
  const row = (s) => `<tr>
      <td>${tile(s)}</td>
      <td>
        <b>${esc(s.headline || 'Untitled slide')}</b>
        ${s.mobileImage ? `<span class="pill p-ok" title="Mobile crop set — ${esc(s.mobileImage)}" style="margin-left:6px">Mobile ✓</span>` : ''}
        <span class="sub">${esc(s.eyebrow || '—')}</span>
        ${s.supporting ? `<span class="sub" style="opacity:.7;margin-top:4px">${esc(s.supporting)}</span>` : ''}
        ${s.mobileImage ? `<span class="sub" style="margin-top:4px"><button type="button" class="link xs" data-act="removeHeroSlideMobile" data-id="${s.id || s._id}">Remove mobile image</button></span>` : ''}
      </td>
      <td>${s.badgeLabel ? `${esc(s.badgeLabel)} <span class="sub">${esc(s.badgeTone || 'gold')}</span>` : '<span class="faint">—</span>'}</td>
      <td class="r">${esc(String(s.order ?? 0))}</td>
      <td><label class="switch"><input type="checkbox" ${s.visible !== false ? 'checked' : ''} data-act="toggleHeroSlide" data-id="${s.id || s._id}" aria-label="Show ${esc(s.headline)} on the storefront"><span></span></label></td>
      <td class="r">
        <button type="button" class="btn btn-ghost btn-sm" data-act="editHeroSlide" data-id="${s.id || s._id}">Edit</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="deleteHeroSlide" data-id="${s.id || s._id}">Delete</button>
      </td>
    </tr>`;
  return `<section class="panel"><div class="panel-head"><div><h2 class="h2">Home hero slides</h2><p>Slides shown on the homepage's top-of-page carousel. Each slide carries its own image, copy and CTA. Auto-advances every 7 seconds when more than one slide is visible.</p></div><button type="button" class="btn btn-pri btn-sm" data-act="newHeroSlide">${icon('plus')}New slide</button></div>
    <div class="scroll" style="border-top:0"><table class="t" style="min-width:960px">
      <thead><tr><th><span>Image</span></th><th><span>Headline</span></th><th><span>Badge</span></th><th class="r"><span>Order</span></th><th><span>Shown on store</span></th><th class="r"><span></span></th></tr></thead>
      <tbody>${HERO_SLIDES.length ? HERO_SLIDES.map(row).join('') : '<tr><td colspan="6" class="empty"><strong>No hero slides yet</strong>Add one to show a carousel on the storefront homepage.</td></tr>'}</tbody>
    </table></div></section>`;
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
      { key: 'act', label: '', align: 'r', render: (c) => `<button type="button" class="btn btn-ghost btn-sm" data-act="deleteCustomer" data-id="${esc(c.id)}">Delete</button>` },
    ],
  })}`;

/* =============== REVIEWS =============== */
PAGES.reviews = () => `<div class="page-head"><div><h1 class="h1">Reviews</h1><p class="lede">Reviews publish on the store only after you approve them. Replies appear under the review.</p></div></div>
  ${listView('reviews', {
    rows: reviews, noun: 'review', placeholder: 'Product, customer or text', minWidth: 980, text: (r) => `${PROD[r.pid]?.name || ''} ${CUST[r.cid]?.name || ''} ${r.text}`,
    tabs: [{ id: 'pending', label: 'To approve', filter: (r) => r.status === 'Pending', hot: true }, { id: 'pub', label: 'Published', filter: (r) => r.status === 'Published' }, { id: 'rej', label: 'Rejected', filter: (r) => r.status === 'Rejected' }, { id: 'unverified', label: 'Unverified', filter: (r) => r.verified !== true, note: 'DATA-03: reviews not linked to a delivered order line. Legacy rows from before the verified-buyer rule.' }],
    bulk: [['approveReviews', 'Approve', 'btn-pri'], ['rejectReviews', 'Reject', 'btn-bad']],
    columns: [
      { key: 'rating', label: 'Rating', sort: true, render: (r) => `<span class="${r.rating >= 4 ? 't-ok' : r.rating === 3 ? 't-warn' : 't-bad'} strong">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>${r.verified ? '<span class="pill p-ok" style="margin-left:6px" title="This customer bought the product on a delivered order">Verified buyer</span>' : '<span class="pill p-warn" style="margin-left:6px" title="No linked delivered order">Unverified</span>'}` },
      { key: 'text', label: 'Review', wrap: true, render: (r) => `${esc(r.text)}<span class="sub">${esc(CUST[r.cid]?.name || `Customer ${r.cid} (removed)`)}, ${esc(cap(rel(daysFrom(r.at))))}</span>${r.reply ? `<span class="sub t-pri">Your reply: ${esc(r.reply)}</span>` : ''}` },
      { key: 'p', label: 'Product', render: (r) => PROD[r.pid] ? prodCell(PROD[r.pid]) : `<span class="faint">Product ${esc(r.pid)} (removed)</span>` },
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
  <section class="panel"><div class="panel-head"><div><h2 class="h2">Section banners</h2><p>Editorial banners on the storefront — the "Bridal Edit" strip on the homepage and the hero at the top of the About page. Each has its own image, eyebrow, title and description.</p></div></div>
    <div class="panel-body" style="display:grid;gap:16px">
      ${[
        { slot: 'bridal', label: 'The Bridal Edit (homepage)' },
        { slot: 'about', label: 'About page hero' },
      ].map((meta) => {
        const b = HOME_BANNERS.find((x) => x.slot === meta.slot) || { slot: meta.slot, image: '', eyebrow: '', title: '', description: '' };
        return `<div style="border:1px solid var(--line);padding:16px;display:grid;gap:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div><strong>${esc(meta.label)}</strong><span class="sub">slot: <code>${esc(meta.slot)}</code></span></div>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div style="flex:0 0 auto">
              ${b.image
                ? `<img src="${esc(b.image)}" alt="" style="width:160px;height:100px;object-fit:cover;border:1px solid var(--line);border-radius:4px;display:block">`
                : '<div class="small muted" style="width:160px;height:100px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center">No image</div>'}
              <label class="btn btn-sec btn-sm" for="hb-img-${meta.slot}" style="margin-top:6px;display:block;text-align:center">${b.image ? 'Replace image' : 'Upload image'}</label>
              <input type="file" id="hb-img-${meta.slot}" accept="image/*" hidden data-hb-slot="${meta.slot}">
            </div>
            <div style="flex:1 1 320px;display:grid;gap:8px;min-width:280px">
              <div class="field"><span class="lbl">Eyebrow (small line above title)</span><input class="ctl" id="hb-eyebrow-${meta.slot}" value="${esc(b.eyebrow || '')}" placeholder="For example: The House Collection"></div>
              <div class="field"><span class="lbl">Title</span><input class="ctl" id="hb-title-${meta.slot}" value="${esc(b.title || '')}" placeholder="For example: Explore Collections"></div>
              <div class="field"><span class="lbl">Description</span><textarea class="ctl" id="hb-desc-${meta.slot}" rows="3" placeholder="One or two short sentences">${esc(b.description || '')}</textarea></div>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-pri btn-sm" data-act="saveBanner" data-slot="${meta.slot}">Save ${esc(meta.label)}</button></div>
        </div>`;
      }).join('')}
    </div>
  </section>
  <section class="panel"><div class="panel-head"><div><h2 class="h2">Pages</h2><p>Words and policy content for the customer-facing pages. Images for these pages come from the catalogue — not managed here.</p></div></div><div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>Page</span></th><th><span>What it holds</span></th><th><span>Last updated</span></th><th><span></span></th></tr></thead><tbody>
    ${PAGES_CMS.map((p, i) => {
      // The Home page's hero is now managed in the "Home hero slides" panel
      // below — hide the Home row here so there is one source of truth.
      // `return ''` instead of filtering keeps every other row's `i` aligned
      // with its PAGES_CMS index, which editPage/deletePage all rely on via data-i.
      if (p.name === 'Home') return '';
      // LEGAL-01: flag policy pages with a body under 800 characters as still a stub.
      const bodyLen = (p.body || '').trim().length;
      const stub = bodyLen < 800;
      const stubBadge = stub ? `<span class="pill p-warn" title="Policy body is ${bodyLen} characters; recommend 800+">Stub body</span>` : '';
      return `<tr><td><b>${esc(p.name)}</b>${stubBadge}</td><td class="wrap muted">${esc(p.desc)}</td><td>${esc(fmtD(p.updated))}</td><td class="r"><button type="button" class="btn btn-ghost btn-sm" data-act="editPage" data-i="${i}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-act="deletePage" data-i="${i}">Delete</button></td></tr>`;
    }).join('')}
  </tbody></table></div></section>
  ${heroSlidesPanel()}`;

// Back-compat: the hero-slides screen used to live at its own URL. Keep the
// route alive by redirecting to the Storefront pages view where the panel
// now sits, so bookmarks / browser history don't land on a blank page.
PAGES.heroSlides = () => PAGES.storefront();

/* =============== ANALYTICS =============== */
PAGES.analytics = () => {
  const sum = (f) => orders.filter((o) => paid(o) && f(o)).reduce((a, o) => a + o.total, 0);
  const byCity = Object.entries(orders.filter((o) => paid(o) && inDays(o, 0, 30)).reduce((a, o) => { const c = CUST[o.cid].city; a[c] = (a[c] || 0) + o.total; return a; }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const repeaters = customers.filter((c) => c.orderCount >= 2);
  const gaps = repeaters.map((c) => { const ds = c.orders.map((id) => new Date(ORD[id].placed)).sort((a, b) => a - b); return (ds[ds.length - 1] - ds[0]) / 864e5 / (ds.length - 1); }).filter((x) => x > 0);
  // DATA-01/02: analytics.connected is false until a provider is wired. Guard every
  // panel so stripping the fakes doesn't crash the page.
  const f0 = analytics.funnel[0] ? analytics.funnel[0][1] : 0;
  const notConnected = '<div class="panel-body"><p class="note n-neutral" style="margin:0">Connect an analytics provider on <a class="link" href="/settings#analytics">Settings → Analytics</a> to populate this panel.</p></div>';
  const topProducts = products.filter((p) => p.status === 'Active').sort((a, b) => b.views - a.views).slice(0, 6);
  return `<div class="page-head"><div><h1 class="h1">Analytics</h1><p class="lede">Payments from Razorpay, and visitor behaviour from the analytics tool. Visitor numbers miss people who decline tracking or use ad blockers.</p></div></div>
    ${/* analytics.connected ? '' : '<p class="note n-warn" style="margin:12px 0">No analytics provider connected. Payments/categories/cities below come from real orders; visitor funnel, sources, abandoned carts and cohorts are blank. <a class="link" href="/settings#analytics">Connect analytics</a> to populate them.</p>' */ ''}
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Payments today</div><div class="kpi-val">${inrS(sum((o) => inDays(o, 0, 1)))}</div></div>
      <div class="kpi"><div class="kpi-label">This week</div><div class="kpi-val">${inrS(sum((o) => inDays(o, 0, 7)))}</div></div>
      <div class="kpi"><div class="kpi-label">This month</div><div class="kpi-val">${inrS(sum((o) => inDays(o, 0, 30)))}</div></div>
      ${analytics.connected ? `<div class="kpi"><div class="kpi-label">On the site now</div><div class="kpi-val">${analytics.live}</div><div class="kpi-foot"><span class="faint">${analytics.pagesPerSession} pages a visit</span></div></div>
      <div class="kpi"><div class="kpi-label">Average visit</div><div class="kpi-val" style="font-size:1.25rem">${analytics.avgSession}</div></div>` : `<div class="kpi"><div class="kpi-label">Visitors</div><div class="kpi-val">—</div><div class="kpi-foot"><span class="faint"><a class="link" href="/settings#analytics">Connect analytics</a></span></div></div>`}
    </div>
    <div class="grid g2">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">From home to payment, 30 days</h2><p>Visitors reaching each step, and how many dropped off.</p></div></div>${analytics.connected ? `<div class="panel-body">
        ${analytics.funnel.map(([s, n], i) => `<div class="hbar"><span>${esc(s)}${i ? `<span class="sub">${Math.round(100 - pct(n, analytics.funnel[i - 1][1]))}% dropped off</span>` : ''}</span><div class="bar"><span style="width:${pct(n, f0)}%"></span></div><span class="strong">${nf.format(n)}</span></div>`).join('')}</div>` : notConnected}</section>
      <section class="panel"><div class="panel-head"><h2 class="h2">Payments by category, 30 days</h2></div><div class="panel-body">${hbars(categories.map((c) => ({ label: c.name, value: orders.filter((o) => paid(o) && inDays(o, 0, 30)).flatMap((o) => o.items).filter((it) => PROD[it.pid].cat === c.id).reduce((a, it) => a + it.price, 0) })).sort((a, b) => b.value - a.value), { fmt: inrS })}</div></section>
      <section class="panel"><div class="panel-head"><h2 class="h2">Payments by city, 30 days</h2></div><div class="panel-body">${hbars(byCity, { fmt: inrS })}</div></section>
      <section class="panel"><div class="panel-head"><h2 class="h2">Where visitors came from</h2></div>${analytics.connected ? `<div class="panel-body">${hbars(analytics.sources.map(([label, value]) => ({ label, value })), { fmt: (v) => `${v}%`, tone: 'zari' })}<p class="sub">Only where the browser reports it.</p></div>` : notConnected}</section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Most viewed products</h2><p>What holds attention, 30 days.</p></div></div><div class="panel-body"><ul class="list">${topProducts.map((p) => `<li>${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${(pct(p.carts, p.views)).toFixed(1)}% added to cart</span></span><span class="strong">${nf.format(p.views)}</span></li>`).join('')}</ul></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Top category pages and articles</h2></div></div><div class="panel-body">${hbars([...categories.map((c, i) => ({ label: c.name, value: [8420, 6110, 3980, 2870, 2240, 1510][i] })), ...journal.filter((j) => j.views).slice(0, 3).map((j) => ({ label: j.title, value: j.views, tone: 'zari' }))].sort((a, b) => b.value - a.value), {})}</div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Abandoned carts, 30 days</h2>${analytics.connected ? `<p>${nf.format(analytics.carts.count)} carts left, ${inrS(analytics.carts.value)} in value.</p>` : ''}</div></div>${analytics.connected ? `<div class="panel-body"><ul class="list">${analytics.carts.top.map(([pid, n]) => `<li>${sw(PROD[pid], 'sm')}<span class="grow">${esc(PROD[pid].name)}<span class="sub">${inr(PROD[pid].price)}</span></span><span class="strong">${n} carts</span></li>`).join('')}</ul></div>` : notConnected}</section>
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Repeat customers</h2></div></div><div class="panel-body"><dl class="sum"><dt>Ordered more than once</dt><dd class="strong">${repeaters.length} customers, ${Math.round(pct(repeaters.length, customers.filter((c) => c.orderCount).length))}%</dd><dt>Average days between orders</dt><dd class="strong">${gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : '—'} days</dd></dl></div></section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="h2">Returning customers by first-order month</h2><p>Of customers whose first order was in each month, the share who ordered again in each following month.</p></div></div>
      ${analytics.connected ? `<div class="scroll" style="margin-top:12px"><table class="t"><thead><tr><th><span>First order</span></th><th class="r"><span>Customers</span></th>${['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4'].map((m) => `<th class="r"><span>${m}</span></th>`).join('')}</tr></thead><tbody>
      ${analytics.cohorts.map((c) => `<tr><td><b>${c.m}</b></td><td class="r">${c.size}</td>${[0, 1, 2, 3, 4].map((k) => `<td class="r">${c.ret[k] !== undefined ? `<span style="display:inline-block;min-width:46px;padding:3px 6px;border-radius:4px;background:rgba(123,35,66,${(c.ret[k] / 100) * 0.9 + 0.05});color:${c.ret[k] > 50 ? '#fff' : 'var(--ink)'}">${c.ret[k]}%</span>` : ''}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>` : notConnected}</section>`;
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
    ${/* analytics.connected ? '' : '<p class="note n-warn" style="margin:12px 0">No analytics provider connected. Sold counts and revenue are real; views and conversion rates are placeholders. <a class="link" href="/settings#analytics">Connect analytics</a> to see actual numbers.</p>' */ ''}
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Top-selling product</div><div class="kpi-val" style="font-size:1.05rem;line-height:1.3">${topProduct ? esc(topProduct.name) : '—'}</div><div class="kpi-foot"><span class="faint">${topProduct ? `${plural(topProduct.sold, 'unit')} · ${inrS(topProduct.revenue)}` : 'No sales yet'}</span></div></div>
      <div class="kpi"><div class="kpi-label">Most visited category</div><div class="kpi-val" style="font-size:1.05rem;line-height:1.3">${topCategory && topCategory.views ? esc(topCategory.name) : '—'}</div><div class="kpi-foot"><span class="faint">${topCategory && topCategory.views ? `${nf.format(topCategory.views)} views` : 'No views tracked'}</span></div></div>
      <div class="kpi"><div class="kpi-label">Units sold</div><div class="kpi-val">${nf.format(totalSold)}</div><div class="kpi-foot"><span class="faint">${plural(orders.filter(paid).length, 'paid order')}</span></div></div>
      <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-val">${inrS(totalRev)}</div></div>
    </div>
    <div class="grid g2">
      <section class="panel"><div class="panel-head"><div><h2 class="h2">Most sold products</h2><p>By units shipped on paid orders.</p></div></div>
        <div class="panel-body"><ul class="list">${topSold.length ? topSold.map((p) => `<li data-open="product:${p.id}">${sw(p, 'sm')}<span class="grow">${esc(p.name)}<span class="sub">${esc(CAT[p.cat]?.name || 'Uncategorised')} · ${inrS(p.revenue)}</span></span><span class="strong">${plural(p.sold, 'unit')}</span></li>`).join('') : emptyList('No sales yet')}</ul></div></section>
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
import { isBuilt } from './insights.js';

// DATA-01/02: the PRNG-synthesized Product-insights renderers (overview KPIs,
// abandoned carts, price bands, behaviour, demand signals, tracking table) were
// removed together with insights.js's PRNG build(). When a real tracker lands
// (GA4 / PostHog / Clarity), rebuild tab views here off real events.

PAGES.insights = () => {
  if (!isBuilt()) return '<div class="page-head"><h1 class="h1">Product insights</h1></div><p class="muted">Loading data…</p>';
  return `<div class="page-head"><div><h1 class="h1">Product insights</h1><p class="lede">What sells, what gets carted and left, how shoppers react to price, and how long they spend on each product.</p></div></div>
    <section class="panel"><div class="panel-body"><p class="note n-neutral" style="margin:0">Connect an analytics provider on <a class="link" href="/settings#analytics">Settings → Analytics</a> to populate product insights. Views, carts, price acceptance, shopper behaviour and demand signals will fill in once real events are flowing.</p></div></section>`;
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

// Batched label printing. Picking "batch size: 500" and "copies: 2" lets
// the operator print 500 labels at a time instead of trying to shove 2,000
// into one print dialog (which hangs browsers and jams thermal rolls).
// State persists to localStorage so the operator can print batch 1, walk
// to the printer, come back and find the UI on batch 2.
export const LABEL_BATCH_SIZES = [100, 250, 500, 1000];
export const LABEL_COPIES = [1, 2, 3];
const LS_LABEL_BATCH_SIZE = 'hog_label_batch_size';
const LS_LABEL_BATCH_INDEX = 'hog_label_batch_index';
const LS_LABEL_COPIES = 'hog_label_copies';
const readLS = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch { return fallback; }
};
const writeLS = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* ignore quota / private mode */ } };
let labelBatchSize = readLS(LS_LABEL_BATCH_SIZE, 500);
let labelBatchIndex = readLS(LS_LABEL_BATCH_INDEX, 0);
let labelCopies = readLS(LS_LABEL_COPIES, 1);
if (!LABEL_BATCH_SIZES.includes(labelBatchSize)) labelBatchSize = 500;
if (!LABEL_COPIES.includes(labelCopies)) labelCopies = 1;
export const getLabelBatchSize = () => labelBatchSize;
export const setLabelBatchSize = (v) => {
  const n = Number(v);
  if (!LABEL_BATCH_SIZES.includes(n)) return;
  labelBatchSize = n;
  labelBatchIndex = 0; // size change invalidates the current index
  writeLS(LS_LABEL_BATCH_SIZE, labelBatchSize);
  writeLS(LS_LABEL_BATCH_INDEX, labelBatchIndex);
};
export const getLabelCopies = () => labelCopies;
export const setLabelCopies = (v) => {
  const n = Number(v);
  if (!LABEL_COPIES.includes(n)) return;
  labelCopies = n;
  labelBatchIndex = 0;
  writeLS(LS_LABEL_COPIES, labelCopies);
  writeLS(LS_LABEL_BATCH_INDEX, labelBatchIndex);
};
export const getLabelBatchIndex = () => labelBatchIndex;
export const setLabelBatchIndex = (v) => {
  const n = Math.max(0, Number(v) || 0);
  labelBatchIndex = n;
  writeLS(LS_LABEL_BATCH_INDEX, labelBatchIndex);
};

// Flatten the "work remaining" into an ordered array of pieces, repeated by
// the copies-per-piece setting. Scoped to the ticked variants when the
// Labels list has selections, otherwise every unprinted in-stock / returned
// piece across the catalogue. This is the single source of truth both the
// counter and the batch slicer read from, so they can never disagree.
export function labelQueueFor(variantIds /* Set | null */) {
  const eligible = pieces.filter((u) =>
    !u.printed
    && ['In stock', 'Returned'].includes(u.status)
    && (!variantIds || variantIds.has(u.vid)),
  );
  // Sort by product + colour + received so a batch stays grouped — much
  // easier to peel and stick labels when they're in rack order.
  eligible.sort((a, b) => {
    const pa = PROD[a.pid]?.name || '';
    const pb = PROD[b.pid]?.name || '';
    if (pa !== pb) return pa.localeCompare(pb);
    if (a.vid !== b.vid) return String(a.vid).localeCompare(String(b.vid));
    return String(a.received || '').localeCompare(String(b.received || ''));
  });
  if (labelCopies <= 1) return eligible;
  const out = [];
  for (const u of eligible) for (let i = 0; i < labelCopies; i += 1) out.push(u);
  return out;
}
const BC_TABS = [['labels', 'Labels'], ['pieces', 'Pieces'], ['moves', 'Stock movements'], ['setup', 'Printer and scanner setup']];

const varRows = () => products.flatMap((p) => p.variants.filter((v) => v.sku).map((v) => {
  const ps = piecesOf(v.id);
  return {
    id: v.id, p, v,
    inStock: ps.filter((u) => u.status === 'In stock').length,
    reserved: ps.filter((u) => ['Reserved', 'Packed'].includes(u.status)).length,
    sold30: ps.filter((u) => u.status === 'Shipped' && daysFrom(u.at) >= -30).length,
    // Labels-to-print tracks only pieces still sitting in the warehouse
    // waiting to be labelled — In stock plus Returned (which come back
    // to QC + relabelling). Reserved / Packed pieces are already pulled
    // for an order; printing a fresh label at this point would conflict
    // with the one that got them scanned into the Reserved state, so
    // those are intentionally left out of the count.
    unprinted: ps.filter((u) => !u.printed && ['In stock', 'Returned'].includes(u.status)).length,
  };
}));

const BC_VIEW = {};
BC_VIEW.labels = () => {
  // Newest products on top by default (matches Inventory + Products
  // pages). Composite key: product `created` desc, then P-id suffix
  // desc so same-day products stay deterministic; variants inside the
  // same product keep their natural order via the sort's stable
  // fallback.
  const rows = varRows().sort((a, b) => {
    const dc = String(b.p.created || '').localeCompare(String(a.p.created || ''));
    if (dc !== 0) return dc;
    const an = parseInt(String(a.p.id || '').replace(/^P/, ''), 10) || 0;
    const bn = parseInt(String(b.p.id || '').replace(/^P/, ''), 10) || 0;
    return bn - an;
  });
  const sel = LV.labels?.sel;
  // Build the queue the batch button will actually print. `labelQueueFor`
  // honours the row selection and multiplies by copies-per-piece, so the
  // counter below reflects the real print volume (not just "unique pieces").
  const scope = sel?.size ? sel : null;
  const queue = labelQueueFor(scope);
  const totalLabels = queue.length;
  const batchSize = getLabelBatchSize();
  const copies = getLabelCopies();
  const batchCount = totalLabels === 0 ? 0 : Math.ceil(totalLabels / batchSize);
  // Clamp index into range — localStorage may hold a stale index from
  // yesterday that's now past the end of today's shorter queue.
  let batchIdx = getLabelBatchIndex();
  if (batchIdx > Math.max(0, batchCount - 1)) {
    batchIdx = 0;
    setLabelBatchIndex(0);
  }
  const sliceStart = batchIdx * batchSize;
  const sliceEnd = Math.min(sliceStart + batchSize, totalLabels);
  const inThisBatch = Math.max(0, sliceEnd - sliceStart);
  const hasAnything = totalLabels > 0;
  const scopeLabel = scope ? ` (${plural(sel.size, 'colour')} selected)` : '';
  // Dropdown helpers kept inline so the whole header stays in one HTML
  // template. Each option carries a tiny "label text" transform — Copies
  // reads as "×1 per piece", batch size as "500 per batch", etc.
  const copiesOptions = LABEL_COPIES
    .map((n) => `<option value="${n}"${n === copies ? ' selected' : ''}>×${n} per piece</option>`)
    .join('');
  const batchSizeOptions = LABEL_BATCH_SIZES
    .map((n) => `<option value="${n}"${n === batchSize ? ' selected' : ''}>${nf.format(n)} per batch</option>`)
    .join('');
  return `<div class="page-head" style="margin-bottom:12px;flex-wrap:wrap;gap:12px">
    <div class="seg" role="group" aria-label="Label format">${Object.entries(LABEL_FMT).map(([k, [l]]) => `<button type="button" data-act="labelFmt" data-v="${k}" aria-pressed="${labelFmt === k}">${esc(l)}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label class="small muted" for="label-copies">Copies</label>
      <select id="label-copies" class="ctl" style="width:auto" data-act="labelCopies">${copiesOptions}</select>
      <label class="small muted" for="label-batch-size">Batch</label>
      <select id="label-batch-size" class="ctl" style="width:auto" data-act="labelBatchSize">${batchSizeOptions}</select>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <button type="button" class="btn btn-sec btn-sm" data-act="labelBatchPrev" ${batchIdx === 0 || !hasAnything ? 'disabled' : ''} aria-label="Previous batch">‹</button>
      <span class="small" style="min-width:140px;text-align:center">Batch ${hasAnything ? batchIdx + 1 : 0} of ${batchCount}</span>
      <button type="button" class="btn btn-sec btn-sm" data-act="labelBatchNext" ${batchIdx >= batchCount - 1 || !hasAnything ? 'disabled' : ''} aria-label="Next batch">›</button>
    </div>
    <button type="button" class="btn btn-pri" data-act="printBatch" ${hasAnything ? '' : 'disabled'}>${icon('barcode')}Print this batch</button>
  </div>
  <p class="small muted" style="margin:-4px 0 12px">
    ${hasAnything
      ? `${plural(inThisBatch, 'label')} in this batch${scopeLabel} · ${nf.format(totalLabels)} total unprinted ${copies > 1 ? `(×${copies} copies)` : ''}`
      : `Nothing waiting to be labelled${scopeLabel}. Receive stock to queue new labels.`}
  </p>
    ${listView('labels', {
      rows, noun: 'colour', placeholder: 'Product, colour or SKU', minWidth: 1100,
      text: (r) => `${r.p.name} ${r.v.colour} ${r.v.sku}`,
      tabs: [
        { id: 'new', label: 'Labels to print', filter: (r) => r.unprinted > 0, hot: true, note: 'Pieces received but not yet labelled. Label them before they go on the shelf, or the packing bench can’t scan them.' },
        { id: 'all', label: 'All colours', filter: null },
      ],
      filters: [{ id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (r, v) => r.p.cat === v }],
      bulk: [['printSelected', 'Print labels for pieces in stock']],
      // Default = pre-sorted order (newest products first). Clicking a
      // column header still re-sorts as expected.
      sort: null,
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

BC_VIEW.pieces = () => {
  // Distinct colour names in use across the pieces collection, driven by
  // the variant each piece is attached to. Built fresh on every render so
  // newly-received stock introduces its colour into the filter dropdown
  // without needing a refresh. Case-insensitive de-dup so "Red" and "red"
  // collapse into one option; sorted alphabetically for a scannable list.
  const colourSet = new Map();
  for (const u of pieces) {
    if (!u.printed) continue;
    const r = varRefLocal(u.vid);
    const name = r?.v?.colour;
    if (!name) continue;
    const key = String(name).trim().toLowerCase();
    if (!key) continue;
    if (!colourSet.has(key)) colourSet.set(key, String(name).trim());
  }
  const colourOptions = [...colourSet.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, label]) => [key, label]);

  return listView('pieces', {
  // Only pieces whose labels have already been printed belong here —
  // freshly-received, un-labelled pieces live under the "Labels to print"
  // tab on the Labels view until the barcode goes on the fabric.
  rows: pieces.filter((u) => u.printed), noun: 'piece', placeholder: 'Piece code, product or order', minWidth: 1100, open: 'piece', pageSize: 15,
  text: (u) => `${u.code || u.id} ${PROD[u.pid]?.name || ''} ${u.oid || ''}`,
  tabs: ['In stock', 'Reserved', 'Packed', 'Shipped', 'Returned', 'Written off'].map((s) => ({
    id: s, label: s === 'Shipped' ? 'Sold and shipped' : s, filter: (u) => u.status === s, hot: s === 'Returned',
  })).concat([{ id: 'all', label: 'All', filter: null }]),
  filters: [
    { id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (u, v) => PROD[u.pid]?.cat === v },
    {
      id: 'colour',
      label: 'All colours',
      options: colourOptions,
      // v is the lower-cased key stored in the dropdown value. Compare
      // against the piece's variant colour the same way so mixed-case
      // admin entries still match.
      test: (u, v) => {
        const r = varRefLocal(u.vid);
        const name = r?.v?.colour;
        return !!name && String(name).trim().toLowerCase() === v;
      },
    },
  ],
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
};

BC_VIEW.moves = () => listView('moves', {
  // Stock movements grow unbounded over time (823 rows in this install,
  // ~every piece has at least the "received" + a shipment move). Rendering
  // all of them in one table blows past the viewport and slows the
  // filter/search box; 15 per page matches the Pieces tab so the Barcodes
  // section feels consistent.
  rows: moves, noun: 'movement', placeholder: 'Piece code, product or order', minWidth: 1100, pageSize: 15,
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
    <section class="panel" style="grid-column:1/-1"><div class="panel-head"><div><h2 class="h2">Cleanup · orphan pieces</h2><p>Removes barcode pieces (and their stock-movement audit rows) whose product or colour variant no longer exists. Use this after a failed bulk import or any direct-DB edit. Safe to run anytime — pieces still attached to a live product are never touched.</p></div></div>
      <div class="panel-body"><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-sec" data-act="cleanupOrphansDryRun">${icon('search')}Preview (dry run)</button>
        <button type="button" class="btn btn-bad" data-act="cleanupOrphansRun">${icon('trash')}Delete orphans</button>
      </div><p class="sub" style="margin-top:8px">Dry run reports counts without changing anything. Delete runs the operation and returns the final counts.</p></div></section>
  </div>`;
};

// Local helper to avoid an import cycle with data.js — mirrors varRef() but inline.
const varRefLocal = (vid) => {
  for (const p of products) { const v = p.variants.find((x) => x.id === vid); if (v) return { p, v }; }
  return null;
};

/* =============== INVENTORY =============== */
// Aggregated stock view across every variant: in stock + reserved + sold 30d +
// stock value. Source of truth is the `pieces` collection (barcoded units) —
// matches what the Labels page uses for "In stock", so numbers never diverge.
const LOW_STOCK = 2;

const inventoryRows = () => products.flatMap((p) => p.variants.map((v) => {
  const ps = piecesOf(v.id);
  const inStock = ps.filter((u) => u.status === 'In stock').length;
  const reserved = ps.filter((u) => ['Reserved', 'Packed'].includes(u.status)).length;
  const sold30 = ps.filter((u) => u.status === 'Shipped' && daysFrom(u.at) >= -30).length;
  const value = inStock * (Number(p.price) || 0);
  const health = inStock === 0 ? 'out' : inStock <= LOW_STOCK ? 'low' : 'ok';
  // listView uses `r.id` to build data-open="product:<id>" on the row. The
  // product drawer only knows how to open a product id — not a variant id — so
  // use the product id here. The variant stays on `r.v` for the columns.
  return { id: p.id, p, v, inStock, reserved, sold30, value, health };
}));

PAGES.inventory = () => {
  // Sort by product added-date (newest first). Composite key breaks
  // ties for variants that share a product so order within a product
  // stays stable (first variant on top). Ties on created fall back to
  // the P-id suffix so same-day creates still have a deterministic
  // winner — matches the Products page sort.
  const rows = inventoryRows().sort((a, b) => {
    const dc = String(b.p.created || '').localeCompare(String(a.p.created || ''));
    if (dc !== 0) return dc;
    const an = parseInt(String(a.p.id || '').replace(/^P/, ''), 10) || 0;
    const bn = parseInt(String(b.p.id || '').replace(/^P/, ''), 10) || 0;
    return bn - an;
  });
  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const totalUnits = rows.reduce((a, r) => a + r.inStock, 0);
  const lowCount = rows.filter((r) => r.health === 'low').length;
  const outCount = rows.filter((r) => r.health === 'out').length;
  return `<div class="page-head"><div><h1 class="h1">Inventory</h1><p class="lede">Live stock across every colour variant, aggregated from the barcoded pieces. Low and out-of-stock variants are flagged so the store never shows a product it can’t ship.</p></div></div>
    <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">Units in stock</div><div class="kpi-val">${nf.format(totalUnits)}</div><div class="kpi-foot"><span class="faint">${plural(rows.length, 'variant')}</span></div></div>
      <div class="kpi"><div class="kpi-label">Stock value</div><div class="kpi-val">${inrS(totalValue)}</div><div class="kpi-foot"><span class="faint">at current MRP</span></div></div>
      <div class="kpi"><div class="kpi-label">Low stock</div><div class="kpi-val ${lowCount ? 't-warn' : ''}">${nf.format(lowCount)}</div><div class="kpi-foot"><span class="faint">1 to ${LOW_STOCK} in stock</span></div></div>
      <div class="kpi"><div class="kpi-label">Sold out</div><div class="kpi-val ${outCount ? 't-bad' : ''}">${nf.format(outCount)}</div><div class="kpi-foot"><span class="faint">live on the store but no pieces</span></div></div>
    </div>
    ${listView('inventory', {
      rows, noun: 'variant', placeholder: 'Product, colour or SKU', minWidth: 1180, open: 'product',
      text: (r) => `${r.p.name} ${r.v.colour} ${r.v.sku || ''}`,
      tabs: [
        { id: 'all', label: 'All', filter: null },
        { id: 'in', label: 'In stock', filter: (r) => r.health === 'ok' },
        { id: 'low', label: 'Low stock', filter: (r) => r.health === 'low', hot: true, note: `Variants with 1 to ${LOW_STOCK} pieces left. Receive new stock before they sell out on the store.` },
        { id: 'oos', label: 'Out of stock', filter: (r) => r.health === 'out', hot: true, note: 'No pieces in stock. These colours are shown as sold out on the storefront.' },
      ],
      filters: [
        { id: 'cat', label: 'All categories', options: categories.map((c) => [c.id, c.name]), test: (r, v) => r.p.cat === v },
        { id: 'status', label: 'All product statuses', options: [['Active', 'Live'], 'Draft', 'Hidden'], test: (r, v) => r.p.status === v },
      ],
      // Default = whatever order the rows are passed in (newest first,
      // see the pre-sort above). Admins can still click any column
      // header to override; a `null` default only drops the initial
      // forced sort.
      sort: null,
      columns: [
        { key: 'name', label: 'Product', sort: (r) => r.p.name, render: (r) => prodCell(r.p, '', r.v) },
        { key: 'colour', label: 'Colour and SKU', sort: (r) => r.v.colour, render: (r) => `<span style="display:inline-flex;align-items:center;gap:10px">${swv(r.v, r.p)}<span>${esc(r.v.colour)}${r.v.size ? `, ${r.v.size}` : ''}<span class="sub">${esc(r.v.sku || 'No SKU yet')}</span></span></span>` },
        { key: 'inStock', label: 'In stock', sort: true, align: 'r', render: (r) => (r.inStock ? `<span class="strong">${nf.format(r.inStock)}</span>` : '<span class="t-bad strong">0</span>') },
        { key: 'reserved', label: 'Reserved', sort: true, align: 'r', render: (r) => (r.reserved ? nf.format(r.reserved) : '<span class="faint">—</span>') },
        { key: 'sold30', label: 'Sold, 30 days', sort: true, align: 'r', render: (r) => (r.sold30 ? nf.format(r.sold30) : '<span class="faint">—</span>') },
        { key: 'value', label: 'Stock value', sort: true, align: 'r', render: (r) => (r.inStock ? `<span class="strong">${inr(r.value)}</span><span class="sub">${inr(r.p.price)} each</span>` : '<span class="faint">—</span>') },
        { key: 'health', label: 'Status', sort: true, render: (r) => r.health === 'out' ? pill('Sold out', 'bad', true) : r.health === 'low' ? pill(`Low, ${r.inStock} left`, 'warn', true) : pill('In stock', 'ok', true) },
        { key: 'act', label: '', align: 'r', render: (r) => {
          // Restock only shows when the variant actually needs it — healthy
          // in-stock rows stay uncluttered.
          if (r.health === 'ok') return '';
          if (!r.v.sku) return `<button type="button" class="btn btn-sec btn-sm" disabled title="Save the product once to assign a SKU before pieces can be received">Restock</button>`;
          return `<button type="button" class="btn btn-sec btn-sm" data-act="stockIn" data-id="${esc(r.v.id)}">${icon('plus')}Restock</button>`;
        } },
      ],
    })}`;
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
              <span class="grow"><b>${esc(p?.name || 'Product removed')}</b><span class="sub">${esc(v?.colour || 'variant removed')}${v?.size ? `, size ${v.size}` : ''}. ${got ? `Scanned ${esc(got)}` : it.piece ? `Reserved piece ${esc(it.piece)}, or any piece of this colour in stock` : it.short ? '<span class="t-bad">No piece in stock</span>' : 'Any piece of this colour'}</span>
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
