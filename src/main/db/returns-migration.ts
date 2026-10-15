import type Database from "better-sqlite3";

export function migrateSaleReturns(database: Database.Database): void {
  database
    .transaction(() => {
      const movementSchema = database
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'product_movements'",
        )
        .get() as { sql: string };
      if (!movementSchema.sql.includes("'RETURN'")) {
        const sequence = database
          .prepare(
            "SELECT seq FROM sqlite_sequence WHERE name = 'product_movements'",
          )
          .get() as { seq: number } | undefined;
        database.exec(`
        DROP TRIGGER IF EXISTS products_movement_create;
        DROP TRIGGER IF EXISTS products_movement_delete;
        CREATE TABLE product_movements_with_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL, product_name TEXT NOT NULL, sku TEXT NOT NULL,
          unit TEXT NOT NULL CHECK (unit IN ('PIEZA', 'KG', 'PAQ')),
          kind TEXT NOT NULL CHECK (kind IN ('INITIAL', 'CREATE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DELETE')),
          quantity REAL NOT NULL, stock_before REAL, stock_after REAL,
          sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
          reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (app_now())
        );
        INSERT INTO product_movements_with_returns SELECT * FROM product_movements;
        DROP TABLE product_movements;
        ALTER TABLE product_movements_with_returns RENAME TO product_movements;
        CREATE INDEX idx_product_movements_created ON product_movements(created_at, id);
        CREATE INDEX idx_product_movements_product ON product_movements(product_id, id);
      `);
        if (sequence) {
          database
            .prepare(
              "INSERT INTO sqlite_sequence (name, seq) SELECT 'product_movements', ? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'product_movements')",
            )
            .run(sequence.seq);
          database
            .prepare(
              "UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'product_movements'",
            )
            .run(sequence.seq);
        }
        // Los triggers de alta/baja se vuelven a crear al inicializar Kardex.
      }
      database.exec(`
      CREATE TABLE IF NOT EXISTS sale_return_origins (
        sale_id INTEGER PRIMARY KEY REFERENCES sales(id) ON DELETE RESTRICT,
        subtotal REAL NOT NULL, discount REAL NOT NULL, total REAL NOT NULL,
        paid_amount REAL NOT NULL, credit_amount REAL NOT NULL,
        ticket_payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (app_now())
      );
      CREATE TABLE IF NOT EXISTS sale_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE, request_fingerprint TEXT NOT NULL,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
        register_session_id INTEGER NOT NULL REFERENCES register_sessions(id) ON DELETE RESTRICT,
        amount REAL NOT NULL CHECK (amount >= 0), discount_amount REAL NOT NULL,
        credit_reduction REAL NOT NULL CHECK (credit_reduction >= 0),
        debt_reduction REAL NOT NULL CHECK (debt_reduction >= 0),
        refund_amount REAL NOT NULL CHECK (refund_amount >= 0),
        refund_method TEXT CHECK (refund_method IN ('CASH', 'CARD', 'TRANSFER')),
        created_at TEXT NOT NULL DEFAULT (app_now())
      );
      CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id, id);
      CREATE INDEX IF NOT EXISTS idx_sale_returns_session ON sale_returns(register_session_id, id);
      CREATE TABLE IF NOT EXISTS sale_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE RESTRICT,
        sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL CHECK (quantity > 0),
        line_subtotal REAL NOT NULL, discount_amount REAL NOT NULL, line_total REAL NOT NULL CHECK (line_total >= 0),
        UNIQUE (return_id, sale_item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item ON sale_return_items(sale_item_id);
    `);
      if (database.pragma("foreign_key_check").length)
        throw new Error(
          "No se pudo preparar el registro de devoluciones: hay relaciones inconsistentes en la base de datos.",
        );
    })
    .immediate();
}
