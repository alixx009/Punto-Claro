import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { getSettings } from "@/config/settings";
import { applyImportedProducts } from "@/data/productStore";
import { getSessionDataEpoch } from "@/data/sessionEpoch";
import {
  normalizeProductImportCategories,
  PRODUCT_IMPORT_LIMITS,
  type ProductImportPreview,
  type ProductImportResult,
} from "../../../../../../shared/product-import";
import {
  clearPendingImport,
  importErrorMessage,
  isRejectedImport,
  readPendingImport,
  savePendingImport,
  type PendingProductImport,
} from "./importUtils";

export type ProductExcelOperation =
  "download" | "export" | "preview" | "commit" | null;

export function useProductImport() {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? "";
  const [recovery] = useState(() => {
    try {
      return { pending: readPendingImport(userId), error: "" };
    } catch (error) {
      return { pending: null, error: importErrorMessage(error) };
    }
  });
  const [pending, setPending] = useState<PendingProductImport | null>(
    recovery.pending,
  );
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [open, setOpen] = useState(Boolean(recovery.pending));
  const [operation, setOperation] = useState<ProductExcelOperation>(null);
  const [error, setError] = useState("");
  const [requiresNewPreview, setRequiresNewPreview] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    kind: "error" | "template" | "export";
  } | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState("");
  const mounted = useRef(false);
  const epoch = useRef(getSessionDataEpoch());
  const busy = useRef(false);
  const pendingRef = useRef(recovery.pending);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const isCurrent = useCallback(
    () => mounted.current && epoch.current === getSessionDataEpoch(),
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function rememberFocus() {
    if (document.activeElement instanceof HTMLElement && !open)
      returnFocusTo.current = document.activeElement;
  }

  function restoreFocus() {
    window.requestAnimationFrame(() => {
      if (!isCurrent()) return;
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      const target = returnFocusTo.current?.isConnected
        ? returnFocusTo.current
        : document.getElementById("products-search");
      target?.focus();
    });
  }

  function canStart(): boolean {
    return isAdmin && Boolean(userId) && isCurrent() && !busy.current;
  }

  async function downloadTemplate() {
    if (!canStart()) return;
    rememberFocus();
    busy.current = true;
    setOperation("download");
    setFeedback(null);
    try {
      const categories = normalizeProductImportCategories(
        getSettings().categories,
      );
      const saved = await window.api.productImport.downloadTemplate({
        categories,
      });
      if (!isCurrent() || !saved.saved) return;
      setFeedback({
        title: "Plantilla descargada",
        message: `${saved.fileName ?? "La plantilla de productos"} está lista para llenar. Los encabezados con * son obligatorios. Guarda el archivo como .xlsx para importarlo.`,
        kind: "template",
      });
    } catch (failure) {
      if (isCurrent())
        setFeedback({
          title: "No se pudo descargar la plantilla",
          message: importErrorMessage(failure),
          kind: "error",
        });
    } finally {
      busy.current = false;
      if (isCurrent()) setOperation(null);
    }
  }

  async function exportExcel() {
    if (!canStart()) return;
    rememberFocus();
    busy.current = true;
    setOperation("export");
    setFeedback(null);
    try {
      const saved = await window.api.productImport.exportExcel({
        categories: getSettings().categories,
      });
      if (!isCurrent() || !saved.saved) return;
      const count = saved.exportedCount ?? 0;
      const notices = [
        `${saved.fileName ?? "El Excel"} contiene ${count.toLocaleString("es-MX")} productos con sus precios y existencias. Usa Importar Excel para cargarlo en otra instalación. Las imágenes no se incluyen.`,
        "Antes de importarlo en otra máquina, registra las mismas familias / categorías en Ajustes > Catálogos base. Los SKU que ya existen se omiten; no se reemplazan.",
      ];
      if (saved.missingCostCount)
        notices.push(
          `${saved.missingCostCount.toLocaleString("es-MX")} productos no tienen costo registrado. Completa sus precios de compra vacíos antes de importar.`,
        );
      if (count > PRODUCT_IMPORT_LIMITS.maxRows)
        notices.push(
          `Para importarlo, divide el catálogo en archivos de hasta ${PRODUCT_IMPORT_LIMITS.maxRows.toLocaleString("es-MX")} productos, conservando los encabezados y el nombre de la hoja Productos.`,
        );
      setFeedback({
        title: "Productos exportados",
        message: notices.join(" "),
        kind: "export",
      });
    } catch (failure) {
      if (isCurrent())
        setFeedback({
          title: "No se pudieron exportar los productos",
          message: importErrorMessage(failure),
          kind: "error",
        });
    } finally {
      busy.current = false;
      if (isCurrent()) setOperation(null);
    }
  }

  async function importExcel() {
    if (!canStart()) return;
    rememberFocus();
    if (recovery.error) {
      setFeedback({
        title: "Confirma el registro anterior",
        message: recovery.error,
        kind: "error",
      });
      return;
    }
    if (pendingRef.current) {
      setOpen(true);
      return;
    }
    busy.current = true;
    setOperation("preview");
    setFeedback(null);
    try {
      const categories = normalizeProductImportCategories(
        getSettings().categories,
      );
      const review = await window.api.productImport.preview({ categories });
      if (!isCurrent() || !review) return;
      setPreview(review);
      setError("");
      setRequiresNewPreview(false);
      setOpen(true);
    } catch (failure) {
      if (!isCurrent()) return;
      if (open) setError(importErrorMessage(failure));
      else
        setFeedback({
          title: "No se pudo leer el archivo",
          message: importErrorMessage(failure),
          kind: "error",
        });
    } finally {
      busy.current = false;
      if (isCurrent()) setOperation(null);
    }
  }

  async function confirmImport() {
    if (!canStart()) return;
    if (
      !pendingRef.current &&
      (!preview?.token ||
        preview.issueCount ||
        preview.alreadyImported ||
        requiresNewPreview)
    )
      return;
    busy.current = true;
    setOperation("commit");
    setError("");
    try {
      let attempt = pendingRef.current;
      if (!attempt) {
        attempt = {
          version: 1,
          input: {
            token: preview!.token!,
            requestId: crypto.randomUUID(),
            categories: normalizeProductImportCategories(
              getSettings().categories,
            ),
          },
          fileName: preview!.fileName,
          rowCount: preview!.rows.length,
        };
        try {
          savePendingImport(userId, attempt);
        } catch {
          throw new Error(
            "No se pudo conservar la confirmación para reintentar de forma segura. No se enviaron productos; habilita el almacenamiento local y vuelve a intentarlo.",
          );
        }
        pendingRef.current = attempt;
        setPending(attempt);
      }
      const confirmed = await window.api.productImport.commit({
        ...attempt.input,
        // Existing commits can be acknowledged even if the categories were removed.
        categories: getSettings().categories,
      });
      if (!isCurrent()) return;
      applyImportedProducts(confirmed.products, epoch.current);
      setCleanupWarning("");
      try {
        clearPendingImport(userId);
        pendingRef.current = null;
        setPending(null);
      } catch (failure) {
        setCleanupWarning(importErrorMessage(failure));
      }
      setResult(confirmed);
      setOpen(false);
      setPreview(null);
    } catch (failure) {
      if (!isCurrent()) return;
      if (isRejectedImport(failure)) {
        try {
          clearPendingImport(userId);
          pendingRef.current = null;
          setPending(null);
          setRequiresNewPreview(true);
        } catch {
          // Preserve the same confirmation until its local record can be cleared.
        }
      }
      setError(importErrorMessage(failure));
    } finally {
      busy.current = false;
      if (isCurrent()) setOperation(null);
    }
  }

  return {
    operation,
    preview,
    pending,
    open,
    error,
    requiresNewPreview,
    feedback,
    result,
    cleanupWarning,
    downloadTemplate,
    exportExcel,
    importExcel,
    confirmImport,
    closePreview: () => {
      if (!busy.current) setOpen(false);
    },
    closeFeedback: () => setFeedback(null),
    closeResult: () => {
      setResult(null);
      setCleanupWarning("");
    },
    restoreFocus,
  };
}

export type ProductImportController = ReturnType<typeof useProductImport>;
