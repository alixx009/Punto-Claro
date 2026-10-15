import { createHash } from "node:crypto";
import type { OperationActor } from "../../shared/auth";
import type { Product, ProductUnit } from "../../shared/ipc";
import type {
  CreatePurchaseInput,
  CreatePurchaseResult,
  Purchase,
  PurchaseDetail,
  PurchaseItem,
  PurchaseProduct,
  PurchasesQuery,
  PurchasesResult,
} from "../../shared/purchases";
import { PURCHASE_LIMITS } from "../../shared/purchases";
import { getDb, nowInAppTz } from "./database";
import { recordStockMovement } from "./inventory-ledger";

const UUID_V4 =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const UNITS: ProductUnit[] = ["PIEZA", "KG", "PAQ"];
const MAX_STOCK = 1_000_000_000;
const PRODUCT_COLUMNS = `id, sku, provider_code, name, unit, purchase_price,
  wholesale_price, sale_price, category, brand, stock, image_url, notes, created_at, updated_at`;
const PURCHASE_COLUMNS = `p.id, p.folio, p.supplier_id AS supplierId,
  p.supplier_name AS supplierName, p.source, p.total_cents AS totalCents,
  p.created_at AS createdAt, p.performed_by_name AS performedByName,
  (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS itemCount`;

type ProductRow = {
  id: number;
  sku: string;
  provider_code: string | null;
  name: string;
  unit: ProductUnit;
  purchase_price: number;
  wholesale_price: number;
  sale_price: number;
  category: string;
  brand: string;
  stock: number;
  image_url: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
type PurchaseRow = Omit<Purchase, "total"> & { totalCents: number };
type ItemRow = Omit<PurchaseItem, "unitCost" | "lineTotal"> & {
  unitCostCents: number;
  lineTotalCents: number;
};
type NormalizedItem = {
  productId: number;
  expectedUnit: ProductUnit;
  quantity: number;
  quantityUnits: number;
  costCents: number;
  lineCents: number;
};
type NormalizedInput = {
  requestId: string;
  supplierId: number;
  items: NormalizedItem[];
  totalCents: number;
};

class PurchaseInputError extends Error {}

function validId(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new PurchaseInputError(`Selecciona ${label} válido.`);
  return value;
}

function normalizedSearch(value: unknown): string {
  if (value === undefined) return "";
  if (
    typeof value !== "string" ||
    value.length > PURCHASE_LIMITS.searchLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new PurchaseInputError("El texto de búsqueda no es válido.");
  return value.trim();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function safeRead<T>(message: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof PurchaseInputError) throw error;
    console.error("[purchases]", error);
    throw new Error(message);
  }
}

function mapPurchase(row: PurchaseRow): Purchase {
  const { totalCents, ...purchase } = row;
  return { ...purchase, total: totalCents / 100 };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    providerCode: row.provider_code,
    name: row.name,
    unit: row.unit,
    purchasePrice: row.purchase_price,
    wholesalePrice: row.wholesale_price,
    salePrice: row.sale_price,
    category: row.category,
    brand: row.brand,
    stock: row.stock,
    imageUrl: row.image_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readProducts(ids: number[]): ProductRow[] {
  if (!ids.length) return [];
  return getDb()
    .prepare(
      `SELECT ${PRODUCT_COLUMNS} FROM products
       WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
    )
    .all(...ids) as ProductRow[];
}

function readPurchase(id: number): PurchaseDetail {
  const row = getDb()
    .prepare(`SELECT ${PURCHASE_COLUMNS} FROM purchases p WHERE p.id = ?`)
    .get(id) as PurchaseRow | undefined;
  if (!row) throw new PurchaseInputError("La compra ya no está disponible.");
  const items = getDb()
    .prepare(
      `SELECT id, product_id AS productId, product_name AS productName, sku, unit,
       quantity, unit_cost_cents AS unitCostCents, line_total_cents AS lineTotalCents
       FROM purchase_items WHERE purchase_id = ? ORDER BY id`,
    )
    .all(id) as ItemRow[];
  return {
    ...mapPurchase(row),
    items: items.map(({ unitCostCents, lineTotalCents, ...item }) => ({
      ...item,
      unitCost: unitCostCents / 100,
      lineTotal: lineTotalCents / 100,
    })),
  };
}

export function getPurchase(id: number): PurchaseDetail {
  validId(id, "una compra");
  return safeRead("No se pudo cargar el detalle de la compra.", () =>
    getDb().transaction(() => readPurchase(id))(),
  );
}

export function listPurchases(query: PurchasesQuery = {}): PurchasesResult {
  if (!query || typeof query !== "object" || Array.isArray(query))
    throw new PurchaseInputError("Los filtros de compras no son válidos.");
  const requestedPage = query.page ?? 1;
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1)
    throw new PurchaseInputError("Selecciona una página válida.");
  const search = normalizedSearch(query.search);
  const where = search
    ? "WHERE p.folio LIKE @search ESCAPE '\\' OR p.supplier_name LIKE @search ESCAPE '\\'"
    : "";
  const parameters = search ? { search: `%${escapeLike(search)}%` } : {};
  return safeRead("No se pudo cargar el historial de compras.", () =>
    getDb().transaction(() => {
      const database = getDb();
      const { count } = database
        .prepare(`SELECT COUNT(*) AS count FROM purchases p ${where}`)
        .get(parameters) as { count: number };
      const page = Math.min(
        requestedPage,
        Math.max(1, Math.ceil(count / PURCHASE_LIMITS.pageSize)),
      );
      const rows = database
        .prepare(
          `SELECT ${PURCHASE_COLUMNS} FROM purchases p ${where}
           ORDER BY p.created_at DESC, p.id DESC LIMIT @limit OFFSET @offset`,
        )
        .all({
          ...parameters,
          limit: PURCHASE_LIMITS.pageSize,
          offset: (page - 1) * PURCHASE_LIMITS.pageSize,
        }) as PurchaseRow[];
      const summary = database
        .prepare(
          "SELECT COUNT(*) AS purchaseCount, COALESCE(SUM(total_cents), 0) AS investmentCents FROM purchases",
        )
        .get() as { purchaseCount: number; investmentCents: number };
      const quantitiesByUnit = database
        .prepare(
          "SELECT unit, ROUND(SUM(quantity), 3) AS quantity FROM purchase_items GROUP BY unit ORDER BY unit",
        )
        .all() as { unit: ProductUnit; quantity: number }[];
      return {
        rows: rows.map(mapPurchase),
        total: count,
        page,
        pageSize: PURCHASE_LIMITS.pageSize,
        summary: {
          purchaseCount: summary.purchaseCount,
          totalInvestment: summary.investmentCents / 100,
          quantitiesByUnit,
        },
      };
    })(),
  );
}

export function searchPurchaseProducts(search: string): PurchaseProduct[] {
  const query = normalizedSearch(search);
  if (!query) return [];
  return safeRead(
    "No se pudo buscar en el catálogo de productos.",
    () =>
      getDb()
        .prepare(
          `SELECT id, sku, name, unit, stock, purchase_price AS purchasePrice
         FROM products WHERE sku LIKE @pattern ESCAPE '\\' OR name LIKE @pattern ESCAPE '\\'
         OR provider_code LIKE @pattern ESCAPE '\\'
         ORDER BY CASE WHEN sku = @exact COLLATE NOCASE THEN 0 ELSE 1 END,
           name COLLATE NOCASE, id LIMIT @limit`,
        )
        .all({
          pattern: `%${escapeLike(query)}%`,
          exact: query,
          limit: PURCHASE_LIMITS.pageSize,
        }) as PurchaseProduct[],
  );
}

function normalizeInput(input: unknown): NormalizedInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new PurchaseInputError("Los datos de la compra no son válidos.");
  const values = input as Record<string, unknown>;
  if (typeof values.requestId !== "string" || !UUID_V4.test(values.requestId))
    throw new PurchaseInputError(
      "El identificador de la operación no es válido.",
    );
  const supplierId = validId(values.supplierId, "un proveedor");
  if (
    !Array.isArray(values.items) ||
    !values.items.length ||
    values.items.length > PURCHASE_LIMITS.maxItems
  )
    throw new PurchaseInputError(
      `La compra debe contener entre 1 y ${PURCHASE_LIMITS.maxItems} productos.`,
    );
  const seen = new Set<number>();
  let totalCents = 0;
  const items = values.items.map((item: unknown): NormalizedItem => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new PurchaseInputError("Uno de los conceptos no es válido.");
    const value = item as Record<string, unknown>;
    const productId = validId(value.productId, "un producto");
    if (seen.has(productId))
      throw new PurchaseInputError(
        "Un producto aparece más de una vez en la compra.",
      );
    seen.add(productId);
    if (!UNITS.includes(value.expectedUnit as ProductUnit))
      throw new PurchaseInputError(
        "La unidad de uno de los conceptos no es válida.",
      );
    const expectedUnit = value.expectedUnit as ProductUnit;
    const scale = expectedUnit === "KG" ? 1000 : 1;
    if (
      typeof value.quantity !== "number" ||
      !Number.isFinite(value.quantity) ||
      value.quantity <= 0 ||
      value.quantity > PURCHASE_LIMITS.maxQuantity
    )
      throw new PurchaseInputError(
        `La cantidad debe ser mayor que cero y no superar ${PURCHASE_LIMITS.maxQuantity}.`,
      );
    const quantityUnits = Math.round(value.quantity * scale);
    if (
      !Number.isSafeInteger(quantityUnits) ||
      quantityUnits <= 0 ||
      (scale === 1 && !Number.isInteger(value.quantity)) ||
      Math.abs(value.quantity - quantityUnits / scale) > 1e-9
    )
      throw new PurchaseInputError(
        scale === 1
          ? "Las cantidades por pieza o paquete deben ser enteras."
          : "Las cantidades por kilogramo admiten hasta tres decimales.",
      );
    if (
      typeof value.unitCost !== "number" ||
      !Number.isFinite(value.unitCost) ||
      value.unitCost < 0 ||
      value.unitCost > PURCHASE_LIMITS.maxUnitCost
    )
      throw new PurchaseInputError(
        "El costo unitario debe ser un importe válido mayor o igual que cero.",
      );
    const costCents = Math.round(value.unitCost * 100);
    if (
      !Number.isSafeInteger(costCents) ||
      Math.abs(value.unitCost - costCents / 100) > 1e-9
    )
      throw new PurchaseInputError(
        "El costo unitario admite hasta dos decimales.",
      );
    // Integer arithmetic keeps gram quantities and half-cent rounding exact.
    const divisor = BigInt(scale);
    const lineCents = Number(
      (BigInt(quantityUnits) * BigInt(costCents) + divisor / BigInt(2)) /
        divisor,
    );
    if (
      !Number.isSafeInteger(lineCents) ||
      lineCents > PURCHASE_LIMITS.maxTotal * 100
    )
      throw new PurchaseInputError(
        "El subtotal de uno de los conceptos es demasiado grande.",
      );
    totalCents += lineCents;
    if (
      !Number.isSafeInteger(totalCents) ||
      totalCents > PURCHASE_LIMITS.maxTotal * 100
    )
      throw new PurchaseInputError(
        "El total de la compra supera el importe permitido.",
      );
    return {
      productId,
      expectedUnit,
      quantity: quantityUnits / scale,
      quantityUnits,
      costCents,
      lineCents,
    };
  });
  return {
    requestId: values.requestId.toLowerCase(),
    supplierId,
    items: items.sort((a, b) => a.productId - b.productId),
    totalCents,
  };
}

export function createPurchase(
  input: CreatePurchaseInput,
  actor: OperationActor,
): CreatePurchaseResult {
  const persistenceState: { value: "unknown" | "new" | "committed" } = {
    value: "unknown",
  };
  try {
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.requestId !== "string" ||
      !UUID_V4.test(input.requestId)
    )
      throw new PurchaseInputError(
        "El identificador de la operación no es válido.",
      );
    const requestId = input.requestId.toLowerCase();
    const database = getDb();
    return database
      .transaction(() => {
        const existing = database
          .prepare(
            "SELECT id, request_fingerprint AS fingerprint, performed_by_user_id AS actorId FROM purchases WHERE request_id = ?",
          )
          .get(requestId) as
          { id: number; fingerprint: string; actorId: string } | undefined;
        persistenceState.value = existing ? "committed" : "new";
        const values = normalizeInput(input);
        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify({
              actorId: actor.id,
              supplierId: values.supplierId,
              items: values.items.map(
                ({ productId, expectedUnit, quantityUnits, costCents }) => ({
                  productId,
                  expectedUnit,
                  quantityUnits,
                  costCents,
                }),
              ),
            }),
          )
          .digest("hex");
        if (existing) {
          if (
            existing.actorId !== actor.id ||
            existing.fingerprint !== fingerprint
          )
            throw new PurchaseInputError(
              "Este intento ya fue utilizado para otra compra. Actualiza los datos e inicia otro registro.",
            );
          const purchase = readPurchase(existing.id);
          return {
            purchase,
            updatedProducts: readProducts(
              purchase.items.flatMap((item) =>
                item.productId === null ? [] : [item.productId],
              ),
            ).map(mapProduct),
          };
        }
        const supplier = database
          .prepare(
            "SELECT name FROM suppliers WHERE id = ? AND deleted_at IS NULL",
          )
          .get(values.supplierId) as { name: string } | undefined;
        if (!supplier)
          throw new PurchaseInputError(
            "El proveedor ya no está disponible. Actualiza la lista.",
          );
        const products = readProducts(
          values.items.map((item) => item.productId),
        );
        const byId = new Map(products.map((product) => [product.id, product]));
        const stocks = new Map<number, number>();
        for (const item of values.items) {
          const product = byId.get(item.productId);
          if (!product)
            throw new PurchaseInputError(
              "Uno de los productos ya no existe. Actualiza la compra.",
            );
          if (product.unit !== item.expectedUnit)
            throw new PurchaseInputError(
              `La unidad de "${product.name}" cambió. Elimina el concepto y vuelve a agregarlo.`,
            );
          const scale = product.unit === "KG" ? 1000 : 1;
          const previousUnits = Math.round(product.stock * scale);
          const nextUnits = previousUnits + item.quantityUnits;
          const stock = nextUnits / scale;
          if (
            !Number.isFinite(product.stock) ||
            product.stock < 0 ||
            !Number.isSafeInteger(previousUnits) ||
            !Number.isSafeInteger(nextUnits) ||
            (scale === 1 && !Number.isInteger(product.stock)) ||
            Math.abs(product.stock - previousUnits / scale) > 1e-9 ||
            !Number.isFinite(stock) ||
            stock < 0 ||
            stock > MAX_STOCK ||
            !Number.isSafeInteger(Math.round(stock * 1000))
          )
            throw new PurchaseInputError(
              `La existencia resultante de "${product.name}" no es válida.`,
            );
          stocks.set(product.id, stock);
        }
        const now = nowInAppTz();
        const result = database
          .prepare(
            `INSERT INTO purchases (folio, request_id, request_fingerprint, supplier_id,
             supplier_name, source, total_cents, performed_by_user_id, performed_by_name, created_at)
             VALUES (@temporaryFolio, @requestId, @fingerprint, @supplierId, @supplierName,
             'MANUAL', @totalCents, @actorId, @actorName, @now)`,
          )
          .run({
            temporaryFolio: values.requestId,
            requestId: values.requestId,
            fingerprint,
            supplierId: values.supplierId,
            supplierName: supplier.name,
            totalCents: values.totalCents,
            actorId: actor.id,
            actorName: actor.displayName,
            now,
          });
        const purchaseId = Number(result.lastInsertRowid);
        if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0)
          throw new PurchaseInputError(
            "No se pudo asignar un folio válido a la compra.",
          );
        database
          .prepare("UPDATE purchases SET folio = ? WHERE id = ?")
          .run(`C-${String(purchaseId).padStart(6, "0")}`, purchaseId);
        const insertItem = database.prepare(
          `INSERT INTO purchase_items (purchase_id, product_id, product_name, sku, unit,
           quantity, unit_cost_cents, line_total_cents, created_at)
           VALUES (@purchaseId, @productId, @productName, @sku, @unit, @quantity,
           @costCents, @lineCents, @now)`,
        );
        const updateStock = database.prepare(
          "UPDATE products SET stock = @stock, purchase_price = @cost, updated_at = @now WHERE id = @id",
        );
        for (const item of values.items) {
          const product = byId.get(item.productId)!;
          const stock = stocks.get(item.productId)!;
          insertItem.run({
            purchaseId,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity: item.quantity,
            costCents: item.costCents,
            lineCents: item.lineCents,
            now,
          });
          updateStock.run({
            id: product.id,
            stock,
            cost: item.costCents / 100,
            now,
          });
          recordStockMovement(
            database,
            product.id,
            item.quantity,
            product.stock,
            stock,
            "PURCHASE",
            null,
            purchaseId,
          );
        }
        // Build the response before committing; a read failure rolls everything back.
        return {
          purchase: readPurchase(purchaseId),
          updatedProducts: readProducts(
            products.map((product) => product.id),
          ).map(mapProduct),
        };
      })
      .immediate();
  } catch (error) {
    if (error instanceof PurchaseInputError && persistenceState.value === "new")
      throw new Error(`PURCHASE_REJECTED: ${error.message}`);
    console.error("[purchases:create]", error);
    if (persistenceState.value !== "new")
      throw new Error(
        "PURCHASE_UNRESOLVED: No se pudo confirmar el resultado de la compra. Conserva el mismo intento y vuelve a consultar su registro.",
      );
    throw new Error(
      "PURCHASE_REJECTED: No se pudo registrar la compra. No se aplicó ningún cambio.",
    );
  }
}
