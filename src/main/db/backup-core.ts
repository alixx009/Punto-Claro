import Database from "better-sqlite3";
import { getDb } from "./database";

export const MAX_DATABASE_SNAPSHOT_BYTES = 64 * 1024 * 1024;

export interface DatabaseSnapshotSummary {
  tables: { name: string; rows: number }[];
  totalRows: number;
}

type SchemaObject = {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
};
type SqlValue = string | number | bigint | Buffer | null;
type ColumnInfo = {
  name: string;
  type: string;
  hidden: number | bigint;
  notnull: number | bigint;
  pk: number | bigint;
  dflt_value: string | null;
};
type ForeignKeyInfo = {
  id: number | bigint;
  seq: number | bigint;
  table: string;
  from: string;
  to: string | null;
  on_update: string;
  on_delete: string;
  match: string;
};
type IndexInfo = {
  name: string;
  unique: number | bigint;
  partial: number | bigint;
};
type IndexColumnInfo = {
  cid: number | bigint;
  coll: string | null;
  key: number | bigint;
};

const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "ascii");
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
// This one-row marker prevents a one-time rounding migration from running twice.
// It belongs to the installation schema, not the business backup payload.
const LOCAL_MIGRATION_TABLES = new Set(["_migration_round_quantities"]);
const TIMESTAMP_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "opened_at",
  "applied_at",
]);
const PAYMENT_METHODS = new Set([
  "CASH",
  "DEBIT",
  "CREDIT",
  "CARD",
  "TRANSFER",
  "VOUCHER",
  "OTHER",
]);
const PRODUCT_UNITS = new Set(["PIEZA", "KG", "PAQ"]);
const SALE_STATUSES = new Set(["PAID", "PARTIAL", "PENDING"]);

function invalid(message: string): never {
  throw new Error(`El respaldo no es válido: ${message}`);
}

// Identifiers originate exclusively from the schema of the running application.
function identifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function schemaObjects(database: Database.Database): SchemaObject[] {
  return database
    .prepare(
      `
    SELECT type, name, tbl_name, sql FROM sqlite_master
    WHERE name NOT GLOB 'sqlite_*' OR name = 'sqlite_sequence'
    ORDER BY type, name
  `,
    )
    .all() as SchemaObject[];
}

function tableObjects(schema: SchemaObject[]): SchemaObject[] {
  return schema.filter(
    (object) =>
      object.type === "table" && !LOCAL_MIGRATION_TABLES.has(object.name),
  );
}

/** Tokenize SQL without changing the contents of string literals. */
function normalizedSql(sql: string | null): string[] | null {
  if (sql === null) return null;
  const tokens =
    sql.match(
      /\s+|--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[A-Za-z_][A-Za-z0-9_$]*|[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|<>|!=|==|<=|>=|\|\||[\s\S]/g,
    ) ?? [];
  const normalized = tokens.flatMap((token) => {
    if (/^\s+$/.test(token) || token.startsWith("--") || token.startsWith("/*"))
      return [];
    if (token.startsWith("'")) return [`s:${token}`];
    if (token.startsWith('"') || token.startsWith("`")) {
      const quote = token[0];
      return [
        `w:${token
          .slice(1, -1)
          .replaceAll(quote + quote, quote)
          .toLowerCase()}`,
      ];
    }
    if (token.startsWith("[")) return [`w:${token.slice(1, -1).toLowerCase()}`];
    if (/^[A-Za-z_]/.test(token)) return [`w:${token.toLowerCase()}`];
    if (/^[0-9]/.test(token)) return [`n:${token}`];
    return [token];
  });
  while (normalized.at(-1) === ";") normalized.pop();
  return normalized;
}

function unwrapExpression(tokens: string[]): string[] {
  let result = tokens;
  while (result[0] === "(" && result.at(-1) === ")") {
    let depth = 0;
    let wrapped = true;
    for (let index = 0; index < result.length - 1; index += 1) {
      if (result[index] === "(") depth += 1;
      if (result[index] === ")") depth -= 1;
      if (depth === 0) {
        wrapped = false;
        break;
      }
    }
    if (!wrapped) break;
    result = result.slice(1, -1);
  }
  return result;
}

function timestampDefault(tokens: string[] | null): string[] | null {
  if (!tokens) return null;
  const expression = JSON.stringify(unwrapExpression(tokens));
  if (
    [
      ["w:app_now", "(", ")"],
      ["w:datetime", "(", "s:'now'", ")"],
      ["w:datetime", "(", "s:'now'", ",", "s:'localtime'", ")"],
      ["w:current_timestamp"],
    ].some((known) => JSON.stringify(known) === expression)
  ) {
    // Restores supply every saved value explicitly. These historical defaults
    // only affect future inserts, which use the destination's trusted schema.
    return ["default:current-timestamp"];
  }
  return tokens;
}

function normalizedColumnDefinition(tokens: string[]): string[] {
  const name = tokens[0]?.replace(/^w:/, "");
  if (!name || !TIMESTAMP_COLUMNS.has(name)) return tokens;
  const start = tokens.indexOf("w:default") + 1;
  if (start === 0 || start >= tokens.length) return tokens;
  let end = start + 1;
  if (tokens[start] === "(") {
    let depth = 1;
    while (end < tokens.length && depth > 0) {
      if (tokens[end] === "(") depth += 1;
      if (tokens[end] === ")") depth -= 1;
      end += 1;
    }
    if (depth !== 0) return tokens;
  }
  const canonical = timestampDefault(tokens.slice(start, end));
  return [
    ...tokens.slice(0, start),
    ...(canonical ?? []),
    ...tokens.slice(end),
  ];
}

function normalizedTableDefinition(sql: string | null): unknown {
  const tokens = normalizedSql(sql);
  if (!tokens) return null;
  const opening = tokens.indexOf("(");
  if (opening < 0) return tokens;
  let depth = 1;
  let segment: string[] = [];
  const segments: string[][] = [];
  for (let index = opening + 1; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === "(") depth += 1;
    if (token === ")") depth -= 1;
    if (depth === 0) {
      if (segment.length) segments.push(segment);
      return {
        prefix: tokens.slice(0, opening),
        // ALTER TABLE can append otherwise identical columns in a different order.
        // Retain each complete definition, including every CHECK/default/reference.
        definitions: segments
          .map((part) => JSON.stringify(normalizedColumnDefinition(part)))
          .sort(),
        suffix: tokens.slice(index + 1),
      };
    }
    if (depth === 1 && token === ",") {
      segments.push(segment);
      segment = [];
    } else {
      segment.push(token);
    }
  }
  // Fall back to the complete token sequence if a definition cannot be parsed.
  return tokens;
}

function tableSignature(
  database: Database.Database,
  table: SchemaObject,
): unknown {
  const columns = (
    database
      .prepare(`PRAGMA table_xinfo(${identifier(table.name)})`)
      .all() as ColumnInfo[]
  )
    .map((column) => ({
      name: column.name,
      type: column.type.trim().replace(/\s+/g, " ").toUpperCase(),
      notNull: Number(column.notnull),
      primaryKey: Number(column.pk),
      hidden: Number(column.hidden),
      defaultValue: TIMESTAMP_COLUMNS.has(column.name.toLowerCase())
        ? timestampDefault(normalizedSql(column.dflt_value))
        : normalizedSql(column.dflt_value),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const foreignRows = database
    .prepare(`PRAGMA foreign_key_list(${identifier(table.name)})`)
    .all() as ForeignKeyInfo[];
  const foreignGroups = new Map<number, ForeignKeyInfo[]>();
  for (const row of foreignRows) {
    const id = Number(row.id);
    const group = foreignGroups.get(id) ?? [];
    group.push(row);
    foreignGroups.set(id, group);
  }
  const foreignKeys = [...foreignGroups.values()]
    .map((group) =>
      JSON.stringify(
        group
          .sort((left, right) => Number(left.seq) - Number(right.seq))
          .map((row) => ({
            table: row.table,
            from: row.from,
            to: row.to,
            onUpdate: row.on_update,
            onDelete: row.on_delete,
            match: row.match,
          })),
      ),
    )
    .sort();
  return {
    columns,
    foreignKeys,
    definition: normalizedTableDefinition(table.sql),
  };
}

function assertMatchingSchema(
  staging: Database.Database,
  trustedSchema: SchemaObject[],
): void {
  const stagingSchema = schemaObjects(staging);
  const trustedTables = tableObjects(trustedSchema).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
  const stagingTables = tableObjects(stagingSchema).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );

  if (
    JSON.stringify(trustedTables.map(({ name }) => name)) !==
    JSON.stringify(stagingTables.map(({ name }) => name))
  ) {
    invalid(
      "el respaldo contiene tablas distintas a las de la aplicación instalada.",
    );
  }

  // Data can be loaded safely when every table retains the same columns,
  // constraints, supported timestamp defaults and foreign keys. SQLite may represent harmless
  // migration histories differently in index and trigger definitions, so
  // validate the data-bearing table structure separately.
  for (let index = 0; index < trustedTables.length; index += 1) {
    const trusted = trustedTables[index];
    const candidate = stagingTables[index];
    if (
      JSON.stringify(tableSignature(staging, candidate)) !==
      JSON.stringify(tableSignature(getDb(), trusted))
    ) {
      invalid(
        `la tabla ${trusted.name} tiene columnas o restricciones distintas a las de la aplicación instalada.`,
      );
    }
  }

  // Named unique indexes affect which rows can be imported and must match.
  // Non-unique indexes only affect query speed; the destination keeps its own.
  const uniqueIndexes = (schema: SchemaObject[]) =>
    schema
      .filter(
        (entry) =>
          entry.type === "index" &&
          entry.sql !== null &&
          /^\s*CREATE\s+UNIQUE\s+INDEX\b/i.test(entry.sql),
      )
      .map((entry) => ({
        name: entry.name,
        table: entry.tbl_name,
        definition: normalizedSql(entry.sql),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  if (
    JSON.stringify(uniqueIndexes(stagingSchema)) !==
    JSON.stringify(uniqueIndexes(trustedSchema))
  ) {
    invalid(
      "los índices únicos del respaldo no corresponden a la aplicación instalada.",
    );
  }

  // Views are not needed to restore rows; reject them if the app schema differs
  // so the workbook cannot introduce executable SQL into the staging database.
  const views = (schema: SchemaObject[]) =>
    schema
      .filter((entry) => entry.type === "view")
      .map((entry) => ({
        name: entry.name,
        table: entry.tbl_name,
        definition: normalizedSql(entry.sql),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  if (
    JSON.stringify(views(stagingSchema)) !==
    JSON.stringify(views(trustedSchema))
  )
    invalid(
      "las vistas del respaldo no corresponden a la aplicación instalada.",
    );

  // integrity_check reads every index. Permit migration-only ordinary indexes
  // only when they are plain columns with built-in collations, never expressions.
  for (const table of stagingTables) {
    const indexes = staging
      .prepare(`PRAGMA index_list(${identifier(table.name)})`)
      .all() as IndexInfo[];
    for (const index of indexes) {
      if (Number(index.unique)) continue;
      if (Number(index.partial)) {
        const candidate = stagingSchema.find(
          (entry) => entry.type === "index" && entry.name === index.name,
        );
        const trusted = trustedSchema.find(
          (entry) => entry.type === "index" && entry.name === index.name,
        );
        if (
          !candidate ||
          !trusted ||
          candidate.tbl_name !== trusted.tbl_name ||
          JSON.stringify(normalizedSql(candidate.sql)) !==
            JSON.stringify(normalizedSql(trusted.sql))
        ) {
          invalid("contiene índices parciales no compatibles.");
        }
        continue;
      }
      const columns = staging
        .prepare(`PRAGMA index_xinfo(${identifier(index.name)})`)
        .all() as IndexColumnInfo[];
      if (
        columns.some(
          (column) =>
            Number(column.key) === 1 &&
            (Number(column.cid) < 0 ||
              !["BINARY", "NOCASE", "RTRIM"].includes(
                (column.coll ?? "").toUpperCase(),
              )),
        )
      ) {
        invalid("contiene índices con expresiones no compatibles.");
      }
    }
  }
}

function assertDatabaseIntegrity(database: Database.Database): void {
  const results = database
    .prepare("PRAGMA integrity_check")
    .raw()
    .all() as SqlValue[][];
  if (results.length !== 1 || results[0]?.[0] !== "ok") {
    invalid("SQLite detectó datos dañados o restricciones inconsistentes.");
  }
  if (database.prepare("PRAGMA foreign_key_check").get()) {
    invalid("hay registros que hacen referencia a datos inexistentes.");
  }
}

function assertNoRow(
  database: Database.Database,
  sql: string,
  message: string,
): void {
  if (database.prepare(sql).get()) invalid(message);
}

function readCount(database: Database.Database, table: string): number {
  const row = database
    .prepare(`SELECT COUNT(*) FROM ${identifier(table)}`)
    .raw()
    .safeIntegers(true)
    .get() as [bigint];
  if (row[0] > MAX_SAFE_INTEGER) invalid("contiene demasiados registros.");
  return Number(row[0]);
}

function assertAuthIntegrity(database: Database.Database): void {
  const installation = database
    .prepare("SELECT setup_completed_at FROM auth_installation WHERE id = 1")
    .get() as { setup_completed_at: string | null } | undefined;
  if (!installation || readCount(database, "auth_installation") !== 1) {
    invalid("falta el estado de configuración de la instalación.");
  }
  const userCount = readCount(database, "auth_users");
  if (userCount === 0) {
    invalid(
      "no contiene un administrador con el que iniciar sesión después de restaurar.",
    );
  }
  if (
    !installation.setup_completed_at ||
    !Number.isFinite(Date.parse(installation.setup_completed_at))
  ) {
    invalid("la configuración inicial de los usuarios no está completada.");
  }
  assertNoRow(
    database,
    `
    SELECT 1 FROM auth_users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN auth_credentials c ON c.user_id = u.id
    LEFT JOIN user_roles r ON r.user_id = u.id
    WHERE p.user_id IS NULL OR c.user_id IS NULL OR r.user_id IS NULL
    LIMIT 1
  `,
    "hay usuarios sin perfil, contraseña o rol.",
  );
  const owners = database
    .prepare(
      `
    SELECT COUNT(*) FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
    WHERE p.is_owner = 1 AND p.is_active = 1 AND r.role_key = 'admin'
  `,
    )
    .raw()
    .safeIntegers(true)
    .get() as [bigint];
  if (owners[0] !== 1n)
    invalid("debe conservar un administrador principal activo.");
  const credentials = database
    .prepare("SELECT password_hash FROM auth_credentials")
    .iterate() as Iterable<{ password_hash: unknown }>;
  for (const { password_hash: passwordHash } of credentials) {
    if (
      typeof passwordHash !== "string" ||
      !/^\$2[aby]\$(?:0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$/.test(passwordHash)
    ) {
      invalid(
        "hay contraseñas guardadas con un formato o coste que no se puede utilizar.",
      );
    }
  }
  for (const key of ["admin", "cashier"]) {
    if (!database.prepare("SELECT 1 FROM roles WHERE key = ?").get(key)) {
      invalid("faltan los roles necesarios para acceder a la aplicación.");
    }
  }
}

function assertBusinessReferences(database: Database.Database): void {
  // These legacy columns have no REFERENCES constraint in this project's schema.
  assertNoRow(
    database,
    `
    SELECT 1 FROM sales s LEFT JOIN register_sessions r ON r.id = s.register_session_id
    WHERE s.register_session_id IS NOT NULL AND r.id IS NULL LIMIT 1
  `,
    "una venta está asociada a una caja inexistente.",
  );
  assertNoRow(
    database,
    `
    SELECT 1 FROM payments p LEFT JOIN sales s ON s.id = p.sale_id
    WHERE p.sale_id IS NOT NULL AND s.id IS NULL LIMIT 1
  `,
    "un pago está asociado a una venta inexistente.",
  );
  assertNoRow(
    database,
    `
    SELECT 1 FROM payments p LEFT JOIN register_sessions r ON r.id = p.register_session_id
    WHERE p.register_session_id IS NOT NULL AND r.id IS NULL LIMIT 1
  `,
    "un pago está asociado a una caja inexistente.",
  );
  const openRegisters = database
    .prepare("SELECT COUNT(*) FROM register_sessions WHERE status = 'OPEN'")
    .raw()
    .safeIntegers(true)
    .get() as [bigint];
  if (openRegisters[0] > 1n) invalid("contiene más de una caja abierta.");
  assertNoRow(
    database,
    `
    SELECT 1 FROM sale_return_items i
    JOIN sale_returns r ON r.id = i.return_id JOIN sale_items s ON s.id = i.sale_item_id
    WHERE r.sale_id <> s.sale_id LIMIT 1
  `,
    "una devolución incluye un artículo que pertenece a otra venta.",
  );
  // product_movements.product_id intentionally permits deleted historical products.
}

function assertStorageTypes(
  database: Database.Database,
  schema: SchemaObject[],
): void {
  // SQLite uses affinity rather than STRICT tables here. A malformed file can
  // otherwise contain text in a money column even while foreign_key_check passes.
  for (const table of tableObjects(schema)) {
    const columns = database
      .prepare(`PRAGMA table_xinfo(${identifier(table.name)})`)
      .all() as ColumnInfo[];
    const invalidValues: string[] = [];
    for (const column of columns) {
      if (Number(column.hidden) !== 0) continue;
      const field = identifier(column.name);
      if (/INT/i.test(column.type)) {
        invalidValues.push(`typeof(${field}) NOT IN ('integer', 'null')`);
      } else if (/REAL|FLOA|DOUB|NUMERIC|DECIMAL/i.test(column.type)) {
        invalidValues.push(
          `typeof(${field}) NOT IN ('integer', 'real', 'null')`,
        );
        invalidValues.push(
          `${field} > 1.7976931348623157e308 OR ${field} < -1.7976931348623157e308`,
        );
      } else if (/CHAR|CLOB|TEXT/i.test(column.type)) {
        invalidValues.push(`typeof(${field}) NOT IN ('text', 'null')`);
      }
    }
    if (invalidValues.length) {
      assertNoRow(
        database,
        `SELECT 1 FROM ${identifier(table.name)} WHERE ${invalidValues.map((condition) => `(${condition})`).join(" OR ")} LIMIT 1`,
        `la tabla ${table.name} contiene datos con tipos incompatibles.`,
      );
    }
  }
}

function assertSequences(
  database: Database.Database,
  schema: SchemaObject[],
): void {
  const sequences = new Map<string, bigint>();
  const autoTables = tableObjects(schema).filter((table) =>
    /\bAUTOINCREMENT\b/i.test(table.sql ?? ""),
  );
  const autoNames = new Set(autoTables.map((table) => table.name));
  const rows = database
    .prepare("SELECT name, seq FROM sqlite_sequence")
    .raw()
    .safeIntegers(true)
    .iterate() as Iterable<[string, unknown]>;
  for (const [name, seq] of rows) {
    if (
      !autoNames.has(name) ||
      sequences.has(name) ||
      typeof seq !== "bigint" ||
      seq < 0n
    ) {
      invalid("los consecutivos internos de la base de datos no son válidos.");
    }
    sequences.set(name, seq);
  }
  for (const table of autoTables) {
    const maximum = database
      .prepare(`SELECT COALESCE(MAX(id), 0) FROM ${identifier(table.name)}`)
      .raw()
      .safeIntegers(true)
      .get() as [bigint];
    if ((sequences.get(table.name) ?? 0n) < maximum[0]) {
      invalid(
        `el consecutivo interno de ${table.name} es menor que sus registros.`,
      );
    }
  }
  const sequence = database
    .prepare(
      "SELECT last_value FROM folio_sequences WHERE series = 'sales-general'",
    )
    .raw()
    .safeIntegers(true)
    .get() as [bigint] | undefined;
  if (
    !sequence ||
    typeof sequence[0] !== "bigint" ||
    sequence[0] < 0n ||
    sequence[0] > MAX_SAFE_INTEGER
  ) {
    invalid("falta el consecutivo general de ventas o está fuera de rango.");
  }
  let maximumFolio = sequences.get("sales") ?? 0n;
  const folios = database
    .prepare("SELECT folio FROM sales UNION ALL SELECT folio FROM tickets")
    .raw()
    .iterate() as Iterable<[string]>;
  for (const [folio] of folios) {
    if (/^V-\d+$/.test(folio)) {
      const value = BigInt(folio.slice(2));
      if (value > maximumFolio) maximumFolio = value;
    }
  }
  if (sequence[0] < maximumFolio) {
    invalid("el consecutivo general es menor que los folios ya utilizados.");
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sameMoney(value: unknown, expected: unknown): boolean {
  return (
    finiteNumber(value) &&
    finiteNumber(expected) &&
    Math.abs(value - expected) < 0.001
  );
}

function validTicketPayload(
  value: unknown,
  saleId: bigint,
  folio: string,
): value is Record<string, unknown> {
  if (
    !object(value) ||
    !object(value.sale) ||
    !Number.isSafeInteger(value.sale.id) ||
    BigInt(value.sale.id as number) !== saleId ||
    value.sale.folio !== folio ||
    typeof value.sale.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.sale.createdAt)) ||
    !SALE_STATUSES.has(value.sale.status as string) ||
    !object(value.store) ||
    ![value.store.name, value.store.address, value.store.phone].every(
      (part) => typeof part === "string",
    ) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.payments) ||
    ![
      value.subtotal,
      value.total,
      value.discount,
      value.creditAmount,
      value.change,
    ].every(finiteNumber) ||
    (value.attendedBy != null && typeof value.attendedBy !== "string")
  )
    return false;
  if (
    value.customer !== null &&
    (!object(value.customer) ||
      typeof value.customer.name !== "string" ||
      typeof value.customer.code !== "string")
  )
    return false;
  if (
    value.items.some(
      (item: unknown) =>
        !object(item) ||
        typeof item.productName !== "string" ||
        !PRODUCT_UNITS.has(item.unit as string) ||
        ![item.quantity, item.unitPrice, item.lineTotal].every(finiteNumber),
    )
  )
    return false;
  if (
    value.payments.some(
      (payment: unknown) =>
        !object(payment) ||
        !PAYMENT_METHODS.has(payment.method as string) ||
        !finiteNumber(payment.amount),
    )
  )
    return false;
  if (
    value.returns !== undefined &&
    (!object(value.returns) ||
      !["NONE", "PARTIAL", "FULL"].includes(value.returns.state as string) ||
      ![
        value.returns.amount,
        value.returns.refunded,
        value.returns.debtReduced,
      ].every(finiteNumber))
  )
    return false;
  return true;
}

function assertTicketPayloads(database: Database.Database): void {
  const tickets = database
    .prepare(
      `
    SELECT t.payload, t.sale_id, t.folio, t.total_amount, s.total
    FROM tickets t JOIN sales s ON s.id = t.sale_id WHERE t.folio = s.folio
  `,
    )
    .raw()
    .safeIntegers(true)
    .iterate() as Iterable<[string, bigint, string, number, number]>;
  assertNoRow(
    database,
    `
    SELECT 1 FROM tickets t JOIN sales s ON s.id = t.sale_id WHERE t.folio <> s.folio LIMIT 1
  `,
    "el folio de un ticket no coincide con su venta.",
  );
  for (const [text, saleId, folio, ticketTotal, saleTotal] of tickets) {
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      invalid("un ticket contiene datos ilegibles.");
    }
    if (
      !validTicketPayload(payload, saleId, folio) ||
      !sameMoney(payload.total, ticketTotal) ||
      !sameMoney(ticketTotal, saleTotal)
    )
      invalid(
        "un ticket no coincide con su venta o contiene datos incompletos.",
      );
  }
  const origins = database
    .prepare(
      `
    SELECT o.ticket_payload, o.sale_id, s.folio, o.total
    FROM sale_return_origins o JOIN sales s ON s.id = o.sale_id
  `,
    )
    .raw()
    .safeIntegers(true)
    .iterate() as Iterable<[string, bigint, string, number]>;
  for (const [text, saleId, folio, originalTotal] of origins) {
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      invalid("una devolución contiene un ticket original ilegible.");
    }
    if (
      !validTicketPayload(payload, saleId, folio) ||
      !sameMoney(payload.total, originalTotal)
    ) {
      invalid(
        "el documento original de una devolución está incompleto o no coincide con la venta.",
      );
    }
  }
}

function validateStaging(
  database: Database.Database,
  trustedSchema: SchemaObject[],
): DatabaseSnapshotSummary {
  assertMatchingSchema(database, trustedSchema);
  assertDatabaseIntegrity(database);
  assertStorageTypes(database, trustedSchema);
  assertAuthIntegrity(database);
  assertBusinessReferences(database);
  assertSequences(database, trustedSchema);
  assertTicketPayloads(database);
  const tables = tableObjects(trustedSchema).map(({ name }) => ({
    name,
    rows: readCount(database, name),
  }));
  return {
    tables,
    totalRows: tables.reduce((sum, table) => sum + table.rows, 0),
  };
}

function openSnapshot(buffer: Buffer): Database.Database {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 100 ||
    buffer.length > MAX_DATABASE_SNAPSHOT_BYTES ||
    !buffer.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)
  ) {
    invalid(
      "no contiene una copia SQLite completa o supera el máximo de 64 MB.",
    );
  }
  let staging: Database.Database;
  try {
    staging = new Database(rollbackModeCopy(buffer), { readonly: true });
  } catch {
    invalid("no se pudo abrir la copia SQLite incluida en el archivo.");
  }
  try {
    staging.pragma("query_only = ON");
    staging.pragma("trusted_schema = OFF");
    staging.pragma("foreign_keys = ON");
    return staging;
  } catch (error) {
    staging.close();
    throw error;
  }
}

function rollbackModeCopy(buffer: Buffer): Buffer {
  const copy = Buffer.from(buffer);
  // sqlite3_deserialize cannot open WAL-format images. SQLite's documented
  // workaround changes the file read/write versions only in the isolated copy:
  // https://www.sqlite.org/c3ref/deserialize.html
  copy[18] = 0x01;
  copy[19] = 0x01;
  return copy;
}

/** SQLite serializes a single consistent view, including changes still held in WAL. */
export function captureDatabaseSnapshot(): Buffer {
  const snapshot = getDb().serialize() as Buffer;
  if (snapshot.length > MAX_DATABASE_SNAPSHOT_BYTES) {
    throw new Error(
      "La base de datos supera el máximo de 64 MB para un respaldo en Excel.",
    );
  }
  return rollbackModeCopy(snapshot);
}

export function validateDatabaseSnapshot(
  buffer: Buffer,
): DatabaseSnapshotSummary {
  const staging = openSnapshot(buffer);
  try {
    return validateStaging(staging, schemaObjects(getDb()));
  } finally {
    staging.close();
  }
}

/** Replace rows atomically in the existing connection; never initialize or seed the DB. */
export function replaceDatabaseFromSnapshot(
  buffer: Buffer,
  settingsJson: string,
): void {
  if (typeof settingsJson !== "string")
    throw new Error("Los ajustes del respaldo no son válidos.");
  const live = getDb();
  if (live.inTransaction)
    throw new Error(
      "La base de datos está realizando otra operación. Inténtalo de nuevo.",
    );
  const trustedSchema = schemaObjects(live);
  const staging = openSnapshot(buffer);
  try {
    validateStaging(staging, trustedSchema);
    const tables = tableObjects(trustedSchema);
    const triggers = trustedSchema.filter((item) => item.type === "trigger");
    const foreignKeysEnabled = Boolean(
      live.pragma("foreign_keys", { simple: true }),
    );
    live.pragma("foreign_keys = OFF");
    try {
      live
        .transaction(() => {
          // Dropping/recreating trusted triggers inside the transaction is reversible.
          // Otherwise owner protection blocks the replacement and Kardex is duplicated.
          for (const trigger of triggers)
            live.exec(`DROP TRIGGER ${identifier(trigger.name)}`);
          for (const table of tables)
            live.exec(`DELETE FROM ${identifier(table.name)}`);
          // Explicit inserts regenerate sqlite_sequence rows; restore its exact saved
          // values only after every AUTOINCREMENT table has finished loading.
          const loadTables = tables.filter(
            (table) => table.name !== "sqlite_sequence",
          );
          loadTables.push(
            ...tables.filter((table) => table.name === "sqlite_sequence"),
          );
          for (const table of loadTables) {
            if (table.name === "sqlite_sequence")
              live.exec("DELETE FROM sqlite_sequence");
            const columns = (
              live
                .prepare(`PRAGMA table_xinfo(${identifier(table.name)})`)
                .all() as ColumnInfo[]
            )
              .filter((column) => Number(column.hidden) === 0)
              .map((column) => column.name);
            if (!columns.length)
              invalid("una tabla del respaldo no tiene columnas utilizables.");
            const fields = columns.map(identifier).join(", ");
            const rows = staging
              .prepare(`SELECT ${fields} FROM ${identifier(table.name)}`)
              .raw()
              .safeIntegers(true)
              .iterate() as Iterable<SqlValue[]>;
            const insert = live.prepare(
              `INSERT INTO ${identifier(table.name)} (${fields}) VALUES (${columns.map(() => "?").join(", ")})`,
            );
            for (const values of rows) insert.run(...values);
          }
          // Login sessions never travel between installations or survive replacement.
          live.exec(
            "DELETE FROM auth_sessions; DELETE FROM auth_login_attempts;",
          );
          live
            .prepare(
              `
          INSERT INTO app_backup_preferences (id, settings_json, restore_pending) VALUES (1, ?, 1)
          ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, restore_pending = 1
        `,
            )
            .run(settingsJson);
          for (const trigger of triggers) {
            if (!trigger.sql)
              invalid("falta la definición de un disparador de la aplicación.");
            live.exec(trigger.sql);
          }
          assertDatabaseIntegrity(live);
          assertStorageTypes(live, trustedSchema);
          assertAuthIntegrity(live);
          assertBusinessReferences(live);
          assertSequences(live, trustedSchema);
          assertTicketPayloads(live);
        })
        .immediate();
    } finally {
      live.pragma(`foreign_keys = ${foreignKeysEnabled ? "ON" : "OFF"}`);
    }
  } finally {
    staging.close();
  }
}
