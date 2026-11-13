// Printable document templates (tax invoice, credit note, shipping label, job card, piece labels).
import { esc, inr, fmtD, iso, TODAY, code128 } from './utils.js';
import { CUST, PROD, STORE_STATE, SETTINGS, varRef } from './data.js';
import { variantOf } from './renderers.js';
import { computeGstRate } from './gst.js';

export const S_ADDR = () => `<b>${esc(SETTINGS.store.name)}</b><br>${esc(SETTINGS.store.address).replace(/\n/g, '<br>')}<br>GSTIN ${esc(SETTINGS.gst.gstin)}`;

// Legacy shipping-label barcode wrapper, now backed by Code 128.
export function barcode(text) { return code128(text, 54); }

/* Piece label (both thermal and A4 use the same markup; CSS switches layout). */
export function labelHTML(u) {
  const ref = varRef(u.vid); if (!ref) return '';
  const { p, v } = ref; const S = SETTINGS.store;
  const line1 = [p.weave, p.fabric && p.fabric !== '—' ? p.fabric : null, p.zari, p.border].filter(Boolean).join(', ');
  const line2 = [v.colour, v.size ? `Size ${v.size}` : null, p.length, p.blousePiece ? 'With blouse piece' : null].filter(Boolean).join(', ');
  return `<div class="plabel">
    <div class="pl-top"><b>${esc(S.name)}</b><b>MRP ${inr(p.price)}</b></div>
    <div class="pl-name">${esc(p.name)}</div>
    <div class="pl-meta">${esc(line1)}<br>${esc(line2)}</div>
    <div class="pl-bc">${code128(u.code || u.id, 40)}</div>
    <div class="pl-code">${esc(u.code || u.id)}</div>
    <div class="pl-foot">MRP incl. of all taxes. Net qty 1 piece. Packed by ${esc(S.name)}, ${esc(S.address || '')}. ${esc(S.email || '')}</div>
  </div>`;
}

/* Amount-in-words for INR (Indian numbering: lakh, crore). */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`);
const three = (n) => { const h = Math.floor(n / 100); const r = n % 100; return `${h ? `${ONES[h]} Hundred${r ? ' ' : ''}` : ''}${r ? two(r) : ''}`; };
function amountInWords(amount) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Indian Rupees Zero Only';
  const cr = Math.floor(rupees / 1e7);
  const lk = Math.floor((rupees % 1e7) / 1e5);
  const th = Math.floor((rupees % 1e5) / 1e3);
  const hu = rupees % 1e3;
  const parts = [];
  if (cr) parts.push(`${two(cr)} Crore`);
  if (lk) parts.push(`${two(lk)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (hu) parts.push(three(hu));
  let out = `Indian Rupees ${parts.join(' ').trim() || 'Zero'}`;
  if (paise) out += ` and ${two(paise)} Paise`;
  return `${out} Only`;
}

/* GSTIN → first 2 digits are the state code. */
const stateCode = (gstin) => (gstin && gstin.length >= 2 ? gstin.slice(0, 2) : '');

export function docInvoice(o, credit = false) {
  const c = CUST[o.cid];
  const intra = c.state === STORE_STATE;
  const scale = o.sub ? o.total / o.sub : 1;
  const no = credit ? o.creditNote : o.invoice;
  const title = credit ? 'Credit note' : 'Tax invoice';
  const issuedOn = credit ? iso(TODAY) : o.placed;
  const paid = o.payment && o.payment.status === 'Paid';
  const S = SETTINGS;

  const items = o.items.map((it) => {
    const p = PROD[it.pid];
    const v = variantOf(it);
    const gross = it.price * it.qty * scale;
    // TAX-02: compute rate from HSN + per-unit price. Fall back to the product's
    // stored gst when HSN isn't recognised; the admin product form warns if the
    // stored override disagrees with the computed value.
    const computed = computeGstRate(p.hsn, it.price * scale);
    const rate = computed != null ? computed : (p.gst || 0);
    const taxable = gross / (1 + rate / 100);
    const tax = gross - taxable;
    return { p, v, qty: it.qty, unit: it.price * scale, taxable, tax, rate, gross };
  });

  const totTaxable = items.reduce((a, x) => a + x.taxable, 0);
  const totTax = items.reduce((a, x) => a + x.tax, 0);
  const shippingAmt = o.shipping || 0;
  const roundOff = Math.round(o.total) - (Math.round(totTaxable) + Math.round(totTax) + shippingAmt);

  const headerCells = [
    '<th scope="col">#</th>',
    '<th scope="col" class="l">Item</th>',
    '<th scope="col">HSN</th>',
    '<th scope="col">Qty</th>',
    '<th scope="col">Unit price<span class="inv-sub">incl. GST</span></th>',
    '<th scope="col">Taxable value</th>',
    intra
      ? '<th scope="col">CGST + SGST</th>'
      : '<th scope="col">IGST</th>',
    '<th scope="col">Amount</th>',
  ].join('');

  const rows = items.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="l">
        <div class="inv-item-name">${esc(x.p.name)}</div>
        <div class="inv-item-sub">
          <span class="inv-chip">${esc(x.v.colour)}</span>
          ${x.v.size ? `<span class="inv-chip">${esc(x.v.size)}</span>` : ''}
          <span class="inv-chip">${esc(x.p.weave)}</span>
        </div>
      </td>
      <td>${esc(x.p.hsn || '—')}</td>
      <td>${x.qty}</td>
      <td>${inr(x.unit)}</td>
      <td>${inr(x.taxable)}</td>
      <td>${inr(x.tax)}<span class="inv-sub">${x.rate}%</span></td>
      <td class="inv-amt">${inr(x.gross)}</td>
    </tr>`).join('');

  const careForWeave = items[0] && /silk|patola|kanjivaram|chanderi|paithani/i.test(items[0].p.weave)
    ? 'Dry clean only. Store folded in a muslin cloth, away from direct sunlight.'
    : 'Gentle hand wash in cold water. Dry in shade. Iron on low heat.';

  return `
  <div class="inv-sheet" aria-label="${esc(title)} ${esc(no || '')}">
    <header class="inv-mast">
      <img class="inv-logo" src="/images/gnanrudh-light-logo.jpeg" alt="${esc(S.store.name)} logo" width="128" height="128">

      <div>
        <div class="inv-brand-name">${esc(S.store.name)}</div>
        <div class="inv-brand-tag">Sarees &amp; clothing</div>
        <div class="inv-brand-line">Timeless elegance for every occasion</div>
        <div class="inv-seller">
          ${esc(S.store.address || `Bengaluru, ${STORE_STATE}`).replace(/\n/g, '<br>')}
          <br><span>GSTIN</span> <strong>${esc(S.gst.gstin || '—')}</strong>
          <span>&nbsp;State code</span> <strong>${esc(stateCode(S.gst.gstin))}</strong>
        </div>
      </div>
      <div class="inv-doc">
        <h2>${esc(title)}</h2>
        <div class="inv-no">${esc(no || '—')}</div>
        <div class="inv-copy">${credit ? `Against invoice ${esc(o.invoice || '')}` : 'Original for recipient'}</div>
        ${paid && !credit ? '<span class="inv-pill">Paid</span>' : ''}
        ${credit ? '<span class="inv-pill inv-pill-note">Refunded</span>' : ''}
      </div>
    </header>

    <div class="inv-zari" aria-hidden="true"></div>

    <div class="inv-body">
      <section class="inv-meta">
        <div><span class="inv-label">${credit ? 'Credit note date' : 'Invoice date'}</span><strong>${esc(fmtD(issuedOn))}</strong></div>
        <div><span class="inv-label">Order number</span><strong>${esc(o.id)}</strong></div>
        <div><span class="inv-label">Order date</span><strong>${esc(fmtD(o.placed))}</strong></div>
        <div><span class="inv-label">Place of supply</span><strong>${esc(c.state)}</strong></div>
      </section>

      <section class="inv-parties">
        <div class="inv-card">
          <h3>Billed to</h3>
          <p class="inv-name">${esc(c.name)}</p>
          <p>${esc(c.city)}, ${esc(c.state)} ${esc(o.ship.pin || '')}</p>
          <p>${esc(c.phone)}</p>
        </div>
        <div class="inv-card">
          <h3>Shipped to</h3>
          <p class="inv-name">${esc(c.name)}</p>
          <p>${esc(c.city)}, ${esc(c.state)} ${esc(o.ship.pin || '')}</p>
          <p>${esc(c.phone)}</p>
        </div>
        <div class="inv-card inv-supply">
          <h3>Supply details</h3>
          <dl>
            <dt>Supply type</dt><dd>${intra ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}</dd>
            <dt>Reverse charge</dt><dd>No</dd>
            <dt>Customer type</dt><dd>Unregistered</dd>
          </dl>
        </div>
      </section>

      <div class="inv-table-wrap">
        <table class="inv-t">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <section class="inv-summary">
        <div>
          <div class="inv-words">
            <span class="inv-label">Amount in words</span>
            <p>${esc(amountInWords(o.total))}</p>
          </div>
          <dl class="inv-pay">
            <dt>Payment mode</dt><dd>${esc(o.payment?.method || '—')}</dd>
            ${o.payment?.rzp ? `<dt>Transaction ID</dt><dd>${esc(o.payment.rzp)}</dd>` : ''}
            <dt>${credit ? 'Refunded on' : 'Paid on'}</dt><dd>${esc(fmtD(issuedOn))}</dd>
          </dl>
        </div>
        <div class="inv-totals">
          <div class="inv-row"><span>Taxable value</span><span>${inr(totTaxable)}</span></div>
          <div class="inv-row"><span>${intra ? 'CGST + SGST' : 'IGST'}</span><span>${inr(totTax)}</span></div>
          <div class="inv-row"><span>Shipping</span><span>${inr(shippingAmt)}</span></div>
          ${o.discount ? `<div class="inv-row"><span>Discount${o.coupon ? ` · ${esc(o.coupon)}` : ''}</span><span>− ${inr(o.discount)}</span></div>` : ''}
          ${roundOff ? `<div class="inv-row"><span>Round off</span><span>${roundOff > 0 ? '+' : '−'} ${inr(Math.abs(roundOff))}</span></div>` : ''}
          <div class="inv-grand">
            <span class="inv-t-label">${credit ? 'Credit total' : 'Total amount'}<small>Inclusive of all taxes</small></span>
            <strong>${inr(o.total)}</strong>
          </div>
        </div>
      </section>
    </div>

    <section class="inv-thanks">
      <div class="inv-orn" aria-hidden="true">◆ ◆ ◆</div>
      <h3>Thank you, ${esc(c.name.split(' ')[0])}</h3>
      <p>Thank you for choosing ${esc(S.store.name)}. Each piece was checked by hand before it left us, and we hope it becomes part of many celebrations to come.</p>
      <p class="inv-sign">With warmth, ${esc(S.store.name)}</p>
    </section>

    <footer>
      <div class="inv-foot">
        <div>
          <h4>Care for your saree</h4>
          <ul>
            <li>${esc(careForWeave)}</li>
            <li>Refold every few months to protect the weave along the creases.</li>
            <li>For help with this order, quote order number ${esc(o.id)}.</li>
          </ul>
        </div>
        <div class="inv-signatory">
          <div class="inv-for">For ${esc(S.store.name)}</div>
          <div class="inv-line"></div>
          <strong>Authorised signatory</strong>
        </div>
      </div>
      <div class="inv-contact">
        <span>Email <strong>${esc(S.store.email || 'care@houseofgnanrudh.com')}</strong></span>
        <span>Phone <strong>${esc(S.store.phone || '+91 00000 00000')}</strong></span>
        <span>Web <strong>${esc(S.store.site || 'houseofgnanrudh.com')}</strong></span>
      </div>
    </footer>

    <div class="inv-zari" aria-hidden="true"></div>
  </div>`;
}

/* Packing slip — printed at the packing bench. Includes a Code 128 of the order id
   so the packer can scan it instead of typing. */
export function docPackSlip(o) {
  const c = CUST[o.cid];
  const rows = o.items.map((it) => {
    const p = PROD[it.pid]; const v = variantOf(it);
    return `<tr>
      <td>☐</td>
      <td>${esc(p.name)}${it.stitch ? `<br><span class="doc-lbl" style="display:inline">With stitched blouse for ${esc(it.stitch.profile)}</span>` : ''}</td>
      <td>${esc(v.colour)}${v.size ? `, ${v.size}` : ''}</td>
      <td>${it.piece ? esc(it.piece) : `Any ${esc(v.sku)}`}</td>
    </tr>`;
  }).join('');
  return `<div class="doc">
    <div class="doc-head"><div>${S_ADDR()}</div><div style="text-align:right"><div class="doc-title">Packing slip</div>Order ${esc(o.id)}<br>${esc(fmtD(o.placed))}</div></div>
    <div style="max-width:320px;margin:0 0 14px">${code128(o.id, 54)}<div class="pl-code">${esc(o.id)}</div></div>
    <div class="doc-grid">
      <div><span class="doc-lbl">Ship to</span><b>${esc(c.name)}</b><br>${esc(c.city)}, ${esc(c.state)} ${esc(o.ship.pin)}<br>${esc(c.phone)}</div>
      <div><span class="doc-lbl">Courier</span>${esc(o.ship.courier || '')}<br>AWB ${esc(o.ship.awb || '')}</div>
    </div>
    <table class="doc-t"><thead><tr><th style="width:28px"></th><th>Item</th><th>Colour</th><th>Piece to pick</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="doc-foot">Scan the barcode above at the packing bench, then scan each piece.</p>
  </div>`;
}

export function docLabel(o) {
  const c = CUST[o.cid]; const cod = o.payment.method === 'Cash on delivery';
  return `<div class="doc label"><div class="doc-head"><div><span class="doc-lbl">Courier</span><b style="font-size:18px">${esc(o.ship.courier)}</b></div><div style="text-align:right">${cod ? `<b style="font-size:18px">COD ${inr(o.total)}</b>` : '<b style="font-size:18px">PREPAID</b>'}<br>${esc(o.ship.slab)}</div></div>
    <div style="margin:10px 0">${barcode(o.ship.awb)}<div style="text-align:center;letter-spacing:2px">AWB ${o.ship.awb}</div></div>
    <div class="doc-grid"><div><span class="doc-lbl">Deliver to</span><b>${esc(c.name)}</b><br>${esc(c.city)}, ${esc(c.state)}<br><b>${esc(o.ship.pin)}</b><br>${esc(c.phone)}</div><div><span class="doc-lbl">Return to</span>${S_ADDR()}</div></div>
    <div class="doc-grid" style="margin-top:10px"><div><span class="doc-lbl">Order</span>${o.id}</div><div><span class="doc-lbl">Contents</span>${esc(o.items.map((it) => PROD[it.pid].weave).join(', '))}</div></div></div>`;
}

export function openDoc(title, html) {
  document.getElementById('docTitle').textContent = title;
  document.getElementById('docBody').innerHTML = html;
  document.getElementById('docDlg').showModal();
}
