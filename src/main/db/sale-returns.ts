import type {
  CreateSaleReturnInput,
  RefundMethod,
  SaleReturnDetail,
  SaleReturnItem,
  SaleReturnResult,
  TicketPayload,
} from "../../shared/ipc";
import {
  allocateDiscount,
  calculateSaleReturn,
} from "../../shared/sale-returns";
import { roundMoney } from "../../shared/money";
import { getDb } from "./database";
import { getSale } from "./sales";
import { computeBalance } from "./customers";
import { getCurrentSession } from "./register";
import { recordStockMovement } from "./inventory-ledger";
import { getSaleHistoryDetail } from "./sales-history";
import type { OperationActor } from "../../shared/auth";

const methods: RefundMethod[] = ["CASH", "CARD", "TRANSFER"];
const cents = (amount: number): number => Math.round(amount * 100);
const validMoney = (amount: number): boolean =>
  Number.isFinite(amount) &&
  amount >= 0 &&
  Number.isSafeInteger(cents(amount)) &&
  Math.abs(amount * 100 - cents(amount)) < 1e-7;

function assertId(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Selecciona una venta válida.");
}

export function getSaleReturnDetail(saleId: number): SaleReturnDetail {
  assertId(saleId);
  return getDb().transaction(() => {
    const sale = getSale(saleId);
    if (!sale) throw new Error("La venta ya no está disponible.");
    const origin = getDb()
      .prepare(
        "SELECT subtotal, discount, total, paid_amount, credit_amount FROM sale_return_origins WHERE sale_id = ?",
      )
      .get(saleId) as
      | {
          subtotal: number;
          discount: number;
          total: number;
          paid_amount: number;
          credit_amount: number;
        }
      | undefined;
    const rows = getDb()
      .prepare(
        `SELECT i.id, i.product_id AS productId, i.product_name AS productName,
      COALESCE(p.sku, '') AS sku, i.unit, i.quantity AS soldQuantity, i.returned_quantity AS returnedQuantity,
      i.unit_price AS unitPrice, i.line_total AS originalLineSubtotal
      FROM sale_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.sale_id = ? ORDER BY i.id`,
      )
      .all(saleId) as Omit<SaleReturnItem, "originalLineDiscount">[];
    if (!rows.length)
      throw new Error(
        "Esta venta histórica no tiene productos registrados para realizar una devolución.",
      );
    const original = origin ?? {
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      paid_amount: sale.paidAmount,
      credit_amount: sale.creditAmount,
    };
    if (
      Object.values(original).some((value) => !validMoney(value)) ||
      original.discount > original.subtotal ||
      [
        sale.subtotal,
        sale.discount,
        sale.total,
        sale.paidAmount,
        sale.creditAmount,
        sale.returnedAmount,
      ].some((value) => !validMoney(value)) ||
      (sale.creditAmount > 0 && sale.customerId === null) ||
      rows.some((row) => {
        const scale = row.unit === "KG" ? 1000 : 1;
        return (
          !["PIEZA", "KG", "PAQ"].includes(row.unit) ||
          !Number.isFinite(row.soldQuantity) ||
          row.soldQuantity <= 0 ||
          !Number.isSafeInteger(Math.round(row.soldQuantity * scale)) ||
          Math.abs(
            row.soldQuantity * scale - Math.round(row.soldQuantity * scale),
          ) > 1e-7 ||
          !Number.isFinite(row.returnedQuantity) ||
          row.returnedQuantity < 0 ||
          row.returnedQuantity > row.soldQuantity ||
          Math.abs(
            row.returnedQuantity * scale -
              Math.round(row.returnedQuantity * scale),
          ) > 1e-7 ||
          !validMoney(row.originalLineSubtotal) ||
          !validMoney(row.unitPrice)
        );
      }) ||
      cents(rows.reduce((sum, row) => sum + row.originalLineSubtotal, 0)) !==
        cents(original.subtotal) ||
      cents(original.total) !==
        cents(original.subtotal) - cents(original.discount) ||
      cents(original.total) !==
        cents(original.paid_amount) + cents(original.credit_amount)
    )
      throw new Error(
        "Los productos y los importes originales de esta venta no coinciden. No se puede devolver automáticamente.",
      );
    const discounts = allocateDiscount(
      rows.map((row) => row.originalLineSubtotal),
      original.discount,
    );
    const returnedSubtotal = rows.reduce(
      (sum, row) =>
        sum +
        Math.round(
          cents(row.originalLineSubtotal) *
            (Math.round(row.returnedQuantity * 1000) /
              Math.round(row.soldQuantity * 1000)),
        ),
      0,
    );
    const returnedTotal = rows.reduce(
      (sum, row, index) =>
        sum +
        Math.round(
          cents(row.originalLineSubtotal - discounts[index]) *
            (Math.round(row.returnedQuantity * 1000) /
              Math.round(row.soldQuantity * 1000)),
        ),
      0,
    );
    if (
      cents(sale.subtotal) !== cents(original.subtotal) - returnedSubtotal ||
      cents(sale.total) !== cents(original.total) - returnedTotal ||
      cents(sale.discount) !== cents(sale.subtotal) - cents(sale.total) ||
      cents(sale.paidAmount) + cents(sale.creditAmount) !== cents(sale.total) ||
      cents(sale.returnedAmount) !== returnedTotal
    )
      throw new Error(
        "Los importes restantes no coinciden con las cantidades devueltas. Revisa esta venta antes de continuar.",
      );
    const revision = getDb()
      .prepare(
        "SELECT COALESCE(MAX(id), 0) AS revision FROM sale_returns WHERE sale_id = ?",
      )
      .get(saleId) as { revision: number };
    return {
      sale,
      revision: revision.revision,
      items: rows.map((row, index) => ({
        ...row,
        originalLineDiscount: discounts[index],
      })),
      customerBalance:
        sale.customerId === null
          ? 0
          : roundMoney(computeBalance(sale.customerId)),
      registerSessionId: getCurrentSession()?.id ?? null,
    };
  })();
}

export function createSaleReturn(
  input: CreateSaleReturnInput,
  actor: OperationActor,
): SaleReturnResult {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.items) ||
    input.items.length === 0 ||
    input.items.length > 1000 ||
    input.items.some(
      (item) => !item || !Number.isSafeInteger(item.saleItemId),
    ) ||
    typeof input.requestId !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      input.requestId,
    ) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    !methods.includes(input.refundMethod) ||
    !validMoney(input.expectedRefund) ||
    !validMoney(input.expectedDebtReduction)
  )
    throw new Error("Los datos de la devolución no son válidos.");
  assertId(input.saleId);
  assertId(input.registerSessionId);
  const fingerprint = JSON.stringify({
    saleId: input.saleId,
    revision: input.revision,
    session: input.registerSessionId,
    method: input.refundMethod,
    refund: input.expectedRefund,
    debt: input.expectedDebtReduction,
    items: input.items
      .map(({ saleItemId, quantity }) => ({ saleItemId, quantity }))
      .sort((a, b) => a.saleItemId - b.saleItemId),
  });
  const database = getDb();
  return database
    .transaction(() => {
      const previous = database
        .prepare(
          `SELECT id, sale_id AS saleId, amount, refund_amount AS refundAmount,
      debt_reduction AS debtReduction, refund_method AS refundMethod, request_fingerprint AS fingerprint
      FROM sale_returns WHERE request_id = ?`,
        )
        .get(input.requestId) as
        (SaleReturnResult & { fingerprint: string }) | undefined;
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new Error(
            "Este intento ya fue utilizado para otra devolución. Actualiza la venta.",
          );
        const { fingerprint: _fingerprint, ...result } = previous;
        return result;
      }
      const detail = getSaleReturnDetail(input.saleId);
      if (detail.revision !== input.revision)
        throw new Error(
          "La venta ya recibió otra devolución. Cierra este diálogo y vuelve a abrirla.",
        );
      if (
        detail.registerSessionId === null ||
        detail.registerSessionId !== input.registerSessionId
      )
        throw new Error(
          "Abre una caja y vuelve a cargar la venta antes de registrar la devolución.",
        );
      const plan = calculateSaleReturn(detail, input.items);
      if (
        cents(plan.refundAmount) !== cents(input.expectedRefund) ||
        cents(plan.debtReduction) !== cents(input.expectedDebtReduction)
      )
        throw new Error(
          "El saldo del cliente cambió. Cierra este diálogo y vuelve a abrirlo para actualizar el reembolso.",
        );
      const session = getCurrentSession()!;
      if (
        plan.refundAmount > 0 &&
        input.refundMethod === "CASH" &&
        cents(plan.refundAmount) >
          cents(
            session.openingAmount +
              session.cashPayments +
              session.cashMovements,
          )
      )
        throw new Error(
          "No hay suficiente efectivo en la caja para este reembolso. Revisa el fondo o elige otro método.",
        );
      const document = getSaleHistoryDetail(input.saleId)!;
      database
        .prepare(
          `INSERT OR IGNORE INTO sale_return_origins
      (sale_id, subtotal, discount, total, paid_amount, credit_amount, ticket_payload) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          detail.sale.id,
          detail.sale.subtotal,
          detail.sale.discount,
          detail.sale.total,
          detail.sale.paidAmount,
          detail.sale.creditAmount,
          JSON.stringify(document.payload),
        );
      const info = database
        .prepare(
          `INSERT INTO sale_returns
      (request_id, request_fingerprint, sale_id, register_session_id, amount, discount_amount, credit_reduction, debt_reduction, refund_amount, refund_method, performed_by_user_id, performed_by_name)
      VALUES (@requestId, @fingerprint, @saleId, @session, @amount, @discount, @creditReduction, @debtReduction, @refund, @method, @actorId, @actorName)`,
        )
        .run({
          requestId: input.requestId,
          fingerprint,
          saleId: input.saleId,
          session: session.id,
          amount: plan.amount,
          discount: plan.discount,
          creditReduction: plan.creditReduction,
          debtReduction: plan.debtReduction,
          refund: plan.refundAmount,
          method: plan.refundAmount > 0 ? input.refundMethod : null,
          actorId: actor.id,
          actorName: actor.displayName,
        });
      const returnId = Number(info.lastInsertRowid);
      const itemsById = new Map(detail.items.map((item) => [item.id, item]));
      for (const item of plan.items) {
        const product = database
          .prepare("SELECT stock, unit FROM products WHERE id = ?")
          .get(item.productId) as { stock: number; unit: string } | undefined;
        const original = itemsById.get(item.saleItemId)!;
        if (!product || product.unit !== original.unit)
          throw new Error(
            `La unidad de ${original.productName} cambió. Revisa el producto antes de devolverlo.`,
          );
        const stock = Math.round((product.stock + item.quantity) * 1000) / 1000;
        if (
          !Number.isFinite(stock) ||
          !Number.isSafeInteger(Math.round(stock * 1000))
        )
          throw new Error("La existencia resultante no es válida.");
        database
          .prepare(
            "UPDATE products SET stock = ?, updated_at = app_now() WHERE id = ?",
          )
          .run(stock, item.productId);
        recordStockMovement(
          database,
          item.productId,
          item.quantity,
          product.stock,
          stock,
          "RETURN",
          input.saleId,
        );
        database
          .prepare(
            "UPDATE sale_items SET returned_quantity = ROUND(returned_quantity + ?, 3) WHERE id = ?",
          )
          .run(item.quantity, item.saleItemId);
        database
          .prepare(
            `INSERT INTO sale_return_items (return_id, sale_item_id, quantity, line_subtotal, discount_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            returnId,
            item.saleItemId,
            item.quantity,
            item.subtotal,
            item.discount,
            item.amount,
          );
      }
      const paid = roundMoney(detail.sale.paidAmount - plan.paidRefund);
      const credit = roundMoney(
        detail.sale.creditAmount - plan.creditReduction,
      );
      const status = credit <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
      database
        .prepare(
          `UPDATE sales SET subtotal = ROUND(subtotal - @subtotal, 2), discount = ROUND(discount - @discount, 2),
      total = ROUND(total - @amount, 2), paid_amount = @paid, credit_amount = @credit, status = @status,
      returned_amount = ROUND(returned_amount + @amount, 2), updated_at = app_now() WHERE id = @saleId`,
        )
        .run({
          subtotal: plan.subtotal,
          discount: plan.discount,
          amount: plan.amount,
          paid,
          credit,
          status,
          saleId: input.saleId,
        });
      const insertRefund =
        database.prepare(`INSERT INTO payments (customer_id, sale_id, register_session_id, amount, method, reference, notes, performed_by_user_id, performed_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const reference = `${detail.sale.folio} · Devolución ${returnId}`;
      if (plan.paidRefund > 0)
        insertRefund.run(
          detail.sale.customerId,
          input.saleId,
          session.id,
          -plan.paidRefund,
          input.refundMethod,
          reference,
          "Reembolso de venta",
          actor.id,
          actor.displayName,
        );
      // Revierte solamente los abonos que exceden la deuda restante; nunca deja saldo a favor oculto.
      if (plan.settledCreditRefund > 0)
        insertRefund.run(
          detail.sale.customerId,
          null,
          session.id,
          -plan.settledCreditRefund,
          input.refundMethod,
          reference,
          "Reembolso de abonos por devolución",
          actor.id,
          actor.displayName,
        );
      if (document.ticketId !== null) {
        const updated = getSaleHistoryDetail(input.saleId)!;
        const payload: TicketPayload = {
          ...updated.payload,
          store: document.payload.store,
          customer: document.payload.customer,
          attendedBy: document.payload.attendedBy,
        };
        database
          .prepare(
            "UPDATE tickets SET payload = ?, total_amount = ? WHERE sale_id = ?",
          )
          .run(JSON.stringify(payload), payload.total, input.saleId);
      }
      return {
        id: returnId,
        saleId: input.saleId,
        amount: plan.amount,
        refundAmount: plan.refundAmount,
        debtReduction: plan.debtReduction,
        refundMethod: plan.refundAmount > 0 ? input.refundMethod : null,
      };
    })
    .immediate();
}
