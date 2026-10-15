import type { CreatePaymentInput, Payment } from "../../shared/ipc";
import { getDb } from "./database";
import { computeBalance, getCustomer } from "./customers";
import type { OperationActor } from "../../shared/auth";

const SELECT_COLUMNS = `
  id, customer_id, sale_id, register_session_id, amount, method, reference, notes, created_at
`;

export function listPayments(): Payment[] {
  const rows = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM payments ORDER BY datetime(created_at) DESC, id DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapPaymentRow);
}

export function createPayment(
  input: CreatePaymentInput,
  actor: OperationActor,
): Payment {
  const database = getDb();
  return database.transaction(() => {
    const amountInCents = Math.round(input.amount * 100);
    if (
      !Number.isFinite(input.amount) ||
      !Number.isSafeInteger(amountInCents) ||
      amountInCents <= 0 ||
      Math.abs(input.amount * 100 - amountInCents) > 1e-7
    ) {
      throw new Error(
        "El abono debe ser un monto válido con máximo dos decimales.",
      );
    }

    if (!getCustomer(input.customerId)) {
      throw new Error("El cliente ya no está disponible.");
    }
    const openSession = database
      .prepare(
        "SELECT id FROM register_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1",
      )
      .get() as { id: number } | undefined;
    if (!openSession || input.registerSessionId !== openSession.id) {
      throw new Error("Abre la caja antes de registrar abonos.");
    }
    const balanceInCents = Math.round(computeBalance(input.customerId) * 100);
    if (amountInCents > balanceInCents) {
      throw new Error(
        "El abono no puede superar el saldo pendiente del cliente.",
      );
    }

    const info = database
      .prepare(
        `INSERT INTO payments (customer_id, sale_id, register_session_id, amount, method, reference, notes, performed_by_user_id, performed_by_name)
         VALUES (@customerId, @saleId, @registerSessionId, @amount, @method, @reference, @notes, @actorId, @actorName)`,
      )
      .run({
        customerId: input.customerId,
        saleId: input.saleId ?? null,
        registerSessionId: input.registerSessionId ?? null,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        actorId: actor.id,
        actorName: actor.displayName,
      });

    const row = database
      .prepare(`SELECT ${SELECT_COLUMNS} FROM payments WHERE id = ?`)
      .get(info.lastInsertRowid) as Record<string, unknown>;
    return mapPaymentRow(row);
  })();
}

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: row.id as number,
    customerId: row.customer_id as number,
    saleId: (row.sale_id as number | null) ?? null,
    registerSessionId: (row.register_session_id as number | null) ?? null,
    amount: row.amount as number,
    method: row.method as Payment["method"],
    reference: (row.reference as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
