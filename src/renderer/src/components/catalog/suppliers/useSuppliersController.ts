import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isValidSupplierRfc,
  type Supplier,
  type SupplierInput,
} from "../../../../../shared/suppliers";
import { getSessionDataEpoch } from "@/data/sessionEpoch";
import { supplierErrorMessage, supplierSearchText } from "./supplierUtils";

function sortSuppliers(suppliers: Supplier[]): Supplier[] {
  return suppliers.toSorted(
    (left, right) =>
      left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" }) ||
      left.id - right.id,
  );
}

export function useSuppliersController() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ supplier: Supplier | null } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mounted = useRef(false);
  const epoch = useRef(getSessionDataEpoch());
  const readVersion = useRef(0);
  const mutationInFlight = useRef(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const isCurrent = useCallback(
    () => mounted.current && epoch.current === getSessionDataEpoch(),
    [],
  );
  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!isCurrent()) return;
      const target = returnFocusTo.current?.isConnected
        ? returnFocusTo.current
        : document.getElementById("suppliers-search");
      target?.focus();
    });
  }, [isCurrent]);

  const load = useCallback(async () => {
    if (mutationInFlight.current || !isCurrent()) return;
    const version = ++readVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const rows = await window.api.suppliers.list();
      if (isCurrent() && version === readVersion.current)
        setSuppliers(sortSuppliers(rows));
    } catch (error) {
      if (isCurrent() && version === readVersion.current)
        setLoadError(supplierErrorMessage(error));
    } finally {
      if (isCurrent() && version === readVersion.current) setLoading(false);
    }
  }, [isCurrent]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      ++readVersion.current;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const query = supplierSearchText(deferredSearch.trim());
    if (!query) return suppliers;
    return suppliers.filter((supplier) =>
      supplierSearchText(
        [
          supplier.name,
          supplier.rfc,
          supplier.contactName,
          supplier.phone,
          supplier.email,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(query),
    );
  }, [suppliers, deferredSearch]);

  const metrics = useMemo(() => {
    let directContact = 0;
    let fiscalRegistration = 0;
    for (const supplier of suppliers) {
      if (supplier.phone || supplier.contactName) ++directContact;
      if (isValidSupplierRfc(supplier.rfc)) ++fiscalRegistration;
    }
    return { total: suppliers.length, directContact, fiscalRegistration };
  }, [suppliers]);

  function openEditor(supplier: Supplier | null) {
    if (mutationInFlight.current || loading || loadError) return;
    returnFocusTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setNotice("");
    setEditor({ supplier });
  }

  async function saveSupplier(
    id: number | null,
    input: SupplierInput,
  ): Promise<void> {
    if (mutationInFlight.current || !isCurrent())
      throw new Error("Hay otra operación en curso o cambió la sesión.");
    mutationInFlight.current = true;
    ++readVersion.current;
    setBusy(true);
    try {
      const saved =
        id === null
          ? await window.api.suppliers.create(input)
          : await window.api.suppliers.update(id, input);
      if (!isCurrent()) return;
      setSuppliers((rows) =>
        sortSuppliers([...rows.filter((row) => row.id !== saved.id), saved]),
      );
      setEditor(null);
      setNotice(
        id === null
          ? "Proveedor registrado correctamente."
          : "Datos del proveedor actualizados.",
      );
    } finally {
      mutationInFlight.current = false;
      if (isCurrent()) setBusy(false);
    }
  }

  function askDelete(supplier: Supplier) {
    if (mutationInFlight.current || loading || loadError) return;
    returnFocusTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setNotice("");
    setDeleteError("");
    setDeleteTarget(supplier);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget || mutationInFlight.current || !isCurrent()) return;
    const target = deleteTarget;
    mutationInFlight.current = true;
    ++readVersion.current;
    setBusy(true);
    setDeleting(true);
    setDeleteError("");
    try {
      await window.api.suppliers.remove(target.id);
      if (!isCurrent()) return;
      setSuppliers((rows) => rows.filter((row) => row.id !== target.id));
      setDeleteTarget(null);
      setNotice("Proveedor eliminado del catálogo.");
    } catch (error) {
      if (isCurrent()) setDeleteError(supplierErrorMessage(error));
    } finally {
      mutationInFlight.current = false;
      if (isCurrent()) {
        setBusy(false);
        setDeleting(false);
      }
    }
  }

  return {
    search,
    setSearch,
    filtered,
    metrics,
    loading,
    loadError,
    load,
    notice,
    dismissNotice: () => setNotice(""),
    busy,
    editor,
    openEditor,
    closeEditor: () => {
      if (!mutationInFlight.current) setEditor(null);
    },
    saveSupplier,
    deleteTarget,
    askDelete,
    confirmDelete,
    deleting,
    deleteError,
    cancelDelete: () => {
      if (!mutationInFlight.current) setDeleteTarget(null);
    },
    restoreFocus,
  };
}
