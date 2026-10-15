import type {
  PaymentMethod,
  PrinterMargins,
  TicketPayload,
  TicketPrintSettings,
  TicketTemplate,
} from "../shared/ipc";

// Ajusta cada sección del ticket impreso por separado (valores de 100 a 900).
// Courier New puede representar varios valores con el mismo grosor disponible.
const TICKET_FONT_WEIGHTS = {
  body: 550, // Datos de la venta, dirección, teléfono y pagos.
  storeName: 800, // Nombre de la tienda.
  columnHeaders: 700, // Concepto / Producto, Cant., Precio e Importe.
  items: 550, // Cantidades, nombres de productos y precios.
  total: 800, // Etiqueta TOTAL y su importe.
  thanks: 600, // Mensaje de agradecimiento.
  footer: 400, // Mensaje de facturación y términos.
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const quantity = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  DEBIT: "T. débito",
  CREDIT: "T. crédito",
  TRANSFER: "Transferencia",
  VOUCHER: "Vale",
  OTHER: "Otro",
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function formatDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  return match
    ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`
    : value;
}

function divider(template: TicketTemplate): string {
  const line = (y: number, width: number, dash = "") =>
    `<line x1="0" y1="${y}" x2="100%" y2="${y}" stroke="currentColor" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const drawing = {
    classic: line(4, 1, "8 4"),
    modern: line(4, 2),
    compact: line(4, 1.5, "1 3"),
    framed: line(2, 1) + line(6, 1),
    multiline: line(4, 1.5, "12 3 2 3"),
  }[template];
  return `<svg class="divider" height="8" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${drawing}</svg>`;
}

function pair(label: string, value: string, className = ""): string {
  return `<div class="pair ${className}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

export function renderSaleTicketHtml(
  payload: TicketPayload,
  settings: TicketPrintSettings,
  margins: PrinterMargins,
  logoDataUrl: string | null,
): string {
  const { sale, store, items, payments } = payload;
  const itemColumns = settings.showAmount
    ? "4ch minmax(0, 1fr) minmax(0, 1fr)"
    : "4ch minmax(0, 1fr)";
  const itemMarkup = items
    .map(
      (item) => `
    <div class="item">
      <span class="item-name">${escapeHtml(item.productName)}${item.unit === "KG" ? " (kg)" : ""}</span>
      <span>${escapeHtml(quantity.format(item.quantity))}</span>
      <span class="price">${escapeHtml(money.format(item.unitPrice))}</span>
      ${settings.showAmount ? `<span class="amount">${escapeHtml(money.format(item.lineTotal))}</span>` : ""}
    </div>`,
    )
    .join("");
  const paymentMarkup = payments
    .map((payment) =>
      pair(
        `${paymentLabels[payment.method] ?? "Otro"}:`,
        money.format(payment.amount),
      ),
    )
    .join("");
  const footer = [
    settings.thanks && `<p class="thanks">${escapeHtml(settings.thanks)}</p>`,
    settings.invoiceMessage && `<p>${escapeHtml(settings.invoiceMessage)}</p>`,
    settings.terms && `<p class="terms">${escapeHtml(settings.terms)}</p>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Ticket ${escapeHtml(sale.folio)}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { width: ${settings.paperWidth}mm; margin: 0; padding: 0; }
  body { background: #fff; color: #000; font: ${TICKET_FONT_WEIGHTS.body} ${settings.fontSize}px/${settings.template === "compact" ? "1.25" : "1.45"} "Courier New", monospace; }
  #receipt { width: ${settings.paperWidth}mm; padding: ${margins.topMm}mm ${margins.rightMm}mm ${margins.bottomMm}mm ${margins.leftMm}mm; ${settings.template === "framed" ? "border: 1px solid #000;" : ""} }
  .header, .footer { text-align: center; overflow-wrap: anywhere; }
  .logo { display: block; max-width: 24mm; max-height: 16mm; margin: 0 auto 5px; object-fit: contain; }
  .store-name { margin: 0; font-size: ${settings.template === "modern" ? "1.35em" : "1.15em"}; font-weight: ${TICKET_FONT_WEIGHTS.storeName}; text-transform: uppercase; }
  p { margin: 2px 0; }
  .divider { display: block; width: 100%; margin: ${settings.template === "compact" ? "6px" : "9px"} 0; }
  .pair { display: flex; justify-content: space-between; gap: 6px; }
  .pair span:last-child { text-align: right; min-width: 0; overflow-wrap: anywhere; }
  .item-head, .item { display: grid; grid-template-columns: ${itemColumns}; column-gap: 3px; align-items: start; }
  .item-title { text-align: center; font-weight: ${TICKET_FONT_WEIGHTS.columnHeaders}; }
  .item-head { font-size: .9em; font-weight: ${TICKET_FONT_WEIGHTS.columnHeaders}; }
  .item { margin-top: ${settings.template === "compact" ? "1px" : "3px"}; font-weight: ${TICKET_FONT_WEIGHTS.items}; }
  .item-name { grid-column: 1 / -1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
  .price { text-align: center; white-space: nowrap; }
  .amount { text-align: right; white-space: nowrap; }
  .total { font-weight: ${TICKET_FONT_WEIGHTS.total}; font-size: ${settings.template === "modern" ? "1.2em" : "1.05em"}; }
  .footer { overflow-wrap: anywhere; font-weight: ${TICKET_FONT_WEIGHTS.footer}; }
  .thanks { font-weight: ${TICKET_FONT_WEIGHTS.thanks}; }
  .terms { white-space: pre-line; }
</style></head><body><div id="receipt">
  <header class="header">
    ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="">` : ""}
    <p class="store-name">${escapeHtml(store.name)}</p>
    ${store.address ? `<p>${escapeHtml(store.address)}</p>` : ""}
    ${store.phone ? `<p>Tel. ${escapeHtml(store.phone)}</p>` : ""}
  </header>
  ${divider(settings.template)}
  <section>
    ${pair("Folio:", sale.folio)}
    ${pair("Fecha:", formatDateTime(sale.createdAt))}
    ${settings.showCashierName && payload.attendedBy?.trim() ? pair("Cajero:", payload.attendedBy.trim()) : ""}
    ${payload.customer ? pair("Cliente:", payload.customer.name) : ""}
  </section>
  ${divider(settings.template)}
  <section>
    ${
      payload.returns
        ? `<p class="item-title">${payload.returns.state === "FULL" ? "VENTA DEVUELTA" : "DEVOLUCIÓN PARCIAL"}</p>
      ${pair("Importe devuelto:", money.format(payload.returns.amount))}
      ${payload.returns.refunded > 0 ? pair("Reembolsado:", money.format(payload.returns.refunded)) : ""}
      ${payload.returns.debtReduced > 0 ? pair("Deuda reducida:", money.format(payload.returns.debtReduced)) : ""}
      ${divider(settings.template)}`
        : ""
    }
    <div class="item-title">Concepto / Producto</div>
    <div class="item-head"><span>Cant.</span><span class="price">Precio</span>${settings.showAmount ? '<span class="amount">Importe</span>' : ""}</div>
    ${itemMarkup || (payload.returns ? '<p class="header">Todos los artículos fueron devueltos.</p>' : "")}
  </section>
  ${divider(settings.template)}
  <section>
    ${payload.discount > 0 || payload.subtotal !== payload.total ? pair("Subtotal:", money.format(payload.subtotal)) : ""}
    ${payload.discount > 0 ? pair("Descuento:", money.format(payload.discount)) : ""}
    ${pair("TOTAL:", money.format(payload.total), "total")}
  </section>
  ${
    payments.length > 0 || payload.creditAmount > 0 || payload.change > 0
      ? `${divider(settings.template)}<section>
    ${paymentMarkup}
    ${payload.creditAmount > 0 ? pair("Crédito tienda:", money.format(payload.creditAmount)) : ""}
    ${payload.change > 0 ? pair("Cambio:", money.format(payload.change)) : ""}
  </section>`
      : ""
  }
  ${footer ? `${divider(settings.template)}<footer class="footer">${footer}</footer>` : ""}
</div></body></html>`;
}
