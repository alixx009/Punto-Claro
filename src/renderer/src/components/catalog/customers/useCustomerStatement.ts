import { useCallback, useRef, useState } from "react";
import type {
  AccountMovement,
  CustomerWithBalance,
  SaleItem,
} from "../../../../../shared/ipc";
import { fetchMovements, fetchSaleItems } from "@/data/customersStore";
import type { ToastData } from "./Toast";

type Notify = (kind: ToastData["kind"], text: string) => void;

export function useCustomerStatement(
  customers: CustomerWithBalance[],
  notify: Notify,
) {
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [paperSize, setPaperSize] = useState<"LETTER" | "A4">("LETTER");
  const movementRequest = useRef(0);
  const activeCustomerId = useRef<number | null>(null);

  const [saleMovement, setSaleMovement] = useState<AccountMovement | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleItemsLoading, setSaleItemsLoading] = useState(false);
  const saleRequest = useRef(0);

  const loadMovements = useCallback(
    async (id: number) => {
      const request = ++movementRequest.current;
      setLoading(true);
      try {
        const list = await fetchMovements(id);
        if (request === movementRequest.current) setMovements(list);
      } catch (error) {
        if (request === movementRequest.current) {
          notify(
            "error",
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los movimientos.",
          );
        }
      } finally {
        if (request === movementRequest.current) setLoading(false);
      }
    },
    [notify],
  );

  const openWith = useCallback((customer: CustomerWithBalance) => {
    activeCustomerId.current = customer.id;
    setCustomerId(customer.id);
    setMovements([]);
    void loadMovements(customer.id);
  }, [loadMovements]);

  const close = useCallback(() => {
    movementRequest.current++;
    activeCustomerId.current = null;
    setCustomerId(null);
    setMovements([]);
    setLoading(false);
  }, []);

  const refresh = useCallback(async (id: number) => {
    if (activeCustomerId.current === id) await loadMovements(id);
  }, [loadMovements]);

  const openSaleDetail = useCallback(async (movement: AccountMovement) => {
    const request = ++saleRequest.current;
    setSaleMovement(movement);
    setSaleItems([]);
    setSaleItemsLoading(true);
    try {
      const items = await fetchSaleItems(movement.id);
      if (request === saleRequest.current) setSaleItems(items);
    } catch (error) {
      if (request === saleRequest.current) {
        notify(
          "error",
          error instanceof Error ? error.message : "No se pudieron cargar los productos.",
        );
        setSaleMovement(null);
      }
    } finally {
      if (request === saleRequest.current) setSaleItemsLoading(false);
    }
  }, [notify]);

  const closeSaleDetail = useCallback(() => {
    saleRequest.current++;
    setSaleMovement(null);
    setSaleItems([]);
    setSaleItemsLoading(false);
  }, []);

  return {
    statement: {
      open: customerId !== null,
      customer: customers.find((customer) => customer.id === customerId) ?? null,
      movements,
      loading,
      paperSize,
      setPaperSize,
      openWith,
      close,
      refresh,
    },
    saleDetail: {
      movement: saleMovement,
      items: saleItems,
      loading: saleItemsLoading,
      openWith: openSaleDetail,
      close: closeSaleDetail,
    },
  };
}
