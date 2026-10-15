import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomerWithBalance } from "../../../../../shared/ipc";
import {
  deleteCustomer,
  loadCustomers,
  subscribeCustomers,
} from "@/data/customersStore";
import { useCashRegister } from "@/hooks/useCashRegister";
import { useAuth } from "@/auth/useAuth";
import type { Filter } from "./constants";
import type { ToastData } from "./Toast";
import { useCustomerForm } from "./useCustomerForm";
import { useCustomerPayment } from "./useCustomerPayment";
import { useCustomerStatement } from "./useCustomerStatement";

export function useCustomersController() {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const { shift, session } = useCashRegister();
  const { user, isAdmin } = useAuth();
  const canCollect =
    shift &&
    (isAdmin || (!!session?.cashierId && session.cashierId === user?.id));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<CustomerWithBalance | null>(
    null,
  );
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((kind: ToastData["kind"], text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), kind, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCustomers(setCustomers);
    void loadCustomers().catch((error) => {
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los clientes.",
      );
    });
    return () => {
      unsubscribe();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = customers;
    if (filter === "debtors")
      list = list.filter((customer) => customer.balance > 0);
    if (term) {
      list = list.filter(
        (customer) =>
          customer.name.toLowerCase().includes(term) ||
          customer.code.toLowerCase().includes(term) ||
          (customer.phone ?? "").toLowerCase().includes(term),
      );
    }
    return list;
  }, [customers, search, filter]);

  const metrics = useMemo(
    () => ({
      totalCustomers: customers.length,
      debtorCount: customers.filter((customer) => customer.balance > 0).length,
      totalDebt: customers.reduce((sum, customer) => sum + customer.balance, 0),
    }),
    [customers],
  );

  const form = useCustomerForm(customers);
  const { statement, saleDetail } = useCustomerStatement(customers, showToast);
  const payment = useCustomerPayment(
    customers,
    canCollect,
    statement.refresh,
    showToast,
  );

  const askDelete = useCallback(
    (customer: CustomerWithBalance) => {
      if (!isAdmin) return;
      setDeleteTarget(customer);
    },
    [isAdmin],
  );
  const cancelDelete = useCallback(() => setDeleteTarget(null), []);
  const confirmDelete = useCallback(async () => {
    if (!isAdmin || !deleteTarget) return;
    try {
      const deleted = await deleteCustomer(deleteTarget.id);
      if (!deleted) throw new Error("El cliente ya no está disponible.");
      showToast("success", "Cliente eliminado");
      setDeleteTarget(null);
    } catch (error) {
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el cliente.",
      );
    }
  }, [deleteTarget, showToast, isAdmin]);

  return {
    shift,
    canCollect,
    canDeleteCustomers: isAdmin,
    filtered,
    metrics,
    search,
    setSearch,
    filter,
    setFilter,
    form,
    statement,
    payment,
    deleteTarget: {
      target: deleteTarget,
      ask: askDelete,
      cancel: cancelDelete,
      confirm: confirmDelete,
    },
    saleDetail,
    toast,
  };
}
