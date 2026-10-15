import type Database from "better-sqlite3";
import { SUPPLIER_LIMITS } from "../../shared/suppliers";

/** Add only the supplier catalog; existing products and operations stay linked as before. */
export function migrateSuppliers(database: Database.Database): void {
  database
    .transaction(() => {
      database.exec(`
      CREATE TABLE IF NOT EXISTS supplier_schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (app_now())
      );
    `);
      const applied = database
        .prepare(
          "SELECT version FROM supplier_schema_migrations WHERE version = ?",
        )
        .get(1);
      if (applied) return;
      // Interpolation is limited to shared numeric constants, never external data.
      database.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND ${SUPPLIER_LIMITS.name}),
        rfc TEXT CHECK (rfc IS NULL OR length(rfc) BETWEEN 1 AND ${SUPPLIER_LIMITS.rfc}),
        phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 1 AND ${SUPPLIER_LIMITS.phone}),
        contact_name TEXT CHECK (contact_name IS NULL OR length(contact_name) BETWEEN 1 AND ${SUPPLIER_LIMITS.contactName}),
        email TEXT CHECK (email IS NULL OR length(email) BETWEEN 1 AND ${SUPPLIER_LIMITS.email}),
        address TEXT CHECK (address IS NULL OR length(address) BETWEEN 1 AND ${SUPPLIER_LIMITS.address}),
        created_at TEXT NOT NULL DEFAULT (app_now()),
        updated_at TEXT NOT NULL DEFAULT (app_now()),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_suppliers_active_name
        ON suppliers (name COLLATE NOCASE, id) WHERE deleted_at IS NULL;
    `);
      database
        .prepare(
          "INSERT INTO supplier_schema_migrations (version, name) VALUES (?, ?)",
        )
        .run(1, "supplier_catalog_with_optional_contact_and_tax_data");
    })
    .immediate();
}
