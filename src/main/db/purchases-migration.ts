import type Database from "better-sqlite3";
import { PURCHASE_LIMITS } from "../../shared/purchases";

const BASE_MOVEMENT_COLUMNS = `id, product_id, product_name, sku, unit, kind,
  quantity, stock_before, stock_after, sale_id, reason, created_at`;

function rebuildMovements(
  database: Database.Database,
  includePurchases: boolean,
): void {
  const triggers = database
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'trigger'
       AND name IN ('products_movement_create', 'products_movement_delete')`,
    )
    .all() as { sql: string }[];
  const sequence = database
    .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'product_movements'")
    .get() as { seq: number } | undefined;

  database.exec(`
    DROP TRIGGER IF EXISTS products_movement_create;
    DROP TRIGGER IF EXISTS products_movement_delete;
    CREATE TABLE product_movements_purchase_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit TEXT NOT NULL CHECK (unit IN ('PIEZA', 'KG', 'PAQ')),
      kind TEXT NOT NULL CHECK (kind IN ('INITIAL', 'CREATE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DELETE'${includePurchases ? ", 'PURCHASE'" : ""})),
      quantity REAL NOT NULL,
      stock_before REAL,
      stock_after REAL,
      sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
      ${includePurchases ? "purchase_id INTEGER REFERENCES purchases(id) ON DELETE RESTRICT," : ""}
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (app_now())
    );
    INSERT INTO product_movements_purchase_migration (${BASE_MOVEMENT_COLUMNS})
      SELECT ${BASE_MOVEMENT_COLUMNS} FROM product_movements;
    DROP TABLE product_movements;
    ALTER TABLE product_movements_purchase_migration RENAME TO product_movements;
    CREATE INDEX idx_product_movements_created ON product_movements(created_at, id);
    CREATE INDEX idx_product_movements_product ON product_movements(product_id, id);
    CREATE INDEX idx_product_movements_sale ON product_movements(sale_id);
    ${includePurchases ? "CREATE INDEX idx_product_movements_purchase ON product_movements(purchase_id);" : ""}
  `);
  if (sequence) {
    database
      .prepare(
        `INSERT INTO sqlite_sequence(name, seq) SELECT 'product_movements', ?
         WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'product_movements')`,
      )
      .run(sequence.seq);
    database
      .prepare(
        "UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'product_movements'",
      )
      .run(sequence.seq);
  }
  for (const trigger of triggers) database.exec(trigger.sql);
}

export function migratePurchases(database: Database.Database): void {
  database
    .transaction(() => {
      database.exec(`CREATE TABLE IF NOT EXISTS purchase_schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (app_now())
      )`);
      if (
        database
          .prepare("SELECT 1 FROM purchase_schema_migrations WHERE version = 1")
          .get()
      )
        return;

      // Only trusted limits are interpolated; operation values use parameters.
      database.exec(`
        CREATE TABLE purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          folio TEXT NOT NULL UNIQUE,
          request_id TEXT NOT NULL UNIQUE,
          request_fingerprint TEXT NOT NULL,
          supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
          supplier_name TEXT NOT NULL,
          source TEXT NOT NULL CHECK (source = 'MANUAL'),
          total_cents INTEGER NOT NULL CHECK (typeof(total_cents) = 'integer' AND total_cents BETWEEN 0 AND ${PURCHASE_LIMITS.maxTotal * 100}),
          performed_by_user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
          performed_by_name TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (app_now())
        );
        CREATE INDEX idx_purchases_created ON purchases(created_at, id);
        CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
        CREATE INDEX idx_purchases_actor ON purchases(performed_by_user_id);
        CREATE TABLE purchase_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          product_name TEXT NOT NULL,
          sku TEXT NOT NULL,
          unit TEXT NOT NULL CHECK (unit IN ('PIEZA', 'KG', 'PAQ')),
          quantity REAL NOT NULL CHECK (quantity > 0 AND quantity <= ${PURCHASE_LIMITS.maxQuantity}),
          unit_cost_cents INTEGER NOT NULL CHECK (typeof(unit_cost_cents) = 'integer' AND unit_cost_cents BETWEEN 0 AND ${PURCHASE_LIMITS.maxUnitCost * 100}),
          line_total_cents INTEGER NOT NULL CHECK (typeof(line_total_cents) = 'integer' AND line_total_cents BETWEEN 0 AND ${PURCHASE_LIMITS.maxTotal * 100}),
          created_at TEXT NOT NULL DEFAULT (app_now()),
          UNIQUE (purchase_id, product_id)
        );
        CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id, id);
        CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);
      `);
      rebuildMovements(database, true);
      if (database.pragma("foreign_key_check").length)
        throw new Error(
          "No se pudieron preparar las compras: hay relaciones inconsistentes en la base de datos.",
        );
      database
        .prepare(
          "INSERT INTO purchase_schema_migrations(version, name) VALUES (1, ?)",
        )
        .run("manual_purchases_with_stock_cost_and_kardex");
    })
    .immediate();
}

/** A rollback is safe only before purchases have been recorded. */
export function rollbackPurchasesMigration(database: Database.Database): void {
  database
    .transaction(() => {
      if (
        !database
          .prepare("SELECT 1 FROM purchase_schema_migrations WHERE version = 1")
          .get()
      )
        return;
      if (
        database.prepare("SELECT 1 FROM purchases LIMIT 1").get() ||
        database
          .prepare(
            "SELECT 1 FROM product_movements WHERE kind = 'PURCHASE' OR purchase_id IS NOT NULL LIMIT 1",
          )
          .get()
      )
        throw new Error(
          "No se puede revertir esta migración después de registrar compras; se perdería su historial.",
        );
      rebuildMovements(database, false);
      database.exec(`DROP TABLE purchase_items; DROP TABLE purchases;
        DELETE FROM purchase_schema_migrations WHERE version = 1;`);
      if (database.pragma("foreign_key_check").length)
        throw new Error("No se pudo revertir la estructura de compras.");
    })
    .immediate();
}
