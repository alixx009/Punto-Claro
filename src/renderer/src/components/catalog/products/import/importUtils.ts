import {
  PRODUCT_IMPORT_LIMITS,
  normalizeProductImportCategories,
  type ProductImportCommitInput,
} from "../../../../../../shared/product-import";

export interface PendingProductImport {
  version: 1;
  input: ProductImportCommitInput;
  fileName: string;
  rowCount: number;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageKey = (userId: string) =>
  `suma-pos:product-import:pending:v1:${userId}`;

export function importErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
        .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
        .replace(/^PRODUCT_IMPORT_[A-Z_]+:\s*/, "")
    : "No se pudo completar la operación. Vuelve a intentarlo.";
}

export function isRejectedImport(error: unknown): boolean {
  return (
    error instanceof Error && /\bPRODUCT_IMPORT_REJECTED:/.test(error.message)
  );
}

export function readPendingImport(userId: string): PendingProductImport | null {
  if (!userId) return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(userId));
  } catch {
    throw new Error(
      "No se pudo acceder a la confirmación pendiente de productos. Revisa el catálogo y restablece el almacenamiento local antes de volver a importar.",
    );
  }
  if (!raw) return null;
  if (raw.length > 100_000)
    throw new Error(
      "No se pudo recuperar la confirmación pendiente de productos. Revisa el catálogo y restaura la confirmación antes de volver a importar.",
    );
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error(
      "La confirmación pendiente de productos está incompleta. Revisa el catálogo y restaura la confirmación antes de volver a importar.",
    );
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error(
      "No se pudo recuperar la confirmación pendiente de productos. Revisa el catálogo y restaura la confirmación antes de volver a importar.",
    );
  }
  const pending = decoded as Partial<PendingProductImport>;
  if (
    pending.version !== 1 ||
    !pending.input ||
    typeof pending.input.requestId !== "string" ||
    !uuidPattern.test(pending.input.requestId) ||
    typeof pending.input.token !== "string" ||
    !uuidPattern.test(pending.input.token) ||
    typeof pending.fileName !== "string" ||
    !pending.fileName.trim() ||
    pending.fileName.length > 255 ||
    !Number.isSafeInteger(pending.rowCount) ||
    (pending.rowCount ?? 0) < 1 ||
    (pending.rowCount ?? 0) > PRODUCT_IMPORT_LIMITS.maxRows
  ) {
    throw new Error(
      "La confirmación pendiente de productos no se pudo recuperar. Revisa el catálogo y restaura la confirmación antes de volver a importar el archivo.",
    );
  }
  return {
    version: 1,
    input: {
      requestId: pending.input.requestId,
      token: pending.input.token,
      categories: normalizeProductImportCategories(pending.input.categories),
    },
    fileName: pending.fileName,
    rowCount: pending.rowCount!,
  };
}

export function savePendingImport(
  userId: string,
  pending: PendingProductImport,
): void {
  const encoded = JSON.stringify(pending);
  window.localStorage.setItem(storageKey(userId), encoded);
  if (window.localStorage.getItem(storageKey(userId)) !== encoded) {
    throw new Error(
      "No se pudo conservar la confirmación de la importación. Habilita el almacenamiento local y vuelve a intentarlo.",
    );
  }
}

export function clearPendingImport(userId: string): void {
  window.localStorage.removeItem(storageKey(userId));
  if (window.localStorage.getItem(storageKey(userId)) !== null) {
    throw new Error(
      "Los productos se registraron, pero no se pudo limpiar la confirmación pendiente. Al volver a importar, verifica el registro para actualizar este aviso.",
    );
  }
}
