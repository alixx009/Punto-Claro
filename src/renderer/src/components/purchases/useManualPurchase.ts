import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Supplier } from "../../../../shared/suppliers";
import {
  PURCHASE_LIMITS,
  type CreatePurchaseResult,
  type PurchaseProduct,
} from "../../../../shared/purchases";
import { getSessionDataEpoch } from "@/data/sessionEpoch";
import {
  clearPendingPurchase,
  evaluatePurchaseLine,
  isDefinitivePurchaseRejection,
  persistPendingPurchase,
  purchaseErrorMessage,
  type PendingPurchaseAttempt,
  type PurchaseDraftLine,
} from "./purchaseUtils";

interface ManualPurchaseOptions {
  userId: string;
  recovered: PendingPurchaseAttempt | null;
  onRegistered: (result: CreatePurchaseResult) => void;
  onPendingChange: (pending: boolean) => void;
}

export function useManualPurchase({
  userId,
  recovered,
  onRegistered,
  onPendingChange,
}: ManualPurchaseOptions) {
  const [supplierId, setSupplierId] = useState(
    recovered ? String(recovered.input.supplierId) : "",
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierError, setSupplierError] = useState("");
  const [lines, setLines] = useState<PurchaseDraftLine[]>(
    () => recovered?.lines ?? [],
  );
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<PurchaseProduct[]>([]);
  const [matchedSearch, setMatchedSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(Boolean(recovered));
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const mounted = useRef(false);
  const epoch = useRef(getSessionDataEpoch());
  const searchRequestVersion = useRef(0);
  const suppliersRequestVersion = useRef(0);
  const inFlight = useRef(false);
  const attempt = useRef<PendingPurchaseAttempt | null>(recovered);
  const isCurrent = useCallback(
    () => mounted.current && epoch.current === getSessionDataEpoch(),
    [],
  );
  const locked = saving || uncertain;

  const loadSuppliers = useCallback(async () => {
    const version = ++suppliersRequestVersion.current;
    setSuppliersLoading(true);
    setSupplierError("");
    try {
      const rows = await window.api.suppliers.list();
      if (isCurrent() && version === suppliersRequestVersion.current)
        setSuppliers(rows);
    } catch (reason) {
      if (isCurrent() && version === suppliersRequestVersion.current)
        setSupplierError(purchaseErrorMessage(reason));
    } finally {
      if (isCurrent() && version === suppliersRequestVersion.current)
        setSuppliersLoading(false);
    }
  }, [isCurrent]);

  useEffect(() => {
    mounted.current = true;
    void loadSuppliers();
    return () => {
      mounted.current = false;
      ++searchRequestVersion.current;
      ++suppliersRequestVersion.current;
    };
  }, [loadSuppliers]);

  useEffect(() => {
    const version = ++searchRequestVersion.current;
    setMatches([]);
    setMatchedSearch("");
    setSearchError("");
    if (!search.trim() || locked) {
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void window.api.purchases
        .searchProducts(search.trim())
        .then((rows) => {
          if (isCurrent() && version === searchRequestVersion.current) {
            setMatches(rows);
            setMatchedSearch(search.trim());
          }
        })
        .catch((reason: unknown) => {
          if (isCurrent() && version === searchRequestVersion.current)
            setSearchError(purchaseErrorMessage(reason));
        })
        .finally(() => {
          if (isCurrent() && version === searchRequestVersion.current)
            setSearchLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ++searchRequestVersion.current;
    };
  }, [search, searchVersion, locked, isCurrent]);

  const evaluated = useMemo(() => lines.map(evaluatePurchaseLine), [lines]);
  const invalidLines = evaluated.some(
    (line) => line.quantityError || line.costError,
  );
  const total =
    evaluated.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0) / 100;
  const totalsByUnit = useMemo(() => {
    const totals = new Map<PurchaseProduct["unit"], number>();
    for (let index = 0; index < lines.length; index++) {
      const quantity = evaluated[index].quantity;
      if (!evaluated[index].quantityError && quantity !== null)
        totals.set(
          lines[index].product.unit,
          (totals.get(lines[index].product.unit) ?? 0) + quantity,
        );
    }
    return [...totals].map(([unit, quantity]) => ({ unit, quantity }));
  }, [lines, evaluated]);
  const supplierInvalid = validated && !supplierId;
  const totalInvalid = total > PURCHASE_LIMITS.maxTotal;

  const markEdited = () => {
    attempt.current = null;
    setError("");
  };

  const addProduct = (product: PurchaseProduct) => {
    if (locked || inFlight.current || !isCurrent()) return;
    const existing = lines.find((line) => line.product.id === product.id);
    if (!existing && lines.length >= PURCHASE_LIMITS.maxItems) {
      setError(
        `Una compra admite hasta ${PURCHASE_LIMITS.maxItems} productos distintos.`,
      );
      return;
    }
    markEdited();
    if (existing) {
      setAnnouncement(
        `${product.name} ya está agregado. Ajusta la cantidad en su fila.`,
      );
    } else {
      setLines((current) => [
        ...current,
        {
          product,
          quantity: "1",
          unitCost: Math.max(0, product.purchasePrice).toFixed(2),
        },
      ]);
      setAnnouncement(`${product.name} agregado a la compra.`);
    }
    setSearch("");
    window.requestAnimationFrame(() =>
      document.getElementById(`purchase-quantity-${product.id}`)?.focus(),
    );
  };

  const editLine = (
    id: number,
    field: "quantity" | "unitCost",
    value: string,
  ) => {
    if (locked || inFlight.current) return;
    markEdited();
    setLines((current) =>
      current.map((line) =>
        line.product.id === id ? { ...line, [field]: value } : line,
      ),
    );
  };

  const removeLine = (id: number) => {
    if (locked || inFlight.current) return;
    markEdited();
    setLines((current) => current.filter((line) => line.product.id !== id));
    setAnnouncement("Producto quitado de la compra.");
    window.requestAnimationFrame(() =>
      document.getElementById("purchase-product-search")?.focus(),
    );
  };

  async function submit() {
    if (inFlight.current || !isCurrent()) return;
    setValidated(true);
    setError("");
    let pending = attempt.current;
    if (!pending) {
      if (!supplierId || !lines.length || invalidLines || totalInvalid) {
        setError(
          !supplierId
            ? "Selecciona un proveedor para esta compra."
            : !lines.length
              ? "Agrega al menos un producto para registrar la compra."
              : totalInvalid
                ? "La inversión de una compra no puede superar $100,000,000.00."
                : "Revisa las cantidades y los costos señalados antes de continuar.",
        );
        const firstInvalid = evaluated.findIndex(
          (line) => line.quantityError || line.costError,
        );
        window.requestAnimationFrame(() => {
          const control = !supplierId
            ? "purchase-supplier"
            : firstInvalid >= 0
              ? `purchase-${evaluated[firstInvalid].quantityError ? "quantity" : "cost"}-${lines[firstInvalid].product.id}`
              : "purchase-product-search";
          document.getElementById(control)?.focus();
        });
        return;
      }
      if (!suppliers.some((supplier) => String(supplier.id) === supplierId)) {
        setError(
          "El proveedor seleccionado ya no está disponible. Actualiza la lista y elige otro.",
        );
        return;
      }
      pending = {
        version: 1,
        supplierName:
          suppliers.find((supplier) => String(supplier.id) === supplierId)
            ?.name ?? "Proveedor",
        lines: lines.map((line) => ({ ...line, product: { ...line.product } })),
        input: {
          requestId: crypto.randomUUID(),
          supplierId: Number(supplierId),
          items: lines.map((line, index) => ({
            productId: line.product.id,
            expectedUnit: line.product.unit,
            quantity: evaluated[index].quantity!,
            unitCost: evaluated[index].unitCost!,
          })),
        },
      };
    }
    try {
      persistPendingPurchase(userId, pending);
    } catch {
      setError(
        "No se pudo conservar el intento de compra en este equipo. No se ha enviado; vuelve a intentarlo.",
      );
      return;
    }
    attempt.current = pending;
    inFlight.current = true;
    setSaving(true);
    onPendingChange(true);
    let saved: CreatePurchaseResult;
    try {
      saved = await window.api.purchases.create(pending.input);
    } catch (reason) {
      const definite = isDefinitivePurchaseRejection(reason);
      let cleared = false;
      if (definite) {
        try {
          clearPendingPurchase(userId);
          cleared = true;
        } catch {
          /* Preserve the attempt until storage can be cleared safely. */
        }
      }
      if (isCurrent()) {
        setUncertain(!cleared);
        onPendingChange(!cleared);
        setError(purchaseErrorMessage(reason));
        if (cleared) attempt.current = null;
      }
      return;
    } finally {
      inFlight.current = false;
      if (isCurrent()) setSaving(false);
    }
    try {
      clearPendingPurchase(userId);
    } catch {
      // A recovered attempt uses the same requestId and is safe to acknowledge again.
    }
    if (isCurrent()) {
      attempt.current = null;
      setUncertain(false);
      onPendingChange(false);
      onRegistered(saved);
    }
  }

  return {
    supplierId,
    selectSupplier: (value: string) => {
      if (!locked) {
        markEdited();
        setSupplierId(value);
      }
    },
    supplierName:
      suppliers.find((supplier) => String(supplier.id) === supplierId)?.name ??
      recovered?.supplierName,
    suppliers,
    suppliersLoading,
    supplierError,
    loadSuppliers,
    supplierInvalid,
    search,
    setSearch,
    matches: matchedSearch === search.trim() ? matches : [],
    searchLoading,
    searchError,
    retrySearch: () => setSearchVersion((version) => version + 1),
    lines,
    evaluated,
    editLine,
    removeLine,
    addProduct,
    total,
    totalsByUnit,
    totalInvalid,
    saving,
    uncertain,
    locked,
    error,
    validated,
    announcement,
    submit,
    dirty: Boolean(supplierId || lines.length),
  };
}
