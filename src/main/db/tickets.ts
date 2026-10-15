import type {
  CreateTicketInput,
  Ticket,
  TicketPayload,
} from "../../shared/ipc";
import { getDb } from "./database";

const SELECT_COLUMNS = `
  tickets.id, tickets.sale_id, tickets.payload, tickets.total_amount, tickets.created_at,
  sales.folio AS sale_folio
`;
const TICKET_SOURCE = "tickets JOIN sales ON sales.id = tickets.sale_id";

export function createTicket(input: CreateTicketInput): Ticket {
  if (!input || !Number.isSafeInteger(input.saleId) || input.saleId <= 0) {
    throw new Error("Selecciona una venta válida para generar el ticket.");
  }
  const database = getDb();
  return database
    .transaction((): Ticket => {
      // Un reintento recupera el ticket original y conserva su identidad.
      const existing = database
        .prepare(
          `SELECT ${SELECT_COLUMNS} FROM ${TICKET_SOURCE} WHERE tickets.sale_id = ?`,
        )
        .get(input.saleId) as Record<string, unknown> | undefined;
      if (existing) return mapRow(existing);

      if (
        !input.payload ||
        typeof input.payload !== "object" ||
        !input.payload.sale ||
        input.payload.sale.id !== input.saleId
      ) {
        throw new Error(
          "Los datos del ticket no corresponden a la venta seleccionada.",
        );
      }
      const sale = database
        .prepare(
          `
      SELECT id, folio, created_at AS createdAt, status, subtotal, discount, total,
        credit_amount AS creditAmount, cashier_name AS cashierName FROM sales WHERE id = ?
    `,
        )
        .get(input.saleId) as
        | (TicketPayload["sale"] &
            Pick<
              TicketPayload,
              "subtotal" | "discount" | "total" | "creditAmount"
            > & { cashierName: string | null })
        | undefined;
      if (!sale)
        throw new Error(
          "La venta ya no está disponible para generar el ticket.",
        );

      const payload: TicketPayload = {
        ...input.payload,
        sale: {
          id: sale.id,
          folio: sale.folio,
          createdAt: sale.createdAt,
          status: sale.status,
        },
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        creditAmount: sale.creditAmount,
        attendedBy: sale.cashierName ?? input.payload.attendedBy ?? null,
      };
      const info = database
        .prepare(
          `INSERT INTO tickets (sale_id, folio, payload, total_amount)
        VALUES (@saleId, @folio, @payload, @totalAmount)`,
        )
        .run({
          saleId: sale.id,
          folio: sale.folio,
          payload: JSON.stringify(payload),
          totalAmount: sale.total,
        });

      const row = database
        .prepare(
          `SELECT ${SELECT_COLUMNS} FROM ${TICKET_SOURCE} WHERE tickets.id = ?`,
        )
        .get(info.lastInsertRowid) as Record<string, unknown>;
      return mapRow(row);
    })
    .immediate();
}

export function getTicket(id: number): Ticket | null {
  const row = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM ${TICKET_SOURCE} WHERE tickets.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function getTicketBySaleId(saleId: number): Ticket | null {
  const row = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM ${TICKET_SOURCE} WHERE tickets.sale_id = ?`,
    )
    .get(saleId) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function listTickets(limit = 100): Ticket[] {
  const rows = getDb()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM ${TICKET_SOURCE}
        ORDER BY datetime(tickets.created_at) DESC, tickets.id DESC
        LIMIT ?`,
    )
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapRow);
}

function mapRow(row: Record<string, unknown>): Ticket {
  let payload: TicketPayload;
  try {
    payload = JSON.parse(row.payload as string) as TicketPayload;
    if (
      !payload ||
      typeof payload !== "object" ||
      !payload.sale ||
      typeof payload.sale !== "object"
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("Los datos guardados de este ticket no se pudieron leer.");
  }
  const folio = row.sale_folio as string;
  return {
    id: row.id as number,
    saleId: row.sale_id as number,
    folio,
    payload: {
      ...payload,
      sale: { ...payload.sale, id: row.sale_id as number, folio },
    },
    totalAmount: row.total_amount as number,
    createdAt: row.created_at as string,
  };
}
