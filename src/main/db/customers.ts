import type {
  AccountMovement,
  CreateCustomerInput,
  Customer,
  CustomerWithBalance,
  UpdateCustomerInput,
} from "../../shared/ipc";
import { getDb } from "./database";

const SELECT_COLUMNS = `
  id, code, name, phone, email, address, notes, image_url,
  credit_limit, created_at, updated_at
`;

export function listCustomers(): CustomerWithBalance[] {
  const rows = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM customers
        WHERE deleted_at IS NULL
        ORDER BY name`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const customer = mapCustomerRow(row);
    return { ...customer, balance: computeBalance(customer.id) };
  });
}

export function getCustomer(id: number): Customer | null {
  const row = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM customers
        WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapCustomerRow(row) : null;
}

export function createCustomer(input: CreateCustomerInput): Customer {
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO customers (code, name, phone, email, address, notes, image_url, credit_limit)
         VALUES (@code, @name, @phone, @email, @address, @notes, @imageUrl, @creditLimit)`,
      )
      .run({
        code: input.code,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        imageUrl: input.imageUrl ?? null,
        creditLimit: input.creditLimit ?? 0,
      });

    return getCustomer(Number(info.lastInsertRowid))!;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed: customers.code")
    ) {
      throw new Error(
        `Ya existe un cliente activo con el código "${input.code}".`,
      );
    }
    throw err;
  }
}

export function updateCustomer(
  id: number,
  input: UpdateCustomerInput,
): Customer | null {
  const current = getCustomer(id);
  if (!current) return null;

  const merged = { ...current, ...input };
  try {
    const result = getDb()
      .prepare(
        `UPDATE customers SET
          code = @code, name = @name, phone = @phone, email = @email,
          address = @address, notes = @notes, image_url = @imageUrl,
          credit_limit = @creditLimit, updated_at = app_now()
         WHERE id = @id`,
      )
      .run({
        id,
        code: merged.code,
        name: merged.name,
        phone: merged.phone,
        email: merged.email,
        address: merged.address,
        notes: merged.notes,
        imageUrl: merged.imageUrl,
        creditLimit: merged.creditLimit,
      });

    if (result.changes === 0) return null;
    return getCustomer(id);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed: customers.code")
    ) {
      throw new Error(
        `Ya existe un cliente activo con el código "${merged.code}".`,
      );
    }
    throw err;
  }
}

export function deleteCustomer(id: number): boolean {
  const customer = getDb()
    .prepare(`SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL`)
    .get(id) as { id: number } | undefined;
  if (!customer) return false;

  const balance = computeBalance(id);
  if (balance > 0) {
    throw new Error(
      `No se puede eliminar el cliente porque tiene un saldo pendiente de ${balance.toFixed(2)}. Solo se pueden eliminar clientes al corriente (sin deuda).`,
    );
  }

  const result = getDb()
    .prepare(
      `UPDATE customers SET deleted_at = app_now(), updated_at = app_now()
        WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(id);
  return result.changes > 0;
}

export function computeBalance(customerId: number): number {
  const credit = getDb()
    .prepare(
      "SELECT COALESCE(SUM(credit_amount), 0) AS total FROM sales WHERE customer_id = ?",
    )
    .get(customerId) as { total: number };

  const paid = getDb()
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE customer_id = ? AND sale_id IS NULL",
    )
    .get(customerId) as { total: number };

  return Math.max(0, credit.total - paid.total);
}

export function listMovements(customerId: number): AccountMovement[] {
  const sales = getDb()
    .prepare(
      `SELECT id, folio, total, credit_amount, status, notes, created_at
         FROM sales WHERE customer_id = ? AND credit_amount > 0 ORDER BY created_at DESC`,
    )
    .all(customerId) as Array<{
    id: number;
    folio: string;
    total: number;
    credit_amount: number;
    status: string;
    notes: string | null;
    created_at: string;
  }>;

  const payments = getDb()
    .prepare(
      `SELECT id, amount, method, reference, notes, created_at
         FROM payments WHERE customer_id = ? AND sale_id IS NULL ORDER BY created_at DESC`,
    )
    .all(customerId) as Array<{
    id: number;
    amount: number;
    method: string;
    reference: string | null;
    notes: string | null;
    created_at: string;
  }>;

  const movements: AccountMovement[] = [];

  for (const sale of sales) {
    movements.push({
      kind: "CHARGE",
      id: sale.id,
      date: sale.created_at,
      description: `${sale.folio}${sale.notes ? ` · ${sale.notes}` : ""}`,
      amount: sale.credit_amount,
      status: sale.status as AccountMovement["status"],
    });
  }

  for (const payment of payments) {
    const methodLabel =
      payment.method === "CASH"
        ? "EFECTIVO"
        : payment.method === "CARD"
          ? "TARJETA"
          : payment.method === "TRANSFER"
            ? "TRANSFERENCIA"
            : payment.method === "VOUCHER"
              ? "VALE"
              : "OTRO";

    movements.push({
      kind: payment.amount < 0 ? "REFUND" : "PAYMENT",
      id: payment.id,
      date: payment.created_at,
      description: payment.reference
        ? `${methodLabel} · ${payment.reference}`
        : `${methodLabel}${payment.notes ? ` · ${payment.notes}` : ""}`,
      amount: payment.amount,
      method: payment.method as AccountMovement["method"],
    });
  }

  movements.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return movements;
}

function mapCustomerRow(row: Record<string, unknown>): Customer {
  return {
    id: row.id as number,
    code: row.code as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    creditLimit: row.credit_limit as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
