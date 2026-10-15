import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { OperationActor } from "../../shared/auth";
import type {
  CreateProductInput,
  Product,
  ProductUnit,
} from "../../shared/ipc";
import { PRODUCT_STOCK_LIMIT } from "../../shared/ipc";
import type {
  ParsedProductImport,
  ProductImportIssue,
  ProductImportResult,
  ProductImportRow,
  ProductImportSkippedRow,
} from "../../shared/product-import";
import {
  normalizeProductImportCategories,
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_LIMITS,
} from "../../shared/product-import";
import { getDb } from "./database";

const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const REQUEST_UUID =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const FILE_HASH = /^[\da-f]{64}$/;
const UNITS: readonly ProductUnit[] = ["PIEZA", "KG", "PAQ"];
const FIELD_LABELS = new Map<string, string>(
  PRODUCT_IMPORT_COLUMNS.map(({ key, header }) => [
    key,
    header.replace(/\s*\*$/, ""),
  ]),
);
const BATCH_COLUMNS = `id, request_id AS requestId, file_hash AS fileHash,
  performed_by_user_id AS actorId, file_name AS fileName,
  imported_count AS importedCount, skipped_count AS skippedCount, created_at AS createdAt`;
const JOIN_BATCH_COLUMNS = `b.id, b.request_id AS requestId, b.file_hash AS fileHash,
  b.performed_by_user_id AS actorId, b.file_name AS fileName,
  b.imported_count AS importedCount, b.skipped_count AS skippedCount, b.created_at AS createdAt`;
const PRODUCT_COLUMNS = `p.id, p.sku, p.provider_code AS providerCode,
  p.name, p.unit, p.purchase_price AS purchasePrice,
  p.wholesale_price AS wholesalePrice, p.sale_price AS salePrice,
  p.category, p.brand, p.stock, p.image_url AS imageUrl,
  p.notes, p.created_at AS createdAt, p.updated_at AS updatedAt`;

type BatchRow = {
  id: string;
  requestId: string;
  fileHash: string;
  actorId: string;
  fileName: string;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
};

export interface ProductImportInspection {
  rows: ProductImportRow[];
  skippedRows: ProductImportSkippedRow[];
  issues: ProductImportIssue[];
  issueCount: number;
  alreadyImported?: { importedCount: number; createdAt: string };
}

class ProductImportFailure extends Error {
  constructor(
    code: "PRODUCT_IMPORT_REJECTED" | "PRODUCT_IMPORT_UNRESOLVED",
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

class ProductImportValidationError extends Error {}

function logDatabaseFailure(error: unknown): void {
  // Log an engine code without workbook cells, paths or other user data.
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  console.error("[product-import] database operation failed", code);
}

function normalizeActorId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value))
    throw new ProductImportFailure(
      "PRODUCT_IMPORT_UNRESOLVED",
      "No se pudo identificar al usuario de la importación.",
    );
  return value.toLowerCase();
}

function normalizeRequestId(value: unknown): string {
  if (typeof value !== "string" || !REQUEST_UUID.test(value))
    throw new ProductImportFailure(
      "PRODUCT_IMPORT_UNRESOLVED",
      "El identificador de la importación no es válido.",
    );
  return value.toLowerCase();
}

function normalizeFileHash(value: unknown): string {
  if (typeof value !== "string" || !FILE_HASH.test(value))
    throw new ProductImportFailure(
      "PRODUCT_IMPORT_UNRESOLVED",
      "No se pudo identificar el archivo seleccionado.",
    );
  return value;
}

function readBatchByRequest(
  database: Database.Database,
  requestId: string,
): BatchRow | undefined {
  return database
    .prepare(
      `SELECT ${JOIN_BATCH_COLUMNS}
    FROM product_import_requests r JOIN product_import_batches b ON b.id = r.batch_id
    WHERE r.request_id = ?`,
    )
    .get(requestId) as BatchRow | undefined;
}

function readBatchByFile(
  database: Database.Database,
  fileHash: string,
  actorId: string,
): BatchRow | undefined {
  return database
    .prepare(
      `SELECT ${BATCH_COLUMNS} FROM product_import_batches WHERE performed_by_user_id = ? AND file_hash = ?`,
    )
    .get(actorId, fileHash) as BatchRow | undefined;
}

function readResult(
  database: Database.Database,
  batch: BatchRow,
  alreadyImported: boolean,
): ProductImportResult {
  // A single indexed JOIN recovers current products, even when the batch contains 5,000 rows.
  // Deleted products remain in the audit ledger with a null product_id and are not resurrected.
  const products = database
    .prepare(
      `SELECT ${PRODUCT_COLUMNS}
    FROM product_import_items i JOIN products p ON p.id = i.product_id
    WHERE i.batch_id = ? ORDER BY i.id`,
    )
    .all(batch.id) as Product[];
  return {
    batchId: batch.id,
    importedCount: batch.importedCount,
    skippedCount: batch.skippedCount,
    fileName: batch.fileName,
    alreadyImported,
    products,
  };
}

function safeRead<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof ProductImportFailure) throw error;
    logDatabaseFailure(error);
    throw new ProductImportFailure(
      "PRODUCT_IMPORT_UNRESOLVED",
      "No se pudo consultar el estado de la importación. Conserva el intento y vuelve a consultar.",
    );
  }
}

export function getProductImportByRequest(
  requestId: string,
  actorId: string,
): ProductImportResult | null {
  const request = normalizeRequestId(requestId);
  const actor = normalizeActorId(actorId);
  return safeRead(() => {
    const database = getDb();
    return database.transaction(() => {
      const batch = readBatchByRequest(database, request);
      if (!batch) return null;
      if (batch.actorId !== actor)
        throw new ProductImportFailure(
          "PRODUCT_IMPORT_UNRESOLVED",
          "Este intento de importación pertenece a otro usuario.",
        );
      return readResult(database, batch, true);
    })();
  });
}

export function getProductImportByFile(
  fileHash: string,
  actorId: string,
): ProductImportResult | null {
  const hash = normalizeFileHash(fileHash);
  const actor = normalizeActorId(actorId);
  return safeRead(() => {
    const database = getDb();
    return database.transaction(() => {
      const batch = readBatchByFile(database, hash, actor);
      return batch ? readResult(database, batch, true) : null;
    })();
  });
}

function issueCollector(): {
  issues: ProductImportIssue[];
  count: number;
  add(row: number | null, key: string, message: string): void;
} {
  return {
    issues: [],
    count: 0,
    add(row, key, message) {
      this.count++;
      if (this.issues.length < PRODUCT_IMPORT_LIMITS.maxIssues)
        this.issues.push({
          row,
          column: FIELD_LABELS.get(key) ?? key,
          message,
        });
    },
  };
}

function normalizeRows(
  parsed: ParsedProductImport,
  categories?: string[],
): {
  rows: ProductImportRow[];
  issues: ProductImportIssue[];
  issueCount: number;
} {
  const found = issueCollector();
  const normalized: ProductImportRow[] = [];
  if (
    !parsed ||
    !Array.isArray(parsed.rows) ||
    parsed.rows.length > PRODUCT_IMPORT_LIMITS.maxRows
  ) {
    found.add(
      null,
      "Archivo",
      `El archivo debe contener como máximo ${PRODUCT_IMPORT_LIMITS.maxRows.toLocaleString("es-MX")} productos.`,
    );
    return { rows: normalized, issues: found.issues, issueCount: found.count };
  }
  if (!parsed.rows.length && !parsed.skippedRows?.length)
    found.add(
      null,
      "Archivo",
      "El archivo no contiene productos para importar.",
    );
  const byCategory = categories
    ? new Map(
        categories.map((category) => [
          category.toLocaleLowerCase("es-MX"),
          category,
        ]),
      )
    : null;
  const sourceRows = new Set<number>();
  const skus = new Map<string, number>();
  for (const row of parsed.rows) {
    const rowNumber =
      row &&
      Number.isSafeInteger(row.sourceRow) &&
      row.sourceRow >= 2 &&
      row.sourceRow <= 1_048_576
        ? row.sourceRow
        : null;
    if (rowNumber === null || sourceRows.has(rowNumber)) {
      found.add(
        rowNumber,
        "Fila",
        "La fila de origen no es válida o aparece repetida.",
      );
      continue;
    }
    sourceRows.add(rowNumber);
    if (
      !row.input ||
      typeof row.input !== "object" ||
      Array.isArray(row.input)
    ) {
      found.add(rowNumber, "Fila", "Los datos del producto no son válidos.");
      continue;
    }
    const input = row.input;
    const before = found.count;
    const text = (
      value: unknown,
      key: string,
      limit: number,
      required = false,
      multiline = false,
    ): string => {
      if (value === null || value === undefined) {
        if (required) found.add(rowNumber, key, "Este campo es obligatorio.");
        return "";
      }
      if (typeof value !== "string") {
        found.add(rowNumber, key, "Debe contener texto.");
        return "";
      }
      const trimmed = value.trim();
      const controls = multiline
        ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
        : /[\u0000-\u001f\u007f]/;
      if (controls.test(value))
        found.add(rowNumber, key, "Contiene caracteres no válidos.");
      if (trimmed.length > limit)
        found.add(rowNumber, key, `No debe superar ${limit} caracteres.`);
      if (required && !trimmed)
        found.add(rowNumber, key, "Este campo es obligatorio.");
      return trimmed;
    };
    const money = (value: unknown, key: string): number => {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > PRODUCT_IMPORT_LIMITS.maxPrice ||
        Math.abs(value - Math.round(value * 100) / 100) > 1e-9
      ) {
        found.add(
          rowNumber,
          key,
          "Debe ser un importe de 0 a 1,000,000 con hasta dos decimales.",
        );
        return 0;
      }
      return Math.round(value * 100) / 100;
    };
    const sku = text(input.sku, "sku", PRODUCT_IMPORT_LIMITS.sku, true);
    const providerCode = text(
      input.providerCode,
      "providerCode",
      PRODUCT_IMPORT_LIMITS.providerCode,
    );
    const name = text(input.name, "name", PRODUCT_IMPORT_LIMITS.name, true);
    const brand = text(input.brand, "brand", PRODUCT_IMPORT_LIMITS.brand);
    let category = text(
      input.category,
      "category",
      PRODUCT_IMPORT_LIMITS.category,
      true,
    );
    if (byCategory && category) {
      const canonical = byCategory.get(category.toLocaleLowerCase("es-MX"));
      if (!canonical)
        found.add(
          rowNumber,
          "category",
          "Esta familia / categoría ya no está configurada en Catálogos base. Descarga una plantilla actualizada.",
        );
      else category = canonical;
    }
    const notes = text(
      input.notes,
      "notes",
      PRODUCT_IMPORT_LIMITS.notes,
      false,
      true,
    );
    const imageUrl = text(
      input.imageUrl,
      "imageUrl",
      PRODUCT_IMPORT_LIMITS.imageUrl,
    );
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          !url.hostname ||
          url.username ||
          url.password
        )
          throw new Error();
      } catch {
        found.add(
          rowNumber,
          "imageUrl",
          "Utiliza una URL válida con http o https, sin credenciales.",
        );
      }
    }
    const unit = input.unit;
    if (!UNITS.includes(unit))
      found.add(rowNumber, "unit", "Selecciona PIEZA, KG o PAQ.");
    const precision = unit === "KG" ? 1000 : 1;
    const stock = input.stock;
    if (
      typeof stock !== "number" ||
      !Number.isFinite(stock) ||
      stock < 0 ||
      stock > PRODUCT_STOCK_LIMIT ||
      !Number.isSafeInteger(Math.round(stock * precision)) ||
      (precision === 1 && !Number.isInteger(stock)) ||
      Math.abs(stock - Math.round(stock * precision) / precision) > 1e-9
    )
      found.add(
        rowNumber,
        "stock",
        unit === "KG"
          ? "Captura existencias de 0 a 1,000,000,000 con hasta tres decimales."
          : "Captura existencias enteras de 0 a 1,000,000,000 para piezas o paquetes.",
      );
    const purchasePrice = money(input.purchasePrice, "purchasePrice");
    const salePrice = money(input.salePrice, "salePrice");
    const wholesalePrice = money(input.wholesalePrice, "wholesalePrice");
    if (sku) {
      const first = skus.get(sku);
      if (first !== undefined)
        found.add(
          rowNumber,
          "sku",
          `El SKU está repetido en este archivo; aparece primero en la fila ${first}.`,
        );
      else skus.set(sku, rowNumber);
    }
    if (found.count === before)
      normalized.push({
        sourceRow: rowNumber,
        input: {
          sku,
          providerCode: providerCode || null,
          name,
          brand,
          category,
          notes: notes || null,
          imageUrl,
          unit,
          stock: Math.round(stock * precision) / precision,
          purchasePrice,
          salePrice,
          wholesalePrice,
        },
      });
  }
  return { rows: normalized, issues: found.issues, issueCount: found.count };
}

function existingSkus(
  database: Database.Database,
  skus: string[],
): Set<string> {
  const registered = new Set<string>();
  // Bound parameters in small batches also work on SQLite builds with a low variable limit.
  for (let offset = 0; offset < skus.length; offset += 250) {
    const chunk = skus.slice(offset, offset + 250);
    const existing = database
      .prepare(
        `SELECT sku FROM products WHERE sku IN (${chunk.map(() => "?").join(",")})`,
      )
      .all(...chunk) as { sku: string }[];
    for (const { sku } of existing) registered.add(sku);
  }
  return registered;
}

/** Used while reading the workbook, before validating data that will be omitted. */
export function findExistingProductImportSkus(skus: string[]): Set<string> {
  if (
    !Array.isArray(skus) ||
    skus.length > PRODUCT_IMPORT_LIMITS.maxRows ||
    skus.some(
      (sku) =>
        typeof sku !== "string" || sku.length > PRODUCT_IMPORT_LIMITS.sku,
    )
  )
    throw new Error("Los códigos del archivo no son válidos.");
  return safeRead(() => existingSkus(getDb(), [...new Set(skus)]));
}

function separateRegisteredRows(
  database: Database.Database,
  parsed: ParsedProductImport,
) {
  const skus = parsed.rows
    .map((row) => row?.input?.sku)
    .filter((sku): sku is string => typeof sku === "string");
  const registered = existingSkus(database, [...new Set(skus)]);
  const rows: ProductImportRow[] = [];
  const skippedRows = [...parsed.skippedRows];
  for (const row of parsed.rows) {
    if (registered.has(row?.input?.sku))
      skippedRows.push({ sourceRow: row.sourceRow, sku: row.input.sku });
    else rows.push(row);
  }
  return {
    rows,
    skippedRows: skippedRows.sort((a, b) => a.sourceRow - b.sourceRow),
  };
}

export function inspectProductImport(
  parsed: ParsedProductImport,
  actorId: string,
  categories?: string[],
): ProductImportInspection {
  const hash = normalizeFileHash(parsed?.fileHash);
  const actor = normalizeActorId(actorId);
  return safeRead(() => {
    const database = getDb();
    return database.transaction(() => {
      const batch = readBatchByFile(database, hash, actor);
      if (batch)
        return {
          rows: [],
          skippedRows: parsed.skippedRows,
          issues: [],
          issueCount: 0,
          alreadyImported: {
            importedCount: batch.importedCount,
            createdAt: batch.createdAt,
          },
        };
      const candidates = separateRegisteredRows(database, parsed);
      const normalized = normalizeRows(
        { ...parsed, ...candidates },
        categories,
      );
      return {
        rows: normalized.rows,
        skippedRows: candidates.skippedRows,
        issues: normalized.issues,
        issueCount: normalized.issueCount,
      };
    })();
  });
}

function validateFileMetadata(parsed: ParsedProductImport): string {
  if (
    typeof parsed.fileName !== "string" ||
    !parsed.fileName.trim() ||
    parsed.fileName.trim().length > 255 ||
    /[\u0000-\u001f\u007f]/.test(parsed.fileName)
  )
    throw new ProductImportValidationError(
      "El nombre del archivo no es válido.",
    );
  if (
    !Number.isSafeInteger(parsed.issueCount) ||
    parsed.issueCount < 0 ||
    parsed.issueCount > 0 ||
    !Array.isArray(parsed.issues) ||
    parsed.issues.length
  )
    throw new ProductImportValidationError(
      "El archivo contiene errores pendientes. Corrige las filas indicadas y vuelve a seleccionarlo.",
    );
  if (
    !Number.isSafeInteger(parsed.totalRows) ||
    !Array.isArray(parsed.rows) ||
    !Array.isArray(parsed.skippedRows) ||
    parsed.totalRows !== parsed.rows.length + parsed.skippedRows.length
  )
    throw new ProductImportValidationError(
      "El número de productos del archivo no es válido.",
    );
  const seen = new Set(parsed.rows.map((row) => row.sourceRow));
  for (const row of parsed.skippedRows) {
    if (
      !Number.isSafeInteger(row.sourceRow) ||
      row.sourceRow < 2 ||
      row.sourceRow > PRODUCT_IMPORT_LIMITS.maxRows + 1 ||
      seen.has(row.sourceRow) ||
      typeof row.sku !== "string" ||
      !row.sku.trim() ||
      row.sku.length > PRODUCT_IMPORT_LIMITS.sku
    )
      throw new ProductImportValidationError(
        "Los registros omitidos del archivo no son válidos.",
      );
    seen.add(row.sourceRow);
  }
  return parsed.fileName.trim();
}

export function commitProductImport(
  parsed: ParsedProductImport,
  requestId: string,
  actor: OperationActor,
  categories: string[],
): ProductImportResult {
  const request = normalizeRequestId(requestId);
  const actorId = normalizeActorId(actor?.id);
  const hash = normalizeFileHash(parsed?.fileHash);
  const persistenceState: { value: "unknown" | "new" | "committed" } = {
    value: "unknown",
  };
  try {
    const database = getDb();
    return database
      .transaction(() => {
        const requested = readBatchByRequest(database, request);
        persistenceState.value = requested ? "committed" : "unknown";
        if (requested) {
          if (requested.actorId !== actorId || requested.fileHash !== hash)
            throw new ProductImportFailure(
              "PRODUCT_IMPORT_UNRESOLVED",
              "Este intento ya fue utilizado para otro archivo o usuario. Conserva el registro de la operación original.",
            );
          return readResult(database, requested, true);
        }
        const prior = readBatchByFile(database, hash, actorId);
        persistenceState.value = prior ? "committed" : "new";
        if (prior) {
          // A second window can confirm the same file with a different request UUID.
          // Persist that alias so an IPC retry after restart can recover its outcome.
          database
            .prepare(
              "INSERT INTO product_import_requests(request_id, batch_id) VALUES (?, ?)",
            )
            .run(request, prior.id);
          return readResult(database, prior, true);
        }

        const fileName = validateFileMetadata(parsed);
        if (
          typeof actor.displayName !== "string" ||
          !actor.displayName.trim() ||
          actor.displayName.length > 200 ||
          /[\u0000-\u001f\u007f]/.test(actor.displayName)
        )
          throw new ProductImportValidationError(
            "El nombre del usuario de la importación no es válido.",
          );
        let currentCategories: string[];
        try {
          currentCategories = normalizeProductImportCategories(categories);
        } catch {
          throw new ProductImportValidationError(
            "Las familias / categorías actuales no son válidas. Revisa Catálogos base antes de importar.",
          );
        }
        const candidates = separateRegisteredRows(database, parsed);
        const normalized = normalizeRows(
          { ...parsed, ...candidates },
          currentCategories,
        );
        if (normalized.issueCount) {
          const first = normalized.issues[0];
          throw new ProductImportValidationError(
            first.row === null
              ? first.message
              : `Fila ${first.row}, ${first.column}: ${first.message}`,
          );
        }
        if (!normalized.rows.length)
          throw new ProductImportValidationError(
            "Todos los SKU de este archivo ya están registrados. No hay productos nuevos para agregar; vuelve a revisar el archivo.",
          );
        const batchId = randomUUID();
        database
          .prepare(
            `INSERT INTO product_import_batches
        (id, request_id, file_hash, performed_by_user_id, performed_by_name, file_name, imported_count, skipped_count)
        VALUES (@batchId, @request, @hash, @actorId, @actorName, @fileName, @count, @skippedCount)`,
          )
          .run({
            batchId,
            request,
            hash,
            actorId,
            actorName: actor.displayName.trim(),
            fileName,
            count: normalized.rows.length,
            skippedCount: candidates.skippedRows.length,
          });
        database
          .prepare(
            "INSERT INTO product_import_requests(request_id, batch_id) VALUES (?, ?)",
          )
          .run(request, batchId);
        const insertProduct = database.prepare(`INSERT INTO products
        (sku, provider_code, name, unit, purchase_price, wholesale_price,
         sale_price, category, brand, stock, image_url, notes)
        VALUES (@sku, @providerCode, @name, @unit, @purchasePrice, @wholesalePrice,
         @salePrice, @category, @brand, @stock, @imageUrl, @notes)`);
        const insertItem =
          database.prepare(`INSERT INTO product_import_items(batch_id, product_id, sku, source_row)
        VALUES (@batchId, @productId, @sku, @sourceRow)`);
        for (const { input, sourceRow } of normalized.rows) {
          // Existing product INSERT triggers record each opening stock in Kardex atomically.
          const result = insertProduct.run(
            input as CreateProductInput & { notes: string | null },
          );
          const productId = Number(result.lastInsertRowid);
          if (!Number.isSafeInteger(productId) || productId <= 0)
            throw new Error("No se pudo asignar un identificador al producto.");
          insertItem.run({ batchId, productId, sku: input.sku, sourceRow });
        }
        const batch = readBatchByRequest(database, request);
        if (!batch) throw new Error("No se pudo recuperar el lote importado.");
        const result = readResult(database, batch, false);
        if (result.products.length !== normalized.rows.length)
          throw new Error(
            "No se pudieron recuperar todos los productos del lote.",
          );
        return result;
      })
      .immediate();
  } catch (error) {
    if (persistenceState.value !== "new") {
      if (error instanceof ProductImportFailure) throw error;
      logDatabaseFailure(error);
      throw new ProductImportFailure(
        "PRODUCT_IMPORT_UNRESOLVED",
        "No se pudo confirmar el estado de la importación. Conserva el intento y vuelve a consultar antes de iniciar otro.",
      );
    }
    // The transaction has rolled back. Prove both operation and file are absent before
    // telling the renderer it may discard the pending request and correct the workbook.
    let confirmedAbsent = false;
    try {
      const database = getDb();
      confirmedAbsent =
        !readBatchByRequest(database, request) &&
        !readBatchByFile(database, hash, actorId);
    } catch (lookupError) {
      logDatabaseFailure(lookupError);
    }
    if (!confirmedAbsent) {
      logDatabaseFailure(error);
      throw new ProductImportFailure(
        "PRODUCT_IMPORT_UNRESOLVED",
        "No se pudo confirmar que la importación se haya revertido. Conserva el intento y vuelve a consultar.",
      );
    }
    if (error instanceof ProductImportFailure) throw error;
    if (!(error instanceof ProductImportValidationError))
      logDatabaseFailure(error);
    const message =
      error instanceof ProductImportValidationError
        ? error.message
        : "No se pudo guardar la importación. No se agregó ningún producto; vuelve a intentarlo.";
    throw new ProductImportFailure("PRODUCT_IMPORT_REJECTED", message);
  }
}
