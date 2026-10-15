import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadProducts, subscribe } from "@/data/productStore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/useAuth";
import type { Product } from "../../../../../shared/ipc";
import { DeleteProductDialog } from "./DeleteProductDialog";
import { PAGE_SIZE } from "./model";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductsTable } from "./ProductsTable";
import { ProductsToolbar } from "./ProductsToolbar";
import { StockAdjustDialog } from "./StockAdjustDialog";
import { useProductImport } from "./import/useProductImport";
import { ProductImportDialogs } from "./import/ProductImportDialogs";

interface ProductToast {
  id: number;
  kind: "success" | "error";
  text: string;
}

export function ProductsScreen() {
  const { isAdmin, hasPermission } = useAuth();
  const productImport = useProductImport();
  const canInspectStock = hasPermission("stock.inspect");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formTarget, setFormTarget] = useState<Product | "create" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [stockTargetId, setStockTargetId] = useState<number | null>(null);
  const [toast, setToast] = useState<ProductToast | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((kind: ProductToast["kind"], text: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), kind, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (!canInspectStock) return;
    const unsubscribe = subscribe(setProducts);
    void loadProducts()
      .catch((error) => {
        showToast(
          "error",
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los productos.",
        );
      })
      .finally(() => setLoading(false));
    return () => {
      unsubscribe();
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, [showToast, canInspectStock]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.providerCode?.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term),
    );
  }, [search, products]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const stockProduct =
    products.find((product) => product.id === stockTargetId) ?? null;
  const editingProduct =
    formTarget === "create" || formTarget === null
      ? null
      : (products.find((product) => product.id === formTarget.id) ??
        formTarget);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  if (!canInspectStock) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        No tienes permiso para consultar el inventario.
      </main>
    );
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-canvas lg:overflow-hidden">
      <ProductsToolbar
        search={search}
        onSearchChange={changeSearch}
        onCreate={() => setFormTarget("create")}
        onDownloadTemplate={() => void productImport.downloadTemplate()}
        onImportExcel={() => void productImport.importExcel()}
        onExportExcel={() => void productImport.exportExcel()}
        excelOperation={productImport.operation}
      />

      <ProductsTable
        products={pageItems}
        loading={loading}
        onEdit={setFormTarget}
        onAdjustStock={(product) => setStockTargetId(product.id)}
        onAskDelete={setDeleteTarget}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 sm:px-4">
        <span className="text-sm text-muted-foreground">
          Mostrando{" "}
          {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} a{" "}
          {Math.min(currentPage * PAGE_SIZE, filtered.length)} de{" "}
          {filtered.length} registros
        </span>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          >
            Anterior
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            Pág {currentPage} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() =>
              setPage((previous) => Math.min(pageCount, previous + 1))
            }
          >
            Siguiente
          </Button>
        </div>
      </div>

      {isAdmin && formTarget !== null && (
        <ProductFormDialog
          key={formTarget === "create" ? "create" : formTarget.id}
          product={editingProduct}
          onClose={() => setFormTarget(null)}
          onSaved={(message) => showToast("success", message)}
        />
      )}

      {isAdmin && deleteTarget && (
        <DeleteProductDialog
          key={deleteTarget.id}
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => showToast("success", "Producto eliminado.")}
        />
      )}

      {isAdmin && stockProduct && (
        <StockAdjustDialog
          key={stockProduct.id}
          product={stockProduct}
          onClose={() => setStockTargetId(null)}
          onResult={(message) => showToast("success", message)}
        />
      )}

      {isAdmin && <ProductImportDialogs controller={productImport} />}

      {toast && (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur",
            toast.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-50"
              : "border-red-500/40 bg-red-500/15 text-red-50",
          )}
        >
          {toast.kind === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <span className="text-sm font-medium">{toast.text}</span>
        </div>
      )}
    </main>
  );
}
