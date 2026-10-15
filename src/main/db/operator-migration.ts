import type Database from "better-sqlite3";

// Older transactions keep their ADMIN snapshot and an unknown user ID.
// New operations record both the UUID and the name shown at the time.
export function migrateOperationActors(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS operator_schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  if (
    database
      .prepare("SELECT 1 FROM operator_schema_migrations WHERE version = 1")
      .get()
  )
    return;
  database
    .transaction(() => {
      const definitions = {
        register_sessions: {
          cashier_id: "TEXT REFERENCES auth_users(id) ON DELETE RESTRICT",
          closed_by_user_id:
            "TEXT REFERENCES auth_users(id) ON DELETE RESTRICT",
          closed_by_name: "TEXT",
        },
        register_cash_movements: {
          performed_by_user_id:
            "TEXT REFERENCES auth_users(id) ON DELETE RESTRICT",
          performed_by_name: "TEXT",
        },
        sales: {
          cashier_id: "TEXT REFERENCES auth_users(id) ON DELETE RESTRICT",
          cashier_name: "TEXT",
        },
        payments: {
          performed_by_user_id:
            "TEXT REFERENCES auth_users(id) ON DELETE RESTRICT",
          performed_by_name: "TEXT",
        },
        sale_returns: {
          performed_by_user_id:
            "TEXT REFERENCES auth_users(id) ON DELETE RESTRICT",
          performed_by_name: "TEXT",
        },
      };
      for (const [table, columns] of Object.entries(definitions)) {
        const existing = new Set(
          (
            database.prepare(`PRAGMA table_info(${table})`).all() as {
              name: string;
            }[]
          ).map((column) => column.name),
        );
        for (const [column, definition] of Object.entries(columns)) {
          if (!existing.has(column))
            database.exec(
              `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
            );
        }
      }
      database.exec(`CREATE INDEX IF NOT EXISTS idx_register_sessions_cashier_id ON register_sessions(cashier_id);
      CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON sales(cashier_id);
      CREATE INDEX IF NOT EXISTS idx_cash_movements_actor ON register_cash_movements(performed_by_user_id);`);
      database
        .prepare(
          "INSERT INTO operator_schema_migrations(version, applied_at) VALUES(1, ?)",
        )
        .run(new Date().toISOString());
    })
    .immediate();
}
