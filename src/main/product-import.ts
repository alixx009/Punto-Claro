import { BrowserWindow, type WebContents } from "electron";
import { randomUUID } from "node:crypto";
import {
  PRODUCT_IMPORT_LIMITS,
  normalizeProductImportCategories,
  type ParsedProductImport,
  type ProductImportCommitInput,
  type ProductImportPreview,
  type ProductImportResult,
  type ProductImportRow,
  type ProductImportTemplateInput,
} from "../shared/product-import";
import { getCurrentAuthSession, requireAdmin } from "./auth";
import {
  commitProductImport,
  findExistingProductImportSkus,
  getProductImportByFile,
  getProductImportByRequest,
  inspectProductImport,
} from "./db/product-import";
import {
  downloadProductTemplate,
  saveProductExport,
  selectProductImport,
} from "./products-excel";
import { listProducts } from "./db/database";
import { assertDataAvailable } from "./backup/state";
import { cacheRemoteImage } from "./files/remote-images";

const PREVIEW_DURATION_MS = 30 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredPreview = {
  senderId: number;
  sessionId: string;
  userId: string;
  expiresAt: number;
  parsed: ParsedProductImport;
};

// Only main owns parsed product data. A renderer can confirm a review, not replace its rows.
const previews = new Map<string, StoredPreview>();
const fileOperations = new Set<number>();
const trackedWindows = new Set<number>();
const confirmations = new Map<string, Promise<ProductImportResult>>();

function captureSession(contents: WebContents) {
  const user = requireAdmin(contents.id);
  const session = getCurrentAuthSession(contents.id);
  const owner = BrowserWindow.fromWebContents(contents);
  if (!session || !owner || owner.isDestroyed() || contents.isDestroyed())
    throw new Error("AUTH_REQUIRED: Inicia sesión para continuar.");

  if (!trackedWindows.has(contents.id)) {
    trackedWindows.add(contents.id);
    contents.once("destroyed", () => {
      discardWindowPreviews(contents.id);
      trackedWindows.delete(contents.id);
      fileOperations.delete(contents.id);
    });
  }

  const assertAllowed = () => {
    assertDataAvailable();
    if (owner.isDestroyed() || contents.isDestroyed())
      throw new Error(
        "AUTH_REQUIRED: La ventana se cerró durante la operación.",
      );
    const current = getCurrentAuthSession(contents.id);
    if (!current || current.id !== session.id || current.user.id !== user.id)
      throw new Error(
        "AUTH_REQUIRED: La sesión cambió. Inicia sesión de nuevo.",
      );
    requireAdmin(contents.id);
  };
  return { owner, user, sessionId: session.id, assertAllowed };
}

function categoriesFrom(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Los datos de la plantilla no son válidos.");
  return normalizeProductImportCategories(
    (input as ProductImportTemplateInput).categories,
  );
}

function discardWindowPreviews(senderId: number): void {
  for (const [token, preview] of previews)
    if (preview.senderId === senderId) previews.delete(token);
}

function purgeExpiredPreviews(): void {
  const now = Date.now();
  for (const [token, preview] of previews)
    if (preview.expiresAt <= now) previews.delete(token);
}

async function withFileOperation<T>(
  senderId: number,
  operation: () => Promise<T>,
): Promise<T> {
  if (fileOperations.has(senderId) || fileOperations.size >= 2)
    throw new Error(
      "Hay un archivo de productos en proceso. Espera a que termine para continuar.",
    );
  fileOperations.add(senderId);
  try {
    return await operation();
  } finally {
    fileOperations.delete(senderId);
  }
}

export async function downloadProductsTemplate(
  contents: WebContents,
  input: ProductImportTemplateInput,
) {
  const { owner, assertAllowed } = captureSession(contents);
  const categories = categoriesFrom(input);
  return withFileOperation(contents.id, () =>
    downloadProductTemplate(owner, categories, assertAllowed),
  );
}

export async function exportProductsExcel(
  contents: WebContents,
  input: ProductImportTemplateInput,
) {
  const { owner, assertAllowed } = captureSession(contents);
  if (!input || typeof input !== "object" || !Array.isArray(input.categories))
    throw new Error("Los datos de la exportación no son válidos.");
  const configured = input.categories.length ? categoriesFrom(input) : [];
  return withFileOperation(contents.id, () => {
    assertAllowed();
    const products = listProducts();
    const categories = [
      ...new Set([...configured, ...products.map((p) => p.category)]),
    ];
    return saveProductExport(owner, products, categories, assertAllowed);
  });
}

export async function previewProductsImport(
  contents: WebContents,
  input: ProductImportTemplateInput,
): Promise<ProductImportPreview | null> {
  const { owner, user, sessionId, assertAllowed } = captureSession(contents);
  const categories = categoriesFrom(input);
  return withFileOperation(contents.id, async () => {
    const parsed = await selectProductImport(
      owner,
      categories,
      assertAllowed,
      (skus) => {
        assertAllowed();
        return findExistingProductImportSkus(skus);
      },
    );
    assertAllowed();
    if (!parsed) return null;
    const inspection = inspectProductImport(parsed, user.id, categories);
    const issues = [...parsed.issues, ...inspection.issues].slice(
      0,
      PRODUCT_IMPORT_LIMITS.maxIssues,
    );
    const issueCount = parsed.issueCount + inspection.issueCount;
    purgeExpiredPreviews();
    discardWindowPreviews(contents.id);
    const token =
      issueCount || inspection.alreadyImported || !inspection.rows.length
        ? null
        : randomUUID();
    if (token)
      previews.set(token, {
        senderId: contents.id,
        userId: user.id,
        sessionId,
        expiresAt: Date.now() + PREVIEW_DURATION_MS,
        parsed: {
          ...parsed,
          rows: inspection.rows,
          skippedRows: inspection.skippedRows,
        },
      });
    return {
      fileName: parsed.fileName,
      rows: inspection.rows,
      skippedRows: inspection.skippedRows,
      totalRows: parsed.totalRows,
      issues,
      issueCount,
      token,
      ...(inspection.alreadyImported
        ? { alreadyImported: inspection.alreadyImported }
        : {}),
    };
  });
}

async function downloadImportImages(
  rows: ProductImportRow[],
  assertAllowed: () => void,
): Promise<void> {
  const images = [
    ...new Map(
      rows
        .filter(({ input }) => input.imageUrl)
        .map((row) => [row.input.imageUrl, row]),
    ).values(),
  ];
  const deadline = Date.now() + 10 * 60 * 1000;
  let next = 0;
  let failure: unknown = null;
  const workers = Array.from(
    { length: Math.min(4, images.length) },
    async () => {
      while (!failure && next < images.length) {
        const row = images[next++];
        try {
          assertAllowed();
          if (Date.now() > deadline)
            throw new Error(
              "La descarga del lote tardó demasiado. Importa menos imágenes por archivo.",
            );
          await cacheRemoteImage(row.input.imageUrl);
          assertAllowed();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "No se pudo descargar la imagen.";
          failure ??= /\bAUTH_/.test(message)
            ? error
            : new Error(
                `Fila ${row.sourceRow}, Imagen (URL): ${message} Corrige el enlace o deja esa celda vacía y vuelve a importar.`,
              );
        }
      }
    },
  );
  await Promise.all(workers);
  if (failure) throw failure;
}

export async function confirmProductsImport(
  contents: WebContents,
  input: ProductImportCommitInput,
): Promise<ProductImportResult> {
  const { user, sessionId, assertAllowed } = captureSession(contents);
  if (
    !input ||
    typeof input !== "object" ||
    typeof input.requestId !== "string" ||
    !UUID_PATTERN.test(input.requestId)
  )
    throw new Error(
      "PRODUCT_IMPORT_REJECTED: La confirmación no es válida. Vuelve a seleccionar el archivo.",
    );

  // Acknowledgement precedes ephemeral token validation: a committed batch survives app restarts.
  let previous: ProductImportResult | null;
  try {
    previous = getProductImportByRequest(input.requestId, user.id);
  } catch {
    throw new Error(
      "PRODUCT_IMPORT_UNRESOLVED: No se pudo comprobar si esta importación ya se guardó. Reintenta la misma confirmación.",
    );
  }
  if (previous) return previous;

  const confirmationKey = `${user.id}:${input.requestId.toLowerCase()}`;
  const inFlight = confirmations.get(confirmationKey);
  if (inFlight) {
    const result = await inFlight;
    assertAllowed();
    return result;
  }

  purgeExpiredPreviews();
  const preview =
    typeof input.token === "string" ? previews.get(input.token) : undefined;
  if (
    !preview ||
    preview.senderId !== contents.id ||
    preview.userId !== user.id ||
    preview.sessionId !== sessionId
  )
    throw new Error(
      "PRODUCT_IMPORT_REJECTED: La revisión expiró. Vuelve a seleccionar el archivo.",
    );
  let categories: string[];
  try {
    categories = categoriesFrom(input);
  } catch (error) {
    throw new Error(
      `PRODUCT_IMPORT_REJECTED: ${error instanceof Error ? error.message : "Revisa las categorías configuradas antes de importar."}`,
    );
  }
  const actor = { id: user.id, displayName: user.displayName };
  const commit = () =>
    commitProductImport(preview.parsed, input.requestId, actor, categories);
  const operation = (async () => {
    assertAllowed();
    const inspection = inspectProductImport(
      preview.parsed,
      user.id,
      categories,
    );
    if (inspection.alreadyImported) return commit();
    if (inspection.issueCount) {
      const first = inspection.issues[0];
      throw new Error(
        `PRODUCT_IMPORT_REJECTED: ${first.row ? `Fila ${first.row}, ` : ""}${first.column}: ${first.message}`,
      );
    }
    try {
      await downloadImportImages(inspection.rows, assertAllowed);
    } catch (error) {
      if (error instanceof Error && /\bAUTH_/.test(error.message)) throw error;
      // Download first; never hold a SQL transaction open while waiting for the network.
      // Another window may have committed this file in the meantime; acknowledge it first.
      try {
        const stored = getProductImportByRequest(input.requestId, user.id);
        if (stored) return stored;
        if (getProductImportByFile(preview.parsed.fileHash, user.id))
          return commit();
      } catch {
        throw new Error(
          "PRODUCT_IMPORT_UNRESOLVED: No se pudo verificar el estado de la importación. Conserva esta confirmación y vuelve a intentarlo.",
        );
      }
      throw new Error(
        `PRODUCT_IMPORT_REJECTED: ${error instanceof Error ? error.message : "No se pudieron descargar las imágenes."} No se agregó ningún producto.`,
      );
    }
    assertAllowed();
    return commit();
  })();
  confirmations.set(confirmationKey, operation);
  try {
    const result = await operation;
    previews.delete(input.token);
    return result;
  } finally {
    confirmations.delete(confirmationKey);
  }
}
