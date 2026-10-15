import { useCallback, useRef, useState } from "react";
import type {
  CustomerWithBalance,
  PaymentMethod,
} from "../../../../../shared/ipc";
import { addPayment } from "@/data/paymentsStore";
import { mxn } from "./constants";
import type { ToastData } from "./Toast";

type Notify = (kind: ToastData["kind"], text: string) => void;

function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function useCustomerPayment(
  customers: CustomerWithBalance[],
  shift: boolean,
  refreshStatement: (id: number) => Promise<void>,
  notify: Notify,
) {
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const customer = customers.find((item) => item.id === customerId) ?? null;
  const parsedAmount = parseAmount(amount);
  const canConfirm =
    shift &&
    customer !== null &&
    parsedAmount !== null &&
    Math.round(parsedAmount * 100) <= Math.round(customer.balance * 100);
  const amountError = amount.trim()
    ? parsedAmount === null
      ? "Ingresa un monto válido con máximo dos decimales."
      : customer && Math.round(parsedAmount * 100) > Math.round(customer.balance * 100)
        ? "El abono no puede superar el saldo pendiente."
        : null
    : null;

  const openWith = useCallback((selected: CustomerWithBalance) => {
    setCustomerId(selected.id);
    setAmount("");
    setMethod("CASH");
    setError(null);
  }, []);

  const close = useCallback(() => {
    if (savingRef.current) return;
    setCustomerId(null);
    setAmount("");
    setMethod("CASH");
    setError(null);
  }, []);

  const changeAmount = useCallback((value: string) => {
    setAmount(value);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (savingRef.current || !customer) return;
    const paymentAmount = parseAmount(amount);
    if (!shift) {
      setError("Abre la caja antes de registrar abonos.");
      return;
    }
    if (paymentAmount === null) {
      setError("Ingresa un monto válido con máximo dos decimales.");
      return;
    }
    if (Math.round(paymentAmount * 100) > Math.round(customer.balance * 100)) {
      setError("El abono no puede superar el saldo pendiente.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await addPayment({ customerId: customer.id, amount: paymentAmount, method });
      setCustomerId(null);
      setAmount("");
      notify("success", `Abono de ${mxn.format(paymentAmount)} registrado a ${customer.name}`);
      void refreshStatement(customer.id);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "No se pudo registrar el abono.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [customer, amount, shift, method, notify, refreshStatement]);

  return {
    open: customerId !== null,
    customer,
    amount,
    method,
    error: error ?? amountError,
    saving,
    canConfirm,
    setAmount: changeAmount,
    setMethod,
    openWith,
    close,
    confirm,
  };
}
