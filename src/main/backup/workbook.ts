import { createHash, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3";
import type { Cell, CellValue, Workbook, Worksheet } from "exceljs";
import {
  BACKUP_WORKBOOK_LIMITS,
  guardBackupWorkbookArchive,
} from "./archive-guard";

export { BACKUP_WORKBOOK_LIMITS } from "./archive-guard";

const FORMAT = "SUMA_POS_DATABASE_BACKUP";
const VERSION = 1;
const APPLICATION = "SUMA POS";
const INFO =
  "Las hojas T son de consulta. La restauración utiliza Datos y Configuracion. No edites el respaldo. Los archivos de imágenes no están incluidos.";
const MANIFEST_KEYS = [
  "Formato",
  "Version",
  "Aplicacion",
  "Creado",
  "BytesSQLite",
  "BytesConfiguracion",
  "BloquesSQLite",
  "BloquesConfiguracion",
  "SHA256",
  "Tablas",
  "Informacion",
] as const;

type TableIndex = {
  hoja: string;
  tabla: string;
  filas: number;
  columnas: number;
};

function invalidBackup(): never {
  throw new Error(
    "El respaldo está incompleto, fue modificado o no tiene el formato de SUMA POS. No se reemplazó la base de datos.",
  );
}

function lengthBuffer(length: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(length));
  return buffer;
}

/** Length-delimited payloads avoid ambiguous concatenations in the integrity hash. */
function payloadHash(snapshot: Buffer, settings: Buffer): Buffer {
  return createHash("sha256")
    .update(`${FORMAT}\0${VERSION}\0`)
    .update(lengthBuffer(snapshot.length))
    .update(snapshot)
    .update(lengthBuffer(settings.length))
    .update(settings)
    .digest();
}

function validatePayload(snapshot: Buffer, settingsJson: string): Buffer {
  if (
    snapshot.length < 100 ||
    snapshot.length > BACKUP_WORKBOOK_LIMITS.maxSnapshotBytes ||
    snapshot.subarray(0, 16).toString("ascii") !== "SQLite format 3\0"
  )
    throw new Error(
      "La copia de la base de datos no es válida o supera 64 MB.",
    );
  const settings = Buffer.from(settingsJson, "utf8");
  if (
    !settings.length ||
    settings.length > BACKUP_WORKBOOK_LIMITS.maxSettingsBytes ||
    settings.toString("utf8") !== settingsJson
  )
    throw new Error("La configuración del respaldo no es válida.");
  try {
    const value: unknown = JSON.parse(settingsJson);
    if (!value || typeof value !== "object" || Array.isArray(value))
      invalidBackup();
  } catch {
    throw new Error("La configuración del respaldo no es válida.");
  }
  return settings;
}

function chunks(text: string): string[] {
  const result: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(
      offset + BACKUP_WORKBOOK_LIMITS.chunkCharacters,
      text.length,
    );
    // Keep a UTF-16 surrogate pair together for configuration text.
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    result.push(text.slice(offset, end));
    offset = end;
  }
  return result;
}

function writeChunks(
  workbook: Workbook,
  sheetName: string,
  header: string,
  values: string[],
): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(["Bloque", header]);
  sheet.columns = [{ width: 12 }, { width: 60, style: { numFmt: "@" } }];
  for (let index = 0; index < values.length; index += 1)
    sheet.addRow([index + 1, values[index]]);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function consultationText(text: string): string {
  return text
    .replace(/_x([0-9A-Fa-f]{4})_/g, "_x005F_x$1_")
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
}

function consultationValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  let result: string | number;
  if (Buffer.isBuffer(value)) result = `base64:${value.toString("base64")}`;
  else if (typeof value === "bigint") result = value.toString();
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) result = String(value);
    else return value;
  } else result = String(value);
  // The complete value is retained in the authoritative SQLite snapshot.
  const text = consultationText(result);
  if (text.length > 32_767) return "(contenido largo conservado en Datos)";
  return text;
}

function addConsultationSheets(
  workbook: Workbook,
  snapshot: Buffer,
  initialCells: number,
): TableIndex[] {
  // SQLite cannot deserialize a WAL-mode header into an in-memory database.
  // Normalize only this independent read-only copy, never the hashed payload.
  const readableSnapshot = Buffer.from(snapshot);
  readableSnapshot[18] = 1;
  readableSnapshot[19] = 1;
  const db = new Database(readableSnapshot, { readonly: true });
  try {
    db.pragma("query_only = ON");
    db.pragma("trusted_schema = OFF");
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    if (tables.length > BACKUP_WORKBOOK_LIMITS.maxSheets - 3)
      throw new Error(
        "La base de datos contiene demasiadas tablas para Excel.",
      );
    const index: TableIndex[] = [];
    let cells = initialCells;
    for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
      const tableName = tables[tableIndex].name;
      // Names come only from the exported snapshot's schema, never the workbook.
      const quotedTable = quoteIdentifier(tableName);
      const columns = db.prepare(`PRAGMA table_info(${quotedTable})`).all() as {
        name: string;
      }[];
      if (!columns.length || columns.length > BACKUP_WORKBOOK_LIMITS.maxColumns)
        throw new Error("Una tabla de la base de datos no se puede exportar.");
      const sheetName =
        `T${String(tableIndex + 1).padStart(3, "0")}_${tableName.replace(/[\\/*?:\[\]]/g, "_")}`.slice(
          0,
          31,
        );
      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = columns.map(() => ({
        width: 24,
        style: { numFmt: "@" },
      }));
      sheet.addRow(columns.map((column) => column.name));
      cells += columns.length;
      const selection = columns
        .map((column) => quoteIdentifier(column.name))
        .join(", ");
      const rows = db
        .prepare(`SELECT ${selection} FROM ${quotedTable}`)
        .safeIntegers(true)
        .raw(true)
        .iterate() as Iterable<unknown[]>;
      let rowCount = 0;
      for (const row of rows) {
        rowCount += 1;
        cells += columns.length;
        if (
          rowCount + 1 > BACKUP_WORKBOOK_LIMITS.maxRows ||
          cells > BACKUP_WORKBOOK_LIMITS.maxCells
        )
          throw new Error(
            "La base de datos supera el tamaño de tablas que puede guardar este respaldo Excel.",
          );
        sheet.addRow(row.map(consultationValue));
      }
      index.push({
        hoja: sheetName,
        tabla: tableName,
        filas: rowCount,
        columnas: columns.length,
      });
    }
    return index;
  } finally {
    db.close();
  }
}

/** A complete SQLite snapshot preserves types, relationships, IDs and sequences. */
export async function buildBackupWorkbook(
  snapshot: Buffer,
  settingsJson: string,
): Promise<Buffer> {
  const settings = validatePayload(snapshot, settingsJson);
  const snapshotChunks = chunks(snapshot.toString("base64"));
  // Excel readers decode _xHHHH_ and strip some characters in ordinary text.
  // Base64 keeps the settings JSON byte-for-byte intact as well.
  const settingsChunks = chunks(settings.toString("base64"));
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const createdAt = new Date().toISOString();
  workbook.creator = APPLICATION;
  workbook.created = new Date(createdAt);
  workbook.modified = new Date(createdAt);
  const manifest = workbook.addWorksheet("Respaldo");
  manifest.columns = [
    { width: 25, style: { numFmt: "@" } },
    { width: 80, style: { numFmt: "@" } },
  ];
  writeChunks(workbook, "Datos", "SQLiteBase64", snapshotChunks);
  writeChunks(workbook, "Configuracion", "ConfiguracionBase64", settingsChunks);
  let tables: TableIndex[];
  try {
    tables = addConsultationSheets(
      workbook,
      snapshot,
      (snapshotChunks.length + settingsChunks.length + 2) * 2 +
        MANIFEST_KEYS.length * 2,
    );
  } catch {
    throw new Error(
      "No se pudo preparar el respaldo integral de Excel. La copia de la base de datos no es válida o supera los límites del respaldo.",
    );
  }
  const tableJson = consultationText(JSON.stringify(tables));
  if (tableJson.length > 32_767)
    throw new Error(
      "El índice de tablas supera el tamaño permitido por Excel.",
    );
  const values: (string | number)[] = [
    FORMAT,
    VERSION,
    APPLICATION,
    createdAt,
    snapshot.length,
    settings.length,
    snapshotChunks.length,
    settingsChunks.length,
    payloadHash(snapshot, settings).toString("hex"),
    tableJson,
    INFO,
  ];
  MANIFEST_KEYS.forEach((key, index) => manifest.addRow([key, values[index]]));
  const buffer = Buffer.from(
    await workbook.xlsx.writeBuffer({
      zip: { compression: "DEFLATE", compressionOptions: { level: 6 } },
    }),
  );
  // Ensure an export satisfies the same archive limits as its later import.
  await guardBackupWorkbookArchive(buffer);
  return buffer;
}

function primitive(cell: Cell): string | number {
  const value = cell.value;
  if (
    typeof value !== "string" &&
    !(typeof value === "number" && Number.isFinite(value))
  )
    invalidBackup();
  return value;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    invalidBackup();
  return value;
}

function readChunks(
  sheet: Worksheet | undefined,
  header: string,
  count: number,
  maxCharacters: number,
): string {
  if (
    !sheet ||
    sheet.rowCount !== count + 1 ||
    sheet.columnCount !== 2 ||
    primitive(sheet.getCell(1, 1)) !== "Bloque" ||
    primitive(sheet.getCell(1, 2)) !== header
  )
    invalidBackup();
  const values: string[] = [];
  let totalCharacters = 0;
  for (let index = 0; index < count; index += 1) {
    if (primitive(sheet.getCell(index + 2, 1)) !== index + 1) invalidBackup();
    const value = primitive(sheet.getCell(index + 2, 2));
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > BACKUP_WORKBOOK_LIMITS.chunkCharacters
    )
      invalidBackup();
    totalCharacters += value.length;
    if (totalCharacters > maxCharacters) invalidBackup();
    values.push(value);
  }
  return values.join("");
}

function readTableIndex(value: string | number): TableIndex[] {
  if (typeof value !== "string" || value.length > 32_767) invalidBackup();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    invalidBackup();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length > BACKUP_WORKBOOK_LIMITS.maxSheets - 3
  )
    invalidBackup();
  const sheetNames = new Set<string>();
  return parsed.map((entry: unknown, index: number) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      invalidBackup();
    const record = entry as Record<string, unknown>;
    if (
      Object.keys(record).length !== 4 ||
      typeof record.hoja !== "string" ||
      !record.hoja.startsWith(`T${String(index + 1).padStart(3, "0")}_`) ||
      record.hoja.length > 31 ||
      sheetNames.has(record.hoja) ||
      typeof record.tabla !== "string" ||
      !record.tabla ||
      record.tabla.length > 1000
    )
      invalidBackup();
    sheetNames.add(record.hoja);
    return {
      hoja: record.hoja,
      tabla: record.tabla,
      filas: integer(record.filas, 0, BACKUP_WORKBOOK_LIMITS.maxRows - 1),
      columnas: integer(record.columnas, 1, BACKUP_WORKBOOK_LIMITS.maxColumns),
    };
  });
}

function decodeBase64(text: string, expectedBytes: number): Buffer {
  if (
    text.length !== Math.ceil(expectedBytes / 3) * 4 ||
    text.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(text)
  )
    invalidBackup();
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  if ((text.length / 4) * 3 - padding !== expectedBytes) invalidBackup();
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // Padding bits must also be zero for a canonical encoding. This avoids a
  // second full-size base64 copy while checking a large SQLite payload.
  if (
    (padding === 2 && (alphabet.indexOf(text[text.length - 3]) & 15) !== 0) ||
    (padding === 1 && (alphabet.indexOf(text[text.length - 2]) & 3) !== 0)
  )
    invalidBackup();
  const decoded = Buffer.from(text, "base64");
  if (decoded.length !== expectedBytes) invalidBackup();
  return decoded;
}

/** Parse only the fixed payload sheets; consultation tables never produce SQL. */
export async function parseBackupWorkbook(buffer: Buffer): Promise<{
  snapshot: Buffer;
  settingsJson: string;
  createdAt: string;
}> {
  await guardBackupWorkbookArchive(buffer);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer, {
      ignoreNodes: [
        "dimension",
        "sheetViews",
        "drawing",
        "picture",
        "dataValidations",
        "sheetProtection",
        "tableParts",
        "conditionalFormatting",
        "pageSetup",
        "pageMargins",
        "headerFooter",
        "rowBreaks",
        "autoFilter",
      ],
    });
  } catch {
    invalidBackup();
  }
  const manifest = workbook.getWorksheet("Respaldo");
  if (
    !manifest ||
    manifest.rowCount !== MANIFEST_KEYS.length ||
    manifest.columnCount !== 2
  )
    invalidBackup();
  const values = MANIFEST_KEYS.map((key, index) => {
    if (primitive(manifest.getCell(index + 1, 1)) !== key) invalidBackup();
    return primitive(manifest.getCell(index + 1, 2));
  });
  if (
    values[0] !== FORMAT ||
    values[1] !== VERSION ||
    values[2] !== APPLICATION ||
    values[10] !== INFO
  )
    invalidBackup();
  const createdAt = values[3];
  if (
    typeof createdAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
    !Number.isFinite(Date.parse(createdAt)) ||
    new Date(createdAt).toISOString() !== createdAt
  )
    invalidBackup();
  const snapshotBytes = integer(
    values[4],
    100,
    BACKUP_WORKBOOK_LIMITS.maxSnapshotBytes,
  );
  const settingsBytes = integer(
    values[5],
    1,
    BACKUP_WORKBOOK_LIMITS.maxSettingsBytes,
  );
  const maxBase64Characters = Math.ceil(snapshotBytes / 3) * 4;
  const snapshotChunkCount = integer(
    values[6],
    1,
    Math.ceil(maxBase64Characters / BACKUP_WORKBOOK_LIMITS.chunkCharacters),
  );
  const settingsChunkCount = integer(
    values[7],
    1,
    Math.ceil(
      (Math.ceil(settingsBytes / 3) * 4) /
        BACKUP_WORKBOOK_LIMITS.chunkCharacters,
    ),
  );
  const tables = readTableIndex(values[9]);
  const expectedSheets = [
    "Respaldo",
    "Datos",
    "Configuracion",
    ...tables.map((table) => table.hoja),
  ];
  if (
    workbook.worksheets.length !== expectedSheets.length ||
    expectedSheets.some((name) => !workbook.getWorksheet(name))
  )
    invalidBackup();
  const base64 = readChunks(
    workbook.getWorksheet("Datos"),
    "SQLiteBase64",
    snapshotChunkCount,
    maxBase64Characters,
  );
  const snapshot = decodeBase64(base64, snapshotBytes);
  const settingsBase64 = readChunks(
    workbook.getWorksheet("Configuracion"),
    "ConfiguracionBase64",
    settingsChunkCount,
    Math.ceil(settingsBytes / 3) * 4,
  );
  const settingsBuffer = decodeBase64(settingsBase64, settingsBytes);
  const settingsJson = settingsBuffer.toString("utf8");
  if (!Buffer.from(settingsJson, "utf8").equals(settingsBuffer))
    invalidBackup();
  const settings = validatePayload(snapshot, settingsJson);
  if (settings.length !== settingsBytes) invalidBackup();
  const checksum = values[8];
  if (
    typeof checksum !== "string" ||
    !/^[a-f0-9]{64}$/.test(checksum) ||
    !timingSafeEqual(
      Buffer.from(checksum, "hex"),
      payloadHash(snapshot, settings),
    )
  )
    invalidBackup();
  return { snapshot, settingsJson, createdAt };
}
