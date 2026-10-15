import type { PaymentMethod, TicketPayload } from "../shared/ipc";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const quantity = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  DEBIT: "Tarjeta de débito",
  CREDIT: "Tarjeta de crédito",
  TRANSFER: "Transferencia",
  VOUCHER: "Vale",
  OTHER: "Otro",
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

function dateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  return match
    ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`
    : value;
}

export function renderSaleNoteHtml(
  payload: TicketPayload,
  terms: string,
  showCashierName: boolean,
  logoDataUrl: string | null,
): string {
  const rows = payload.items
    .map(
      (item) => `<tr>
    <td class="quantity">${escapeHtml(quantity.format(item.quantity))}${item.unit === "KG" ? " kg" : ""}</td>
    <td>${escapeHtml(item.productName)}</td>
    <td class="amount">${escapeHtml(money.format(item.unitPrice))}</td>
    <td class="amount">${escapeHtml(money.format(item.lineTotal))}</td>
  </tr>`,
    )
    .join("");
  const paymentMarkup = payload.payments
    .map(
      (payment) =>
        `<div class="pair"><span>${escapeHtml(paymentLabels[payment.method] ?? "Otro")}</span><strong>${escapeHtml(money.format(payment.amount))}</strong></div>`,
    )
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nota de venta ${escapeHtml(payload.sale.folio)}</title>
  <style>
    @page { size: Letter; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111; font: 12px/1.5 Arial, sans-serif; }
    p { margin: 3px 0; }
    .top, .metadata, .bottom { display: flex; justify-content: space-between; gap: 24px; }
    .top { padding-bottom: 18px; border-bottom: 2px solid #111; }
    .business { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .business h1 { margin: 0 0 6px; font-size: 22px; }
    .logo { max-width: 30mm; max-height: 18mm; object-fit: contain; margin-bottom: 6px; }
    .document { text-align: right; max-width: 45%; overflow-wrap: anywhere; }
    .document h2 { margin: 6px 0 0; font-size: 24px; }
    .document-label { border: 1px solid #111; padding: 4px 8px; font-size: 10px; font-weight: 700; letter-spacing: .06em; }
    .metadata { margin: 18px 0; }
    .metadata > div { min-width: 0; overflow-wrap: anywhere; }
    .label { font-size: 10px; text-transform: uppercase; color: #555; }
    .payments { padding: 12px; border: 1px solid #aaa; border-radius: 6px; margin-bottom: 18px; break-inside: avoid; }
    .pair { display: flex; justify-content: space-between; gap: 20px; }
    .pair strong { white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    th { padding: 8px; font-size: 10px; text-align: left; border-bottom: 2px solid #111; }
    td { padding: 9px 8px; vertical-align: top; border-bottom: 1px solid #ddd; overflow-wrap: anywhere; }
    tr { break-inside: avoid; }
    .quantity { width: 12%; }
    .price { width: 20%; }
    .amount { text-align: right; }
    .bottom { margin-top: 20px; break-inside: avoid; }
    .terms { flex: 1; font-size: 10px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .totals { width: 43%; }
    .total { border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; font-size: 20px; font-weight: 700; }
    .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 60px; break-inside: avoid; text-align: center; font-size: 10px; }
    .signatures > div { width: 45%; border-top: 1px solid #555; padding-top: 8px; }
  </style></head><body>
    <header class="top"><div class="business">
      ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="">` : ""}
      <h1>${escapeHtml(payload.store.name)}</h1><p>${escapeHtml(payload.store.address)}</p>
      ${payload.store.phone ? `<p>Tel. ${escapeHtml(payload.store.phone)}</p>` : ""}
    </div><div class="document"><span class="document-label">NOTA DE VENTA</span><h2>${escapeHtml(payload.sale.folio)}</h2></div></header>
    ${
      payload.returns
        ? `<section class="payments"><strong>${payload.returns.state === "FULL" ? "VENTA DEVUELTA" : "DEVOLUCIÓN PARCIAL"}</strong>
      <p>Importe devuelto: ${escapeHtml(money.format(payload.returns.amount))}</p>
      ${payload.returns.refunded > 0 ? `<p>Reembolsado: ${escapeHtml(money.format(payload.returns.refunded))}</p>` : ""}
      ${payload.returns.debtReduced > 0 ? `<p>Deuda reducida: ${escapeHtml(money.format(payload.returns.debtReduced))}</p>` : ""}</section>`
        : ""
    }
    <section class="metadata"><div><p class="label">Cliente / Receptor</p><strong>${escapeHtml(payload.customer?.name ?? "Cliente General")}</strong>
      ${showCashierName && payload.attendedBy?.trim() ? `<p>Atendió: ${escapeHtml(payload.attendedBy.trim())}</p>` : ""}
    </div><div><p class="label">Emisión</p><strong>${escapeHtml(dateTime(payload.sale.createdAt))}</strong></div></section>
    <section class="payments"><p class="label">Forma de pago · montos recibidos</p>${paymentMarkup || "<p>Sin pagos registrados</p>"}
      ${payload.change > 0 ? `<div class="pair"><span>Cambio entregado</span><strong>${escapeHtml(money.format(payload.change))}</strong></div>` : ""}
      ${payload.creditAmount > 0 ? `<div class="pair"><span>Crédito / Fiar</span><strong>${escapeHtml(money.format(payload.creditAmount))}</strong></div>` : ""}
    </section>
    <table><thead><tr><th class="quantity">CANT.</th><th>DESCRIPCIÓN DEL ARTÍCULO</th><th class="price amount">PRECIO UNIT.</th><th class="price amount">TOTAL</th></tr></thead><tbody>${rows}</tbody></table>
    <section class="bottom"><div class="terms">${terms ? `<strong>Términos y condiciones</strong><p>${escapeHtml(terms)}</p>` : ""}</div><div class="totals">
      <div class="pair"><span>SUBTOTAL</span><strong>${escapeHtml(money.format(payload.subtotal))}</strong></div>
      ${payload.discount > 0 ? `<div class="pair"><span>DESCUENTO</span><strong>−${escapeHtml(money.format(payload.discount))}</strong></div>` : ""}
      <div class="pair total"><span>TOTAL NETO</span><strong>${escapeHtml(money.format(payload.total))}</strong></div>
    </div></section>
    <footer class="signatures"><div>CLIENTE</div><div>SELLO / FIRMA SUCURSAL</div></footer>
  </body></html>`;
}
