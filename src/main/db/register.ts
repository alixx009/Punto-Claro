import type {
  CashMovement,
  CloseRegisterInput,
  CreateCashMovementInput,
  OpenRegisterInput,
  RegisterExpectedByMethod,
  RegisterSession,
} from "../../shared/ipc";
import { getDb } from "./database";
import { roundMoney } from "../../shared/money";
import type { OperationActor } from "../../shared/auth";

const SELECT_COLUMNS = `
  id, cashier_name, cashier_id, opening_amount, opened_at, closed_at, closing_amount,
  expected_amount, difference, status, notes
`;

const EMPTY_BREAKDOWN: RegisterExpectedByMethod = {
  cash: 0,
  card: 0,
  transfer: 0,
  other: 0,
};

export function getCurrentSession(): RegisterSession | null {
  const row = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM register_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined;
  if (!row) return null;
  const session = mapRow(row);
  session.cashPayments = sumCashPayments(session.id);
  session.cashMovements = sumCashMovements(session.id);
  session.expectedByMethod = getSessionBreakdown(session.id);
  return session;
}

export function openSession(
  input: OpenRegisterInput,
  actor: OperationActor,
): RegisterSession {
  if (
    !input ||
    !Number.isFinite(input.openingAmount) ||
    input.openingAmount < 0 ||
    !Number.isSafeInteger(Math.round(input.openingAmount * 100)) ||
    Math.abs(
      input.openingAmount * 100 - Math.round(input.openingAmount * 100),
    ) > 1e-7
  ) {
    throw new Error(
      "El fondo de apertura debe ser un monto válido con máximo dos decimales.",
    );
  }
  const existing = getCurrentSession();
  if (existing) {
    throw new Error("Ya hay una caja abierta. Ciérrala antes de abrir otra.");
  }

  const info = getDb()
    .prepare(
      `INSERT INTO register_sessions (opening_amount, status, notes, cashier_id, cashier_name) VALUES (?, 'OPEN', ?, ?, ?)`,
    )
    .run(input.openingAmount, input.notes ?? null, actor.id, actor.displayName);

  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM register_sessions WHERE id = ?`)
    .get(info.lastInsertRowid) as Record<string, unknown>;
  const session = mapRow(row);
  session.cashPayments = 0;
  session.cashMovements = 0;
  session.expectedByMethod = { ...EMPTY_BREAKDOWN };
  return session;
}

export function closeSession(
  input: CloseRegisterInput,
  actor: OperationActor,
): RegisterSession {
  if (
    !input?.declaredByMethod ||
    ["cash", "card", "transfer"].some((key) => {
      const amount =
        input.declaredByMethod[
          key as keyof CloseRegisterInput["declaredByMethod"]
        ];
      return (
        !Number.isFinite(amount) ||
        amount < 0 ||
        !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7
      );
    })
  )
    throw new Error(
      "Los montos declarados deben ser válidos y tener máximo dos decimales.",
    );
  const session = getCurrentSession();
  if (!session) {
    throw new Error("No hay una caja abierta para cerrar.");
  }

  const breakdown = getSessionBreakdown(session.id);
  const declaredTotal = roundMoney(
    (input.declaredByMethod.cash ?? 0) +
      (input.declaredByMethod.card ?? 0) +
      (input.declaredByMethod.transfer ?? 0),
  );
  const expectedTotal = roundMoney(
    session.openingAmount +
      breakdown.cash +
      breakdown.card +
      breakdown.transfer +
      breakdown.other +
      sumCashMovements(session.id),
  );
  const difference = roundMoney(declaredTotal - expectedTotal);

  getDb()
    .prepare(
      `UPDATE register_sessions SET
        closed_at = app_now(),
        closing_amount = @closingAmount,
        expected_amount = @expectedAmount,
        difference = @difference,
        status = 'CLOSED',
        closed_by_user_id = @closedByUserId,
        closed_by_name = @closedByName,
        notes = COALESCE(@notes, notes)
       WHERE id = @id`,
    )
    .run({
      id: session.id,
      closingAmount: declaredTotal,
      expectedAmount: expectedTotal,
      difference,
      notes: input.notes ?? null,
      closedByUserId: actor.id,
      closedByName: actor.displayName,
    });

  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM register_sessions WHERE id = ?`)
    .get(session.id) as Record<string, unknown>;
  return mapRow(row);
}

export function createCashMovement(
  input: CreateCashMovementInput,
  actor: OperationActor,
): CashMovement {
  if (
    !input ||
    !Number.isFinite(input.amount) ||
    !(input.amount > 0) ||
    !Number.isSafeInteger(Math.round(input.amount * 100)) ||
    Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 1e-7 ||
    !["INCOME", "EXPENSE"].includes(input.kind)
  ) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) {
    throw new Error("Indica el motivo del movimiento.");
  }
  if (reason.length > 200) {
    throw new Error("El motivo no puede superar 200 caracteres.");
  }

  const session = getDb()
    .prepare(`SELECT status FROM register_sessions WHERE id = ?`)
    .get(input.sessionId) as { status: string } | undefined;
  if (!session) {
    throw new Error("La sesión de caja no existe.");
  }
  if (session.status !== "OPEN") {
    throw new Error(
      "La caja está cerrada. No se pueden registrar movimientos.",
    );
  }

  const info = getDb()
    .prepare(
      `INSERT INTO register_cash_movements (session_id, kind, amount, reason, performed_by_user_id, performed_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.kind,
      input.amount,
      reason,
      actor.id,
      actor.displayName,
    );

  return getCashMovement(Number(info.lastInsertRowid))!;
}

export function listCashMovements(sessionId: number): CashMovement[] {
  const rows = getDb()
    .prepare(
      `SELECT id, session_id, kind, amount, reason, created_at, performed_by_user_id, performed_by_name
         FROM register_cash_movements
        WHERE session_id = ?
        ORDER BY datetime(created_at) DESC, id DESC`,
    )
    .all(sessionId) as Array<Record<string, unknown>>;
  return rows.map(mapMovementRow);
}

function getCashMovement(id: number): CashMovement | null {
  const row = getDb()
    .prepare(
      `SELECT id, session_id, kind, amount, reason, created_at, performed_by_user_id, performed_by_name
         FROM register_cash_movements WHERE id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapMovementRow(row) : null;
}

function sumCashPayments(sessionId: number): number {
  const { total } = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM payments
        WHERE register_session_id = ? AND method = 'CASH'`,
    )
    .get(sessionId) as { total: number };
  return total;
}

function sumCashMovements(sessionId: number): number {
  const { income, expense } = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'INCOME'  THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN kind = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense
       FROM register_cash_movements
       WHERE session_id = ?`,
    )
    .get(sessionId) as { income: number; expense: number };
  return income - expense;
}

export function getSessionBreakdown(
  sessionId: number,
): RegisterExpectedByMethod {
  const rows = getDb()
    .prepare(
      `SELECT p.method AS method, COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
        WHERE p.register_session_id = ?
        GROUP BY p.method`,
    )
    .all(sessionId) as Array<{ method: string; total: number }>;

  const breakdown: RegisterExpectedByMethod = { ...EMPTY_BREAKDOWN };
  for (const row of rows) {
    if (row.method === "CASH") breakdown.cash += row.total;
    else if (
      row.method === "DEBIT" ||
      row.method === "CREDIT" ||
      row.method === "CARD"
    ) {
      breakdown.card += row.total;
    } else if (row.method === "TRANSFER") breakdown.transfer += row.total;
    else breakdown.other += row.total;
  }
  return breakdown;
}

function mapRow(row: Record<string, unknown>): RegisterSession {
  return {
    id: row.id as number,
    cashierName: (row.cashier_name as string) || "ADMIN",
    cashierId: (row.cashier_id as string | null) ?? null,
    openingAmount: row.opening_amount as number,
    cashPayments: 0,
    cashMovements: 0,
    expectedByMethod: { ...EMPTY_BREAKDOWN },
    openedAt: row.opened_at as string,
    closedAt: (row.closed_at as string | null) ?? null,
    closingAmount: (row.closing_amount as number | null) ?? null,
    expectedAmount: (row.expected_amount as number | null) ?? null,
    difference: (row.difference as number | null) ?? null,
    status: row.status as RegisterSession["status"],
    notes: (row.notes as string | null) ?? null,
  };
}

function mapMovementRow(row: Record<string, unknown>): CashMovement {
  return {
    id: row.id as number,
    sessionId: row.session_id as number,
    kind: row.kind as CashMovement["kind"],
    amount: row.amount as number,
    reason: row.reason as string,
    performedByUserId: (row.performed_by_user_id as string | null) ?? null,
    performedByName: (row.performed_by_name as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
