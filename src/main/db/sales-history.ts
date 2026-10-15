import type {
  EnsureSaleTicketInput,
  PaymentMethod,
  SalesHistoryDetail,
  SalesHistoryPaymentFilter,
  SalesHistoryQuery,
  SalesHistoryResult,
  SalesHistoryRow,
  Ticket,
  TicketStoreInfo,
} from "../../shared/ipc";
import { roundMoney } from "../../shared/money";
import { allocateDiscount } from "../../shared/sale-returns";
import { getDb } from "./database";
import { getSale, listPaymentsForSale, listSaleItems } from "./sales";
import { createTicket, getTicketBySaleId } from "./tickets";

const CUSTOMER_NAME = `COALESCE(
  NULLIF(TRIM(CASE WHEN json_valid(t.payload) THEN json_extract(t.payload, '$.customer.name') END), ''),
  NULLIF(TRIM(c.name), ''), 'Cliente General'
)`;
const SOURCE =
  "sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN tickets t ON t.sale_id = s.id";
const PAYMENT_FILTERS: SalesHistoryPaymentFilter[] = [
  "ALL",
  "CASH",
  "CARD",
  "TRANSFER",
  "STORE_CREDIT",
];
const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CARD",
  "DEBIT",
  "CREDIT",
  "TRANSFER",
  "VOUCHER",
  "OTHER",
];
export const SALE_RETURN_STATE_SQL = `CASE WHEN NOT EXISTS (SELECT 1 FROM sale_returns sr WHERE sr.sale_id = s.id) THEN 'NONE'
  WHEN EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.quantity > si.returned_quantity) THEN 'PARTIAL' ELSE 'FULL' END`;

function assertSaleId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("Selecciona una venta válida.");
}

function validateDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Selecciona una fecha válida.");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Selecciona una fecha válida.");
  }
  return value;
}

export function validateDocumentStore(store: TicketStoreInfo): TicketStoreInfo {
  if (
    !store ||
    typeof store.name !== "string" ||
    typeof store.address !== "string" ||
    typeof store.phone !== "string"
  ) {
    throw new Error("Los datos del negocio no son válidos.");
  }
  return {
    name: store.name.trim().slice(0, 200),
    address: store.address.trim().slice(0, 1000),
    phone: store.phone.trim().slice(0, 100),
  };
}

export function listSalesHistory(
  query: SalesHistoryQuery = {},
): SalesHistoryResult {
  if (!query || typeof query !== "object")
    throw new Error("Los filtros de ventas no son válidos.");
  const search =
    typeof query.search === "string" ? query.search.trim().slice(0, 200) : "";
  const payment = query.payment ?? "ALL";
  if (!PAYMENT_FILTERS.includes(payment))
    throw new Error("Selecciona una forma de pago válida.");
  const pageSize = query.pageSize ?? 20;
  const requestedPage = query.page ?? 1;
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Number.isSafeInteger(requestedPage) ||
    requestedPage < 1
  ) {
    throw new Error("La página de ventas solicitada no es válida.");
  }

  const clauses: string[] = [];
  const parameters: Record<string, string | number> = {};
  if (search) {
    parameters.search = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push(
      `(s.folio LIKE @search ESCAPE '\\' OR ${CUSTOMER_NAME} LIKE @search ESCAPE '\\')`,
    );
  }
  const dateFrom = validateDate(query.dateFrom);
  const dateTo = validateDate(query.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error(
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }
  if (dateFrom) {
    parameters.dateFrom = `${dateFrom} 00:00:00`;
    clauses.push("s.created_at >= @dateFrom");
  }
  if (dateTo) {
    parameters.dateTo = `${dateTo} 00:00:00`;
    // Incluye todo el último día y conserva el uso del índice de created_at.
    clauses.push("s.created_at < datetime(@dateTo, '+1 day')");
  }
  if (payment === "STORE_CREDIT")
    clauses.push(
      "(s.credit_amount > 0 OR EXISTS (SELECT 1 FROM sale_return_origins ro WHERE ro.sale_id = s.id AND ro.credit_amount > 0))",
    );
  else if (payment === "CARD") {
    clauses.push(
      "EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.method IN ('CARD', 'DEBIT', 'CREDIT') AND p.amount > 0)",
    );
  } else if (payment !== "ALL") {
    parameters.payment = payment;
    clauses.push(
      "EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.method = @payment AND p.amount > 0)",
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const database = getDb();
  return database.transaction((): SalesHistoryResult => {
    const summary = database
      .prepare(
        `
      SELECT COUNT(*) AS count, COALESCE(SUM(s.total), 0) AS total FROM ${SOURCE} ${where}
    `,
      )
      .get(parameters) as { count: number; total: number };
    const page = Math.min(
      requestedPage,
      Math.max(1, Math.ceil(summary.count / pageSize)),
    );
    const records = database
      .prepare(
        `
      SELECT s.id, s.folio, s.created_at AS createdAt, ${CUSTOMER_NAME} AS customerName,
        s.total, s.status, s.credit_amount AS creditAmount, t.id AS ticketId,
        s.returned_amount AS returnedAmount, ${SALE_RETURN_STATE_SQL} AS returnState,
        (SELECT GROUP_CONCAT(DISTINCT p.method) FROM payments p WHERE p.sale_id = s.id AND p.amount > 0) AS methods,
        CASE WHEN json_valid(t.payload) THEN
          CASE WHEN json_type(t.payload, '$.items') = 'array' THEN json_array_length(t.payload, '$.items')
            ELSE (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id AND i.quantity > i.returned_quantity) END
          ELSE (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id AND i.quantity > i.returned_quantity) END AS itemCount
      FROM ${SOURCE} ${where} ORDER BY s.created_at DESC, s.id DESC LIMIT @limit OFFSET @offset
    `,
      )
      .all({
        ...parameters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }) as Array<
      Omit<SalesHistoryRow, "paymentMethods"> & { methods: string | null }
    >;
    const rows: SalesHistoryRow[] = records.map(({ methods, ...row }) => ({
      ...row,
      paymentMethods: (methods?.split(",") ?? []).filter(
        (method): method is PaymentMethod =>
          PAYMENT_METHODS.includes(method as PaymentMethod),
      ),
    }));
    const total = roundMoney(summary.total);
    return {
      rows,
      totalRecords: summary.count,
      page,
      pageSize,
      summary: {
        count: summary.count,
        total,
        average: summary.count ? roundMoney(total / summary.count) : 0,
      },
    };
  })();
}

export function getSaleHistoryDetail(id: number): SalesHistoryDetail | null {
  assertSaleId(id);
  const database = getDb();
  return database.transaction((): SalesHistoryDetail | null => {
    const sale = getSale(id);
    if (!sale) return null;
    const ticket = getTicketBySaleId(id);
    const returned = database
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(refund_amount), 0) AS refunded,
      COALESCE(SUM(debt_reduction), 0) AS debtReduced FROM sale_returns WHERE sale_id = ?`,
      )
      .get(id) as { count: number; refunded: number; debtReduced: number };
    if (ticket && !returned.count)
      return {
        sale,
        ticketId: ticket.id,
        payload: ticket.payload,
        reconstructed: false,
      };
    const customer =
      sale.customerId === null
        ? null
        : (database
            .prepare("SELECT name, code FROM customers WHERE id = ?")
            .get(sale.customerId) as
            { name: string; code: string } | undefined);
    const items = listSaleItems(id).map(
      ({ productName, unit, quantity, unitPrice, lineTotal }) => ({
        productName,
        unit,
        quantity,
        unitPrice,
        lineTotal,
      }),
    );
    const originalPayments = listPaymentsForSale(id).filter(
      (payment) => payment.amount > 0,
    );
    const payments = returned.count
      ? allocateDiscount(
          originalPayments.map((payment) => payment.amount),
          sale.paidAmount,
        )
      : originalPayments.map((payment) => payment.amount);
    return {
      sale,
      ticketId: ticket?.id ?? null,
      reconstructed: !ticket,
      payload: {
        sale: {
          id: sale.id,
          folio: sale.folio,
          createdAt: sale.createdAt,
          status: sale.status,
        },
        items,
        payments: originalPayments
          .map(({ method }, index) => ({ method, amount: payments[index] }))
          .filter((payment) => payment.amount > 0),
        subtotal: sale.subtotal,
        total: sale.total,
        discount: sale.discount,
        creditAmount: sale.creditAmount,
        change: 0,
        customer: ticket?.payload.customer ?? customer ?? null,
        attendedBy: sale.cashierName ?? ticket?.payload.attendedBy ?? null,
        store: ticket?.payload.store ?? { name: "", address: "", phone: "" },
        ...(returned.count
          ? {
              returns: {
                state: items.length ? ("PARTIAL" as const) : ("FULL" as const),
                amount: sale.returnedAmount,
                refunded: roundMoney(returned.refunded),
                debtReduced: roundMoney(returned.debtReduced),
              },
            }
          : {}),
      },
    };
  })();
}

export function ensureSaleTicket(input: EnsureSaleTicketInput): Ticket {
  if (!input) throw new Error("Selecciona una venta para recuperar el ticket.");
  assertSaleId(input.saleId);
  const store = validateDocumentStore(input.store);
  return getDb()
    .transaction((): Ticket => {
      const detail = getSaleHistoryDetail(input.saleId);
      if (!detail) throw new Error("La venta ya no está disponible.");
      if (detail.payload.items.length === 0 && !detail.payload.returns)
        throw new Error(
          "Esta venta histórica no tiene artículos guardados para emitir un ticket.",
        );
      return createTicket({
        saleId: detail.sale.id,
        payload: {
          ...detail.payload,
          store: detail.reconstructed ? store : detail.payload.store,
        },
      });
    })
    .immediate();
}
