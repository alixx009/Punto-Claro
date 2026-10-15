import type {
  PaymentMethod,
  ProductUnit,
  ReportAuditRow,
  ReportCutRow,
  ReportInventoryResult,
  ReportInventoryRow,
  ReportMovementRow,
  ReportMovementsResult,
  ReportPage,
  ReportPageQuery,
  ReportRestockResult,
  ReportSaleRow,
  ReportSalesQuery,
  ReportSalesResult,
} from "../../shared/ipc";
import { roundMoney } from "../../shared/money";
import { getDb } from "./database";
import { SALE_RETURN_STATE_SQL } from "./sales-history";

const PAGE_SIZE = 25;
type Parameters = Record<string, string | number>;

function dateKey(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Selecciona una fecha válida.");
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new Error("Selecciona una fecha válida.");
  return value;
}

function filters(query: ReportPageQuery, column: string) {
  if (!query || typeof query !== "object" || Array.isArray(query))
    throw new Error("Los filtros del reporte no son válidos.");
  const page = query.page ?? 1;
  if (!Number.isSafeInteger(page) || page < 1)
    throw new Error("Selecciona una página válida.");
  const search =
    typeof query.search === "string" ? query.search.trim().slice(0, 200) : "";
  const from = dateKey(query.dateFrom);
  const to = dateKey(query.dateTo);
  if (from && to && from > to)
    throw new Error("La fecha inicial no puede superar la fecha final.");
  const clauses: string[] = [];
  const parameters: Parameters = {};
  if (from) {
    parameters.dateFrom = `${from} 00:00:00`;
    clauses.push(`${column} >= @dateFrom`);
  }
  if (to) {
    parameters.dateTo = `${to} 00:00:00`;
    clauses.push(`${column} < datetime(@dateTo, '+1 day')`);
  }
  if (search) parameters.search = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  return { page, search, clauses, parameters };
}

function pagination(count: number, requested: number) {
  const page = Math.min(requested, Math.max(1, Math.ceil(count / PAGE_SIZE)));
  return {
    page,
    pageSize: PAGE_SIZE,
    totalRecords: count,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
}

const CUSTOMER = `COALESCE(NULLIF(TRIM(CASE WHEN json_valid(t.payload) THEN json_extract(t.payload, '$.customer.name') END), ''), c.name, 'Cliente General')`;
const SALES_SOURCE = `sales s LEFT JOIN customers c ON c.id = s.customer_id
  LEFT JOIN tickets t ON t.sale_id = s.id LEFT JOIN register_sessions r ON r.id = s.register_session_id`;
const CASHIER = "COALESCE(s.cashier_name, r.cashier_name, 'ADMIN')";
const COST = `(SELECT COALESCE(SUM(i.purchase_cost * (i.quantity - i.returned_quantity)), 0) FROM sale_items i WHERE i.sale_id = s.id)`;
const MISSING_COST = `((SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id) = 0
  OR EXISTS(SELECT 1 FROM sale_items i WHERE i.sale_id = s.id AND i.quantity > i.returned_quantity AND i.purchase_cost IS NULL))`;

function salesFilters(query: ReportSalesQuery) {
  const result = filters(query, "s.created_at");
  if (result.search)
    result.clauses.push(
      `(s.folio LIKE @search ESCAPE '\\' OR ${CUSTOMER} LIKE @search ESCAPE '\\' OR s.notes LIKE @search ESCAPE '\\')`,
    );
  const payment = query.payment ?? "ALL";
  if (!["ALL", "CASH", "CARD", "TRANSFER", "STORE_CREDIT"].includes(payment))
    throw new Error("Selecciona una forma de pago válida.");
  if (payment === "STORE_CREDIT")
    result.clauses.push(
      "(s.credit_amount > 0 OR EXISTS (SELECT 1 FROM sale_return_origins ro WHERE ro.sale_id = s.id AND ro.credit_amount > 0))",
    );
  else if (payment === "CARD")
    result.clauses.push(
      "EXISTS(SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.method IN ('CARD','DEBIT','CREDIT') AND p.amount > 0)",
    );
  else if (payment !== "ALL") {
    result.parameters.payment = payment;
    result.clauses.push(
      "EXISTS(SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.method = @payment AND p.amount > 0)",
    );
  }
  const state = query.state ?? "ALL";
  if (!["ALL", "ACTIVE", "RETURNED"].includes(state))
    throw new Error("Selecciona un estado válido.");
  if (state === "RETURNED")
    result.clauses.push(
      "EXISTS(SELECT 1 FROM sale_returns sr WHERE sr.sale_id = s.id)",
    );
  if (state === "ACTIVE")
    result.clauses.push(`(${SALE_RETURN_STATE_SQL}) <> 'FULL'`);
  if (
    query.cashier !== undefined &&
    (typeof query.cashier !== "string" ||
      query.cashier.length > 120 ||
      !query.cashier.trim())
  )
    throw new Error("Selecciona un cajero válido.");
  if (query.cashier && query.cashier !== "ALL") {
    result.parameters.cashier = query.cashier;
    result.clauses.push(`${CASHIER} = @cashier`);
  }
  const exactDate = dateKey(query.date);
  if (exactDate) {
    result.parameters.exactDate = `${exactDate} 00:00:00`;
    result.clauses.push(
      "s.created_at >= @exactDate AND s.created_at < datetime(@exactDate, '+1 day')",
    );
  }
  return {
    ...result,
    where: result.clauses.length ? `WHERE ${result.clauses.join(" AND ")}` : "",
  };
}

export function reportSales(
  query: ReportSalesQuery = {},
  allRows = false,
): ReportSalesResult {
  const { page: requestedPage, parameters, where } = salesFilters(query);
  const database = getDb();
  return database.transaction(() => {
    const aggregate = database
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(s.paid_amount),0) AS collected,
      COALESCE(SUM(CASE WHEN ${MISSING_COST} THEN 1 ELSE 0 END),0) AS missingCostSales,
      COALESCE(SUM(s.total - ${COST}),0) AS profit FROM ${SALES_SOURCE} ${where}`,
      )
      .get(parameters) as {
      count: number;
      collected: number;
      missingCostSales: number;
      profit: number;
    };
    const paging = pagination(aggregate.count, requestedPage);
    const rawRows = database
      .prepare(
        `SELECT s.id, s.folio, s.created_at AS createdAt, ${CUSTOMER} AS customerName,
      ${CASHIER} AS cashierName, s.total, s.status, s.credit_amount AS creditAmount,
      s.notes, s.paid_amount AS paidAmount, t.id AS ticketId, s.returned_amount AS returnedAmount,
      ${SALE_RETURN_STATE_SQL} AS returnState,
      (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id AND i.quantity > i.returned_quantity) AS itemCount,
      (SELECT GROUP_CONCAT(DISTINCT p.method) FROM payments p WHERE p.sale_id = s.id AND p.amount > 0) AS methods
      FROM ${SALES_SOURCE} ${where} ORDER BY s.created_at DESC, s.id DESC ${allRows ? "" : "LIMIT @limit OFFSET @offset"}`,
      )
      .all(
        allRows
          ? parameters
          : { ...parameters, limit: paging.limit, offset: paging.offset },
      ) as Array<
      Omit<ReportSaleRow, "paymentMethods"> & { methods: string | null }
    >;
    const rows = rawRows.map(({ methods, ...row }) => ({
      ...row,
      paymentMethods: (methods?.split(",") ?? []) as PaymentMethod[],
    }));
    const volumeByUnit = database
      .prepare(
        `SELECT i.unit, ROUND(SUM(i.quantity - i.returned_quantity),3) AS quantity
      FROM sale_items i JOIN sales s ON s.id = i.sale_id LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN tickets t ON t.sale_id = s.id LEFT JOIN register_sessions r ON r.id = s.register_session_id
      ${where} GROUP BY i.unit`,
      )
      .all(parameters) as { unit: ProductUnit; quantity: number }[];
    const days = database
      .prepare(
        `SELECT substr(s.created_at,1,10) AS date, SUM(s.paid_amount) AS income
      FROM ${SALES_SOURCE} ${where} GROUP BY substr(s.created_at,1,10) ORDER BY date`,
      )
      .all(parameters) as { date: string; income: number }[];
    let accumulated = 0;
    const trend = days.map((day) => {
      accumulated = roundMoney(accumulated + day.income);
      return { date: day.date, income: roundMoney(day.income), accumulated };
    });
    const years = database
      .prepare(
        "SELECT DISTINCT CAST(substr(created_at,1,4) AS INTEGER) AS year FROM sales ORDER BY year DESC",
      )
      .all() as { year: number }[];
    return {
      rows,
      page: paging.page,
      pageSize: PAGE_SIZE,
      totalRecords: paging.totalRecords,
      summary: {
        collected: roundMoney(aggregate.collected),
        profit: aggregate.missingCostSales
          ? null
          : roundMoney(aggregate.profit),
        missingCostSales: aggregate.missingCostSales,
        count: aggregate.count,
        volume:
          Math.round(
            volumeByUnit.reduce((sum, item) => sum + item.quantity, 0) * 1000,
          ) / 1000,
        volumeByUnit,
      },
      trend,
      availableYears: years.map(({ year }) => year).filter(Number.isFinite),
      availableCashiers: (
        database
          .prepare(
            `SELECT DISTINCT ${CASHIER} AS name FROM ${SALES_SOURCE} ORDER BY name COLLATE NOCASE`,
          )
          .all() as { name: string }[]
      ).map((row) => row.name),
      returnsSupported: true,
    };
  })();
}

export function reportCuts(
  query: ReportPageQuery = {},
): ReportPage<ReportCutRow> {
  const {
    page: requestedPage,
    clauses,
    parameters,
    search,
  } = filters(query, "r.opened_at");
  clauses.push("r.status = 'CLOSED'");
  if (search)
    clauses.push(
      "(r.cashier_name LIKE @search ESCAPE '\\' OR 'Caja principal' LIKE @search ESCAPE '\\' OR r.notes LIKE @search ESCAPE '\\')",
    );
  const where = `WHERE ${clauses.join(" AND ")}`;
  const database = getDb();
  return database.transaction(() => {
    const { count } = database
      .prepare(`SELECT COUNT(*) AS count FROM register_sessions r ${where}`)
      .get(parameters) as { count: number };
    const paging = pagination(count, requestedPage);
    const rows = database
      .prepare(
        `SELECT r.id, r.cashier_name AS cashierName, 'Caja principal' AS terminal,
      r.opened_at AS openedAt, r.closed_at AS closedAt, r.opening_amount AS openingAmount,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.register_session_id = r.id AND p.method = 'CASH'),0) AS cashIncome,
      COALESCE(r.closing_amount,0) AS closingAmount, COALESCE(r.expected_amount,0) AS expectedAmount,
      ROUND(COALESCE(r.difference,0),2) AS difference FROM register_sessions r ${where}
      ORDER BY r.opened_at DESC, r.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({
        ...parameters,
        limit: paging.limit,
        offset: paging.offset,
      }) as ReportCutRow[];
    return {
      rows,
      totalRecords: count,
      page: paging.page,
      pageSize: PAGE_SIZE,
    };
  })();
}

export function reportAudit(): ReportAuditRow[] {
  const rows = getDb()
    .prepare(
      `SELECT cashier_name AS cashierName, COUNT(*) AS shifts,
    ROUND(SUM(CASE WHEN difference < 0 THEN -difference ELSE 0 END),2) AS shortage,
    ROUND(SUM(CASE WHEN difference > 0 THEN difference ELSE 0 END),2) AS surplus,
    ROUND(COALESCE(SUM(difference),0),2) AS balance FROM register_sessions WHERE status = 'CLOSED' GROUP BY cashier_name`,
    )
    .all() as ReportAuditRow[];
  return rows.length
    ? rows
    : [
        {
          cashierName: "ADMIN",
          shifts: 0,
          shortage: 0,
          surplus: 0,
          balance: 0,
        },
      ];
}

function inventorySource(query: ReportPageQuery, critical: boolean) {
  const { search, parameters, page } = filters(query, "created_at");
  const clauses: string[] = [];
  // Inventario describe las existencias actuales; no acepta un periodo histórico.
  delete parameters.dateFrom;
  delete parameters.dateTo;
  if (search)
    clauses.push(
      "(name LIKE @search ESCAPE '\\' OR sku LIKE @search ESCAPE '\\')",
    );
  if (critical) clauses.push("stock <= 5");
  return {
    parameters,
    page,
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

export function reportInventory(
  query: ReportPageQuery = {},
  allRows = false,
): ReportInventoryResult {
  return inventoryReport(query, false, allRows);
}

function inventoryReport(
  query: ReportPageQuery,
  critical: boolean,
  allRows = false,
): ReportInventoryResult {
  const { parameters, page, where } = inventorySource(query, critical);
  const database = getDb();
  return database.transaction(() => {
    const summary = database
      .prepare(
        `SELECT COUNT(*) AS count, ROUND(COALESCE(SUM(stock),0),3) AS stock,
      ROUND(COALESCE(SUM(stock * purchase_price),0),2) AS cost,
      ROUND(COALESCE(SUM(stock * sale_price),0),2) AS publicValue FROM products ${where}`,
      )
      .get(parameters) as ReportInventoryResult["summary"];
    summary.stockByUnit = database
      .prepare(
        `SELECT unit, ROUND(SUM(stock),3) AS quantity FROM products ${where} GROUP BY unit`,
      )
      .all(parameters) as ReportInventoryResult["summary"]["stockByUnit"];
    const paging = pagination(summary.count, page);
    const rows = database
      .prepare(
        `SELECT id, name, sku, unit, stock, purchase_price AS purchasePrice,
      sale_price AS salePrice, ROUND(stock * purchase_price,2) AS costValue, ROUND(stock * sale_price,2) AS publicValue
      FROM products ${where} ORDER BY ${critical ? "stock ASC," : ""} name COLLATE NOCASE, id
      ${allRows ? "" : "LIMIT @limit OFFSET @offset"}`,
      )
      .all(
        allRows
          ? parameters
          : { ...parameters, limit: paging.limit, offset: paging.offset },
      ) as ReportInventoryRow[];
    return {
      rows,
      summary,
      totalRecords: summary.count,
      page: paging.page,
      pageSize: PAGE_SIZE,
    };
  })();
}

export function reportRestock(
  query: ReportPageQuery = {},
): ReportRestockResult {
  const { summary: _summary, ...result } = inventoryReport(query, true);
  return { ...result, threshold: 5 };
}

export function reportMovements(
  query: ReportPageQuery = {},
): ReportMovementsResult {
  const { page, clauses, parameters, search } = filters(query, "m.created_at");
  if (search)
    clauses.push(
      "(m.product_name LIKE @search ESCAPE '\\' OR m.sku LIKE @search ESCAPE '\\' OR m.reason LIKE @search ESCAPE '\\' OR COALESCE(s.folio, p.folio, 'K-' || printf('%06d',m.id)) LIKE @search ESCAPE '\\')",
    );
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const database = getDb();
  return database.transaction(() => {
    const { count } = database
      .prepare(
        `SELECT COUNT(*) AS count FROM product_movements m LEFT JOIN sales s ON s.id = m.sale_id
         LEFT JOIN purchases p ON p.id = m.purchase_id ${where}`,
      )
      .get(parameters) as { count: number };
    const paging = pagination(count, page);
    const rows = database
      .prepare(
        `SELECT m.id, m.product_id AS productId, m.product_name AS productName,
      m.sku, m.unit, m.kind, m.quantity, m.stock_before AS stockBefore, m.stock_after AS stockAfter,
      m.sale_id AS saleId, COALESCE(s.folio, p.folio, 'K-' || printf('%06d',m.id)) AS folio,
      m.reason, m.created_at AS createdAt FROM product_movements m LEFT JOIN sales s ON s.id = m.sale_id
      LEFT JOIN purchases p ON p.id = m.purchase_id
      ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({
        ...parameters,
        limit: paging.limit,
        offset: paging.offset,
      }) as ReportMovementRow[];
    const tracking = database
      .prepare(
        "SELECT started_at AS startedAt FROM inventory_tracking WHERE id = 1",
      )
      .get() as { startedAt: string };
    return {
      rows,
      totalRecords: count,
      page: paging.page,
      pageSize: PAGE_SIZE,
      trackingStartedAt: tracking.startedAt,
    };
  })();
}
