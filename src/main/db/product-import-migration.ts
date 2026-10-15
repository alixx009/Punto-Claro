import type Database from "better-sqlite3";
import { PRODUCT_IMPORT_LIMITS } from "../../shared/product-import";

export function migrateProductImports(database: Database.Database): void {
  database
    .transaction(() => {
      database.exec(`CREATE TABLE IF NOT EXISTS product_import_schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (app_now())
    )`);
      if (
        !database
          .prepare(
            "SELECT 1 FROM product_import_schema_migrations WHERE version = 1",
          )
          .get()
      ) {
        // Limits are application constants; file contents are never interpolated into SQL.
        database.exec(`
      CREATE TABLE product_import_batches (
        id TEXT PRIMARY KEY NOT NULL,
        request_id TEXT NOT NULL UNIQUE,
        file_hash TEXT NOT NULL CHECK (length(file_hash) = 64 AND file_hash NOT GLOB '*[^0-9a-f]*'),
        performed_by_user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        performed_by_name TEXT NOT NULL,
        file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
        imported_count INTEGER NOT NULL CHECK (typeof(imported_count) = 'integer' AND imported_count BETWEEN 1 AND ${PRODUCT_IMPORT_LIMITS.maxRows}),
        created_at TEXT NOT NULL DEFAULT (app_now()),
        UNIQUE (performed_by_user_id, file_hash)
      );
      CREATE INDEX idx_product_import_batches_created ON product_import_batches(created_at, id);
      CREATE TABLE product_import_requests (
        request_id TEXT PRIMARY KEY NOT NULL,
        batch_id TEXT NOT NULL REFERENCES product_import_batches(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL DEFAULT (app_now())
      );
      CREATE INDEX idx_product_import_requests_batch ON product_import_requests(batch_id);
      CREATE TABLE product_import_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL REFERENCES product_import_batches(id) ON DELETE RESTRICT,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        sku TEXT NOT NULL CHECK (length(sku) BETWEEN 1 AND ${PRODUCT_IMPORT_LIMITS.sku}),
        source_row INTEGER NOT NULL CHECK (typeof(source_row) = 'integer' AND source_row >= 2),
        UNIQUE (batch_id, sku)
      );
      CREATE INDEX idx_product_import_items_batch ON product_import_items(batch_id, id);
      CREATE INDEX idx_product_import_items_product ON product_import_items(product_id);
    `);
        if (database.pragma("foreign_key_check").length)
          throw new Error(
            "No se pudo preparar la importación: hay relaciones inconsistentes en la base de datos.",
          );
        database
          .prepare(
            "INSERT INTO product_import_schema_migrations(version, name) VALUES (1, ?)",
          )
          .run("atomic_product_imports_with_durable_idempotency");
      }
      if (
        !database
          .prepare(
            "SELECT 1 FROM product_import_schema_migrations WHERE version = 2",
          )
          .get()
      ) {
        database.exec(`ALTER TABLE product_import_batches ADD COLUMN skipped_count INTEGER NOT NULL DEFAULT 0
          CHECK (typeof(skipped_count) = 'integer' AND skipped_count BETWEEN 0 AND ${PRODUCT_IMPORT_LIMITS.maxRows});`);
        database
          .prepare(
            "INSERT INTO product_import_schema_migrations(version, name) VALUES (2, ?)",
          )
          .run("skip_existing_product_skus");
      }
    })
    .immediate();
}

/** Only an unused import ledger can be rolled back without discarding audit data. */
export function rollbackProductImportsMigration(
  database: Database.Database,
): void {
  database
    .transaction(() => {
      if (
        !database
          .prepare(
            "SELECT 1 FROM product_import_schema_migrations WHERE version = 1",
          )
          .get()
      )
        return;
      if (
        database.prepare("SELECT 1 FROM product_import_batches LIMIT 1").get()
      )
        throw new Error(
          "No se puede revertir esta migración después de importar productos; se perdería su historial.",
        );
      database.exec(`DROP TABLE product_import_items;
      DROP TABLE product_import_requests;
      DROP TABLE product_import_batches;
      DELETE FROM product_import_schema_migrations WHERE version IN (1, 2);`);
      if (database.pragma("foreign_key_check").length)
        throw new Error("No se pudo revertir la estructura de importaciones.");
    })
    .immediate();
}
