import type Database from "better-sqlite3";

// La serie y el formato se centralizan aquí para incorporar cajeros más adelante.
const SALE_FOLIO_SERIES = "sales-general";
const SALE_FOLIO_PREFIX = "V-";
const SALE_FOLIO_DIGITS = 6;
const MAX_FOLIO_NUMBER = Number.MAX_SAFE_INTEGER;

export function initializeSaleFolios(database: Database.Database): void {
  database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS folio_sequences (
        series TEXT PRIMARY KEY,
        last_value INTEGER NOT NULL CHECK (
          typeof(last_value) = 'integer' AND last_value >= 0 AND last_value <= ${MAX_FOLIO_NUMBER}
        )
      );
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (app_now())
      );
    `);

    // sqlite_sequence conserva el máximo ID incluso si se eliminaron ventas.
    // Solo los folios V-<número> participan: los antiguos con fecha se conservan.
    const { last_value } = database.prepare(`
      SELECT MAX(value) AS last_value FROM (
        SELECT COALESCE(MAX(id), 0) AS value FROM sales
        UNION ALL
        SELECT COALESCE(MAX(seq), 0) FROM sqlite_sequence WHERE name = 'sales'
        UNION ALL
        SELECT COALESCE(MAX(CAST(substr(folio, 3) AS INTEGER)), 0) FROM sales
          WHERE folio GLOB 'V-[0-9]*' AND substr(folio, 3) NOT GLOB '*[^0-9]*'
        UNION ALL
        SELECT COALESCE(MAX(CAST(substr(folio, 3) AS INTEGER)), 0) FROM tickets
          WHERE folio GLOB 'V-[0-9]*' AND substr(folio, 3) NOT GLOB '*[^0-9]*'
      )
    `).get() as { last_value: number };

    if (!Number.isSafeInteger(last_value) || last_value < 0) {
      throw new Error("El consecutivo de ventas existente está fuera del rango permitido.");
    }

    database.prepare(`
      INSERT INTO folio_sequences (series, last_value) VALUES (?, ?)
      ON CONFLICT(series) DO UPDATE SET last_value = MAX(folio_sequences.last_value, excluded.last_value)
    `).run(SALE_FOLIO_SERIES, last_value);

    // Repara copias inconsistentes del folio sin renumerar las ventas históricas.
    database.exec(`
      UPDATE tickets SET folio = (SELECT sales.folio FROM sales WHERE sales.id = tickets.sale_id)
      WHERE EXISTS (SELECT 1 FROM sales WHERE sales.id = tickets.sale_id AND sales.folio <> tickets.folio);
      UPDATE tickets SET payload = json_set(payload, '$.sale.id', sale_id, '$.sale.folio', folio)
      WHERE CASE WHEN json_valid(payload) THEN
        json_type(payload, '$.sale') = 'object' AND (
          json_extract(payload, '$.sale.id') IS NOT sale_id OR
          json_extract(payload, '$.sale.folio') IS NOT folio
        )
        ELSE 0 END;
    `);
    database.prepare("INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)")
      .run("001-general-sale-folios");
  }).immediate();
}

export function reserveSaleFolio(database: Database.Database): string {
  // El incremento debe confirmarse o revertirse junto con la venta.
  if (!database.inTransaction) {
    throw new Error("El folio debe generarse dentro de la transacción de la venta.");
  }

  const increment = database.prepare(`
    UPDATE folio_sequences SET last_value = last_value + 1
    WHERE series = ? AND last_value < ?
    RETURNING last_value
  `);
  const occupied = database.prepare(`
    SELECT 1 FROM sales WHERE folio = ?
    UNION ALL SELECT 1 FROM tickets WHERE folio = ? LIMIT 1
  `);

  for (;;) {
    const row = increment.get(SALE_FOLIO_SERIES, MAX_FOLIO_NUMBER) as { last_value: number } | undefined;
    if (!row || !Number.isSafeInteger(row.last_value) || row.last_value <= 0) {
      throw new Error("No se pudo asignar un folio válido a la venta.");
    }
    const folio = `${SALE_FOLIO_PREFIX}${String(row.last_value).padStart(SALE_FOLIO_DIGITS, "0")}`;
    // También protege frente a folios importados después de iniciar la app.
    if (!occupied.get(folio, folio)) return folio;
  }
}
