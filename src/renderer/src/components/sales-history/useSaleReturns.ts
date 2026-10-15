import { useEffect, useRef, useState } from "react";
import { loadRegisterSession } from "@/data/registerStore";
import { refreshProducts } from "@/data/productStore";
import { refreshCustomers } from "@/data/customersStore";
import { calculateSaleReturn } from "../../../../shared/sale-returns";
import type {
  CreateSaleReturnInput,
  RefundMethod,
  SaleReturnDetail,
  SalesHistoryRow,
  SaleReturnSelection,
} from "../../../../shared/ipc";
import { formatMoney } from "./format";

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo registrar la devolución. Inténtalo de nuevo.";
  if (/SQLITE_|constraint failed|no such table|no such column/.test(message))
    return "No se pudo guardar la devolución. No se aplicaron cambios. Reinicia la app y vuelve a intentarlo.";
  return message.replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    "",
  );
}

export function useSaleReturns(onCompleted: () => void) {
  const [selected, setSelected] = useState<SalesHistoryRow | null>(null);
  const [detail, setDetail] = useState<SaleReturnDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const attempt = useRef<{
    fingerprint: string;
    input: CreateSaleReturnInput;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);

  async function open(row: SalesHistoryRow) {
    if (busy.current) return;
    const token = ++request.current;
    setSelected(row);
    setDetail(null);
    setQuantities({});
    setRefundMethod("CASH");
    setError(null);
    setSuccess(null);
    setLoading(true);
    attempt.current = null;
    try {
      const result = await window.api.sales.returnDetail(row.id);
      if (mounted.current && token === request.current) setDetail(result);
    } catch (cause) {
      if (mounted.current && token === request.current)
        setError(errorMessage(cause));
    } finally {
      if (mounted.current && token === request.current) setLoading(false);
    }
  }
  function close() {
    if (busy.current) return;
    request.current++;
    setSelected(null);
    setDetail(null);
    setError(null);
    setLoading(false);
    attempt.current = null;
  }
  function changeQuantity(id: number, value: string) {
    if (busy.current) return;
    setQuantities((previous) => ({ ...previous, [id]: value }));
    setError(null);
  }
  function selectAll() {
    if (!detail || busy.current) return;
    setQuantities(
      Object.fromEntries(
        detail.items.map((item) => [
          item.id,
          String(
            Math.round((item.soldQuantity - item.returnedQuantity) * 1000) /
              1000,
          ),
        ]),
      ),
    );
    setError(null);
  }

  const selection: SaleReturnSelection[] = [];
  let validation: string | null = null;
  let plan: ReturnType<typeof calculateSaleReturn> | null = null;
  if (detail) {
    for (const item of detail.items) {
      const raw = (quantities[item.id] ?? "0").trim().replace(",", ".");
      const quantity = raw === "" ? 0 : Number(raw);
      if (!/^\d*(?:\.\d*)?$/.test(raw) || !Number.isFinite(quantity)) {
        validation = `Indica una cantidad válida para ${item.productName}.`;
        break;
      }
      if (quantity > 0) selection.push({ saleItemId: item.id, quantity });
    }
    if (!validation) {
      try {
        plan = calculateSaleReturn(detail, selection);
      } catch (cause) {
        validation = errorMessage(cause);
      }
    }
  }

  async function confirm() {
    if (
      !detail ||
      !plan ||
      validation ||
      !selection.length ||
      busy.current ||
      detail.registerSessionId === null
    )
      return;
    const values = {
      saleId: detail.sale.id,
      revision: detail.revision,
      registerSessionId: detail.registerSessionId,
      items: selection,
      refundMethod,
      expectedRefund: plan.refundAmount,
      expectedDebtReduction: plan.debtReduction,
    };
    const fingerprint = JSON.stringify(values);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = {
        fingerprint,
        input: { ...values, requestId: crypto.randomUUID() },
      };
    const input = attempt.current.input;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await window.api.sales.returnCreate(input);
      // La operación ya está confirmada; un fallo al refrescar caja nunca repite el reembolso.
      void loadRegisterSession().catch(() => undefined);
      void refreshProducts().catch(() => undefined);
      if (detail.sale.customerId !== null)
        void refreshCustomers().catch(() => undefined);
      if (mounted.current) {
        setSuccess(
          `Devolución de ${formatMoney(result.amount)} registrada.${result.debtReduction > 0 ? ` Deuda reducida: ${formatMoney(result.debtReduction)}.` : ""}${result.refundAmount > 0 ? ` Reembolso: ${formatMoney(result.refundAmount)}.` : ""} El comprobante ya muestra los artículos restantes.`,
        );
        setSelected(null);
        setDetail(null);
        attempt.current = null;
        onCompleted();
      }
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      busy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }
  return {
    selected,
    detail,
    quantities,
    refundMethod,
    loading,
    submitting,
    error,
    success,
    validation,
    plan,
    selectionCount: selection.length,
    open,
    close,
    changeQuantity,
    selectAll,
    confirm,
    setRefundMethod: (value: RefundMethod) => {
      if (!busy.current) {
        setRefundMethod(value);
        setError(null);
      }
    },
  };
}
