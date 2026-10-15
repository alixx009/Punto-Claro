import type { ProductUnit } from "../../../../shared/ipc";
import {
  PURCHASE_LIMITS,
  purchaseLineTotalCents,
  type CreatePurchaseInput,
  type PurchaseProduct,
} from "../../../../shared/purchases";

export interface PurchaseDraftLine {
  product: PurchaseProduct;
  quantity: string;
  unitCost: string;
}

export const purchaseUnitLabel: Record<ProductUnit, string> = {
  PIEZA: "pzas.",
  KG: "kg",
  PAQ: "paq.",
};

export function purchaseErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
        .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
        .replace(/^PURCHASE_(?:REJECTED|UNRESOLVED):\s*/, "")
    : "No se pudo completar la operación. Vuelve a intentarlo.";
}

export function isDefinitivePurchaseRejection(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(?:^|Error: )PURCHASE_REJECTED:/.test(error.message)
  );
}

const decimalPatterns = {
  0: /^\d+$/,
  2: /^\d+(?:\.\d{1,2})?$/,
  3: /^\d+(?:\.\d{1,3})?$/,
};

function decimalInput(value: string, decimals: 0 | 2 | 3): number | null {
  const input = value.trim().replace(",", ".");
  if (!decimalPatterns[decimals].test(input)) return null;
  const number = Number(input);
  return Number.isFinite(number) ? number : null;
}

export function evaluatePurchaseLine(line: PurchaseDraftLine) {
  const quantity = decimalInput(
    line.quantity,
    line.product.unit === "KG" ? 3 : 0,
  );
  const unitCost = decimalInput(line.unitCost, 2);
  const quantityError =
    quantity === null || quantity <= 0 || quantity > PURCHASE_LIMITS.maxQuantity
      ? line.product.unit === "KG"
        ? "Usa un peso mayor a 0, hasta 1,000,000 kg y con máximo 3 decimales."
        : "Usa una cantidad entera entre 1 y 1,000,000."
      : "";
  const costError =
    unitCost === null || unitCost < 0 || unitCost > PURCHASE_LIMITS.maxUnitCost
      ? "Usa un costo entre $0.00 y $1,000,000.00, con máximo 2 decimales."
      : "";
  const lineTotalCents =
    quantityError || costError || quantity === null || unitCost === null
      ? null
      : purchaseLineTotalCents(quantity, unitCost, line.product.unit);
  return {
    quantity,
    unitCost,
    quantityError,
    costError,
    lineTotalCents,
    lineTotal: lineTotalCents === null ? null : lineTotalCents / 100,
  };
}

export interface PendingPurchaseAttempt {
  version: 1;
  input: CreatePurchaseInput;
  supplierName: string;
  lines: PurchaseDraftLine[];
}

const storageKey = (userId: string) => `pos.pending-purchase.v1.${userId}`;

function validPendingAttempt(value: unknown): value is PendingPurchaseAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as PendingPurchaseAttempt;
  if (
    attempt.version !== 1 ||
    typeof attempt.supplierName !== "string" ||
    !attempt.input ||
    !Array.isArray(attempt.lines) ||
    !Array.isArray(attempt.input.items) ||
    attempt.lines.length === 0 ||
    attempt.lines.length > PURCHASE_LIMITS.maxItems ||
    attempt.lines.length !== attempt.input.items.length ||
    typeof attempt.input.requestId !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(
      attempt.input.requestId,
    ) ||
    !Number.isSafeInteger(attempt.input.supplierId) ||
    attempt.input.supplierId <= 0
  )
    return false;
  return attempt.lines.every((line, index) => {
    const item = attempt.input.items[index];
    if (
      !line ||
      !line.product ||
      !item ||
      !Number.isSafeInteger(line.product.id) ||
      line.product.id <= 0 ||
      typeof line.product.name !== "string" ||
      typeof line.product.sku !== "string" ||
      !["PIEZA", "KG", "PAQ"].includes(line.product.unit) ||
      typeof line.quantity !== "string" ||
      typeof line.unitCost !== "string"
    )
      return false;
    const evaluated = evaluatePurchaseLine(line);
    return (
      !evaluated.quantityError &&
      !evaluated.costError &&
      item.productId === line.product.id &&
      item.expectedUnit === line.product.unit &&
      item.quantity === evaluated.quantity &&
      item.unitCost === evaluated.unitCost
    );
  });
}

export function readPendingPurchase(
  userId: string,
): PendingPurchaseAttempt | null {
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  if (raw.length > 2_000_000)
    throw new Error(
      "El registro de la compra pendiente no se pudo recuperar. Revisa el historial antes de crear otra compra.",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "El registro de la compra pendiente está incompleto. Revisa el historial antes de crear otra compra.",
    );
  }
  if (!validPendingAttempt(parsed))
    throw new Error(
      "No se pudo recuperar la compra pendiente. Revisa el historial antes de crear otra compra.",
    );
  return parsed;
}

export function persistPendingPurchase(
  userId: string,
  attempt: PendingPurchaseAttempt,
): void {
  const encoded = JSON.stringify(attempt);
  window.localStorage.setItem(storageKey(userId), encoded);
  if (window.localStorage.getItem(storageKey(userId)) !== encoded)
    throw new Error(
      "No se pudo conservar el intento de compra. No se ha enviado; vuelve a intentarlo.",
    );
}

export function clearPendingPurchase(userId: string): void {
  window.localStorage.removeItem(storageKey(userId));
}
