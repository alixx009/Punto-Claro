import type {
  CreateSaleInput,
  Payment,
  PaymentMethod,
  Sale,
  SaleItem,
  SaleStatus,
} from "../../shared/ipc";
import { roundMoney } from "../../shared/money";
import { getDb, nowInAppTz } from "./database";
import { reserveSaleFolio } from "./folios";
import { recordStockMovement } from "./inventory-ledger";
import type { OperationActor } from "../../shared/auth";

const SELECT_SALE_COLUMNS = `
  id, folio, customer_id, register_session_id, cashier_id, cashier_name, status,
  subtotal, discount, total, paid_amount, credit_amount, returned_amount,
  notes, created_at, updated_at
`;

interface ProductRow {
  id: number;
  name: string;
  unit: "PIEZA" | "KG" | "PAQ";
  sale_price: number;
  purchase_price: number;
  stock: number;
}

export function createSale(
  input: CreateSaleInput,
  actor: OperationActor,
): Sale {
  if (input.items.length === 0) {
    throw new Error("La venta debe incluir al menos un producto.");
  }

  const database = getDb();
  const session = database
    .prepare("SELECT status FROM register_sessions WHERE id = ?")
    .get(input.registerSessionId) as { status: string } | undefined;
  if (!session) {
    throw new Error("La sesión de caja no existe.");
  }
  if (session.status !== "OPEN") {
    throw new Error("La caja está cerrada. Ábrela antes de registrar ventas.");
  }

  const result = database
    .transaction((): Sale => {
      const productRows: ProductRow[] = [];
      const quantities: number[] = [];
      const seenProductIds = new Set<number>();
      for (const item of input.items) {
        if (seenProductIds.has(item.productId)) {
          throw new Error("Un producto aparece más de una vez en la venta.");
        }
        seenProductIds.add(item.productId);
        const row = database
          .prepare(
            "SELECT id, name, unit, sale_price, purchase_price, stock FROM products WHERE id = ?",
          )
          .get(item.productId) as ProductRow | undefined;
        if (!row) {
          throw new Error(`Producto ${item.productId} no existe.`);
        }
        const quantity = roundKg(item.quantity);
        if (
          !Number.isFinite(item.quantity) ||
          quantity <= 0 ||
          (row.unit !== "KG" && !Number.isInteger(item.quantity)) ||
          (row.unit === "KG" &&
            Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) >
              1e-7)
        ) {
          throw new Error(`Cantidad inválida para "${row.name}".`);
        }
        if (row.stock + 1e-7 < quantity) {
          throw new Error(
            `Stock insuficiente para "${row.name}" (disponible: ${row.stock}, requerido: ${quantity}).`,
          );
        }
        productRows.push(row);
        quantities.push(quantity);
      }

      const lineTotals = productRows.map((row, idx) =>
        roundMoney(row.sale_price * quantities[idx]),
      );
      const subtotal = roundMoney(
        lineTotals.reduce((sum, amount) => sum + amount, 0),
      );
      const discount = input.discount ?? 0;
      if (!validMoney(discount) || discount > subtotal) {
        throw new Error("El descuento de la venta no es válido.");
      }
      if (
        !validMoney(input.creditAmount) ||
        input.payments.some(
          (payment) => !validMoney(payment.amount) || payment.amount <= 0,
        )
      ) {
        throw new Error(
          "Los importes del cobro deben ser cantidades válidas en centavos.",
        );
      }
      const total = roundMoney(subtotal - discount);
      const paidAmount = roundMoney(
        input.payments.reduce((sum, p) => sum + p.amount, 0),
      );

      if (paidAmount + input.creditAmount + discount === 0) {
        throw new Error(
          "Debes registrar al menos un pago o asignar crédito a la venta.",
        );
      }

      if (paidAmount + input.creditAmount > total + 0.001) {
        throw new Error("Los pagos más el fiado superan el total de la venta.");
      }
      if (paidAmount + input.creditAmount < total - 0.001) {
        throw new Error(
          "El total de la venta cambió o falta cubrir una parte. Revisa los precios y el cobro.",
        );
      }
      if (input.creditAmount > 0 && input.customerId === null) {
        throw new Error("Para fiar una venta se requiere un cliente.");
      }

      const status: SaleStatus =
        input.creditAmount === 0
          ? "PAID"
          : paidAmount === 0
            ? "PENDING"
            : "PARTIAL";

      const folio = reserveSaleFolio(database);
      const now = nowInAppTz();

      const saleInfo = database
        .prepare(
          `INSERT INTO sales (
          folio, customer_id, register_session_id, status,
          subtotal, discount, total, paid_amount, credit_amount, notes,
          created_at, updated_at, cashier_id, cashier_name
        ) VALUES (
          @folio, @customerId, @registerSessionId, @status,
          @subtotal, @discount, @total, @paidAmount, @creditAmount, @notes,
          @now, @now, @cashierId, @cashierName
        )`,
        )
        .run({
          folio,
          customerId: input.customerId,
          registerSessionId: input.registerSessionId,
          status,
          subtotal,
          discount,
          total,
          paidAmount,
          creditAmount: input.creditAmount,
          notes: input.notes,
          now,
          cashierId: actor.id,
          cashierName: actor.displayName,
        });

      const saleId = Number(saleInfo.lastInsertRowid);

      const insertItem = database.prepare(
        `INSERT INTO sale_items (
        sale_id, product_id, product_name, unit, quantity, unit_price, line_total, purchase_cost,
        created_at
      ) VALUES (
        @saleId, @productId, @productName, @unit, @quantity, @unitPrice, @lineTotal, @purchaseCost,
        @now
      )`,
      );

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const product = productRows[i];
        const cleanQty = quantities[i];
        insertItem.run({
          saleId,
          productId: item.productId,
          productName: product.name,
          unit: product.unit,
          quantity: cleanQty,
          now,
          unitPrice: product.sale_price,
          purchaseCost: product.purchase_price,
          lineTotal: lineTotals[i],
        });
        updateNewStock(product.id, cleanQty, saleId);
      }

      {
        const insertPayment = database.prepare(
          `INSERT INTO payments (customer_id, sale_id, register_session_id, amount, method, reference, notes, performed_by_user_id, performed_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const payment of input.payments) {
          if (payment.amount <= 0) continue;
          insertPayment.run(
            input.customerId,
            saleId,
            input.registerSessionId,
            payment.amount,
            payment.method,
            null,
            null,
            actor.id,
            actor.displayName,
          );
        }
      }

      const row = database
        .prepare(`SELECT ${SELECT_SALE_COLUMNS} FROM sales WHERE id = ?`)
        .get(saleId) as Record<string, unknown>;
      return mapSaleRow(row);
    })
    .immediate();

  return result;
}

export function listSalesByCustomer(customerId: number): Sale[] {
  const rows = getDb()
    .prepare(
      `SELECT ${SELECT_SALE_COLUMNS} FROM sales WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC`,
    )
    .all(customerId) as Array<Record<string, unknown>>;
  return rows.map(mapSaleRow);
}

export function getSale(id: number): Sale | null {
  const row = getDb()
    .prepare(`SELECT ${SELECT_SALE_COLUMNS} FROM sales WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapSaleRow(row) : null;
}

export function listPaymentsForSale(saleId: number): Payment[] {
  const rows = getDb()
    .prepare(
      `SELECT id, customer_id, amount, method, reference, notes, created_at
         FROM payments WHERE sale_id = ? ORDER BY datetime(created_at) ASC, id ASC`,
    )
    .all(saleId) as Array<Record<string, unknown>>;
  return rows.map(mapPaymentRow);
}

export function listSaleItems(saleId: number): SaleItem[] {
  const rows = getDb()
    .prepare(
      `SELECT id, sale_id, product_id, product_name, unit, ROUND(quantity - returned_quantity, 3) AS quantity,
          unit_price, ROUND(line_total - COALESCE((SELECT SUM(ri.line_subtotal) FROM sale_return_items ri WHERE ri.sale_item_id = sale_items.id), 0), 2) AS line_total
         FROM sale_items WHERE sale_id = ? AND quantity > returned_quantity ORDER BY id ASC`,
    )
    .all(saleId) as Array<Record<string, unknown>>;
  return rows.map(mapSaleItemRow);
}

function roundKg(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function validMoney(n: number): boolean {
  return (
    Number.isFinite(n) &&
    n >= 0 &&
    Math.abs(n * 100 - Math.round(n * 100)) < 1e-7
  );
}

function updateNewStock(
  productId: number,
  soldQty: number,
  saleId: number,
): void {
  const row = getDb()
    .prepare("SELECT stock FROM products WHERE id = ?")
    .get(productId) as { stock: number } | undefined;
  if (!row) return;
  const newStock = roundKg(row.stock - soldQty);
  getDb()
    .prepare(
      "UPDATE products SET stock = ?, updated_at = app_now() WHERE id = ?",
    )
    .run(newStock, productId);
  recordStockMovement(
    getDb(),
    productId,
    -soldQty,
    row.stock,
    newStock,
    "SALE",
    saleId,
  );
}

function mapSaleRow(row: Record<string, unknown>): Sale {
  return {
    id: row.id as number,
    folio: row.folio as string,
    customerId: (row.customer_id as number | null) ?? null,
    registerSessionId: (row.register_session_id as number | null) ?? null,
    cashierId: (row.cashier_id as string | null) ?? null,
    cashierName: (row.cashier_name as string | null) ?? null,
    status: row.status as SaleStatus,
    subtotal: row.subtotal as number,
    discount: row.discount as number,
    total: row.total as number,
    paidAmount: row.paid_amount as number,
    creditAmount: row.credit_amount as number,
    returnedAmount: row.returned_amount as number,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: row.id as number,
    customerId: row.customer_id as number,
    saleId: (row.sale_id as number | null) ?? null,
    registerSessionId: (row.register_session_id as number | null) ?? null,
    amount: row.amount as number,
    method: row.method as PaymentMethod,
    reference: (row.reference as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapSaleItemRow(row: Record<string, unknown>): SaleItem {
  return {
    id: row.id as number,
    saleId: row.sale_id as number,
    productId: row.product_id as number,
    productName: row.product_name as string,
    unit: row.unit as SaleItem["unit"],
    quantity: row.quantity as number,
    unitPrice: row.unit_price as number,
    lineTotal: row.line_total as number,
  };
}
