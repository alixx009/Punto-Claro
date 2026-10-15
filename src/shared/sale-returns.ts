import type { SaleReturnDetail, SaleReturnSelection } from "./ipc";

const cents = (value: number): number => Math.round(value * 100);
const money = (value: number): number => value / 100;

/** Reparte un importe proporcionalmente, conservando todos sus centavos. */
export function allocateDiscount(lines: number[], discount: number): number[] {
  const total = lines.reduce((sum, value) => sum + cents(value), 0);
  const discountCents = cents(discount);
  if (!total) return lines.map(() => 0);
  const shares = lines.map((value, index) => {
    const exact = (cents(value) / total) * discountCents;
    return {
      index,
      amount: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let remainder =
    discountCents - shares.reduce((sum, share) => sum + share.amount, 0);
  for (const share of [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )) {
    if (remainder-- > 0) share.amount++;
  }
  return shares.map((share) => money(share.amount));
}

export function calculateSaleReturn(
  detail: SaleReturnDetail,
  selected: SaleReturnSelection[],
) {
  if (!Array.isArray(selected) || selected.length > detail.items.length)
    throw new Error("La selección de productos no es válida.");
  const used = new Set<number>();
  const itemsById = new Map(detail.items.map((item) => [item.id, item]));
  const items = selected.map((selection) => {
    if (!selection || used.has(selection.saleItemId))
      throw new Error("No repitas un producto en la devolución.");
    used.add(selection.saleItemId);
    const item = itemsById.get(selection.saleItemId);
    if (!item) throw new Error("El producto no pertenece a esta venta.");
    const quantity = selection.quantity;
    const scale = item.unit === "KG" ? 1000 : 1;
    const scaled = quantity * scale;
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isSafeInteger(Math.round(scaled)) ||
      Math.abs(scaled - Math.round(scaled)) > 1e-7
    )
      throw new Error(
        item.unit === "KG"
          ? "Indica un peso válido con hasta tres decimales."
          : "La cantidad debe ser un número entero mayor a cero.",
      );
    const sold = Math.round(item.soldQuantity * scale);
    const returned = Math.round(item.returnedQuantity * scale);
    const next = returned + Math.round(scaled);
    if (next > sold)
      throw new Error(
        `La cantidad de ${item.productName} supera lo pendiente por devolver.`,
      );
    // Diferencias entre acumulados: las devoluciones sucesivas no ganan ni pierden centavos.
    const proportional = (amount: number): number =>
      Math.round(cents(amount) * (next / sold)) -
      Math.round(cents(amount) * (returned / sold));
    const subtotal = proportional(item.originalLineSubtotal);
    const amount = proportional(
      item.originalLineSubtotal - item.originalLineDiscount,
    );
    const discount = subtotal - amount;
    return {
      ...selection,
      productId: item.productId,
      subtotal: money(subtotal),
      discount: money(discount),
      amount: money(amount),
    };
  });
  const subtotalCents = items.reduce(
    (sum, item) => sum + cents(item.subtotal),
    0,
  );
  const discountCents = items.reduce(
    (sum, item) => sum + cents(item.discount),
    0,
  );
  const amountCents = subtotalCents - discountCents;
  const creditReduction = Math.min(
    amountCents,
    cents(detail.sale.creditAmount),
  );
  const debtReduction = Math.min(
    creditReduction,
    cents(detail.customerBalance),
  );
  const settledCreditRefund = creditReduction - debtReduction;
  const paidRefund = amountCents - creditReduction;
  if (
    amountCents < 0 ||
    amountCents > cents(detail.sale.total) ||
    paidRefund > cents(detail.sale.paidAmount)
  )
    throw new Error(
      "Los importes de esta venta no coinciden. Revisa sus datos antes de devolver productos.",
    );
  return {
    items,
    subtotal: money(subtotalCents),
    discount: money(discountCents),
    amount: money(amountCents),
    creditReduction: money(creditReduction),
    debtReduction: money(debtReduction),
    paidRefund: money(paidRefund),
    settledCreditRefund: money(settledCreditRefund),
    refundAmount: money(paidRefund + settledCreditRefund),
  };
}
