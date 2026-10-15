import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CreditCard, Receipt, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  CustomerWithBalance,
  PaymentMethod,
  SalePaymentInput,
} from "../../../../shared/ipc";
import { KeyboardKey } from "./SalesCatalog";
const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});
type PaymentKey = PaymentMethod | "STORE_CREDIT";
interface PaymentLine {
  key: PaymentKey;
  label: string;
  amount: number;
}

const PAYMENT_METHODS: Array<{
  key: PaymentMethod;
  label: string;
  Icon: typeof Banknote;
  shortcut: string;
}> = [
  { key: "CASH", label: "Efectivo", Icon: Banknote, shortcut: "F1" },
  { key: "CARD", label: "Pago con tarjeta", Icon: CreditCard, shortcut: "F2" },
  { key: "TRANSFER", label: "Transferencia", Icon: Wallet, shortcut: "F4" },
];
const PAYMENT_SHORTCUTS: Record<string, PaymentMethod> = Object.fromEntries(
  PAYMENT_METHODS.map(({ shortcut, key }) => [shortcut, key]),
);
const QUICK_CASH_AMOUNTS = [20, 50, 100, 200, 500, 1000];

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isSafeInteger(Math.round(amount * 100)) && amount > 0
    ? amount
    : null;
}

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  customer,
  canFiar,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  customer: CustomerWithBalance | null;
  canFiar: boolean;
  onComplete: (
    payments: SalePaymentInput[],
    creditAmount: number,
    tenderedCash: number,
    notes: string,
  ) => Promise<void>;
}) {
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>("CASH");
  const [amountInput, setAmountInput] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [creditAmount, setCreditAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [amountError, setAmountError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setActiveMethod("CASH");
      setAmountInput("");
      setPayments([]);
      setCreditAmount(0);
      setNotes("");
      setAmountError("");
    }
  }, [open]);

  useEffect(() => {
    const handler = () => {
      if (!open || submitting) return;
      void handleComplete();
    };
    window.addEventListener("sales:f6-complete", handler);
    return () => window.removeEventListener("sales:f6-complete", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting, payments, creditAmount, total, canFiar, notes]);

  useEffect(() => {
    if (open && total > 0) {
      setAmountInput(String(total.toFixed(2)));
      requestAnimationFrame(() => {
        amountRef.current?.focus();
        amountRef.current?.select();
      });
    }
  }, [open, total]);

  const paid = useMemo(
    () =>
      payments.reduce(
        (sum, p) => (p.key === "STORE_CREDIT" ? sum : sum + p.amount),
        0,
      ),
    [payments],
  );
  const remaining = Math.max(0, total - paid - creditAmount);
  const change = Math.max(0, Math.round((paid - total) * 100) / 100);
  const cashCoversTotal = paid + 0.001 >= total;
  const exactWithCredit = Math.abs(total - paid - creditAmount) < 0.001;

  const canComplete =
    total > 0 && (cashCoversTotal || (canFiar && exactWithCredit));

  const addLine = (amount: number, method: PaymentKey = activeMethod) => {
    if (amount <= 0) return;
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
      setAmountError("El monto debe tener como máximo dos decimales.");
      return;
    }
    if (method !== "CASH" && amount > remaining + 0.001) {
      setAmountError(
        "Este método no admite cambio. Registra solo el saldo pendiente.",
      );
      return;
    }
    const label = methodLabel(method);
    setPayments((prev) => [
      ...prev,
      { key: method, label, amount: Math.round(amount * 100) / 100 },
    ]);
    if (creditAmount > 0 && paid + amount + creditAmount > total) {
      setCreditAmount(
        Math.max(0, Math.round((total - paid - amount) * 100) / 100),
      );
    }
    setAmountError("");
    setAmountInput("");
  };

  const removeLine = (idx: number) =>
    setPayments((prev) => prev.filter((_, i) => i !== idx));

  const applyExact = () => {
    const need = Math.max(
      0,
      Math.round((total - paid - creditAmount) * 100) / 100,
    );
    if (need <= 0) return;
    addLine(need, activeMethod);
  };

  const applyFiar = () => {
    const need = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (need <= 0) return;
    setCreditAmount(need);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const method = PAYMENT_SHORTCUTS[event.key];
      if (!method && event.key !== "F5") return;
      event.preventDefault();
      if (submitting) return;
      if (method) {
        setActiveMethod(method);
        amountRef.current?.focus();
        amountRef.current?.select();
      } else if (canFiar) {
        const need = Math.max(0, Math.round((total - paid) * 100) / 100);
        if (need > 0) setCreditAmount(need);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, submitting, canFiar, total, paid]);

  const handleComplete = async () => {
    if (submittingRef.current || !canComplete || total <= 0) return;

    const capped = capPayments(payments, total);
    const sumPaid = capped.reduce((s, p) => s + p.amount, 0);
    const finalCredit = canFiar
      ? Math.min(
          creditAmount,
          Math.max(0, Math.round((total - sumPaid) * 100) / 100),
        )
      : 0;
    const tenderedCash = payments.reduce(
      (sum, line) => sum + (line.key === "CASH" ? line.amount : 0),
      0,
    );
    if (
      Math.abs(sumPaid + finalCredit - total) > 0.001 ||
      (finalCredit > 0 && creditAmount <= 0)
    ) {
      setAmountError("Los abonos no cubren el total de la venta.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onComplete(capped, finalCredit, tenderedCash, notes);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const capPayments = (
    list: PaymentLine[],
    limit: number,
  ): SalePaymentInput[] => {
    let acc = 0;
    const result: SalePaymentInput[] = [];
    for (const p of [
      ...list.filter((line) => line.key !== "CASH"),
      ...list.filter((line) => line.key === "CASH"),
    ]) {
      if (p.key === "STORE_CREDIT" || p.amount <= 0) continue;
      if (acc >= limit) break;
      const amt = Math.round(Math.min(p.amount, limit - acc) * 100) / 100;
      if (amt > 0) result.push({ method: p.key as PaymentMethod, amount: amt });
      acc += amt;
    }
    return result;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6 sm:py-5 sm:pr-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Receipt className="size-5" />
                Registrar Pago y Cierre
              </DialogTitle>
              <DialogDescription>
                Captura los montos entregados por el cliente
              </DialogDescription>
            </div>
            <div className="min-w-0 sm:max-w-[45%] sm:text-right">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Cliente
              </p>
              <Badge
                variant={customer ? "default" : "outline"}
                className="mt-1 max-w-full truncate"
                title={customer?.name}
              >
                {customer ? customer.name : "CLIENTE GENERAL"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 min-w-0 grid-cols-1 gap-5 overflow-y-auto px-4 py-4 sm:gap-8 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          {/* Left column */}
          <div className="flex min-w-0 flex-col gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">
                Seleccionar método de pago
              </Label>
              <div
                role="group"
                aria-label="Métodos de pago"
                className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3"
              >
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setActiveMethod(m.key)}
                    disabled={submitting}
                    aria-pressed={activeMethod === m.key}
                    aria-keyshortcuts={m.shortcut}
                    className={cn(
                      "flex min-h-24 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-center text-sm font-semibold leading-tight transition-colors hover:cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      activeMethod === m.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-accent",
                    )}
                  >
                    <m.Icon className="size-6" />
                    <span>{m.label}</span>
                    <span className="text-xs opacity-70">{m.shortcut}</span>
                  </button>
                ))}
              </div>
              {canFiar && (
                <button
                  type="button"
                  onClick={applyFiar}
                  disabled={remaining <= 0}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 hover:cursor-pointer hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CreditCard className="size-4" />
                  Crédito Tienda / Fiar [F5]
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">
                Monto a registrar (
                {activeMethod === "CASH"
                  ? "Efectivo"
                  : methodLabel(activeMethod)}
                )
              </Label>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-0 basis-36 flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    ref={amountRef}
                    inputMode="decimal"
                    aria-label={`Monto para ${methodLabel(activeMethod)}`}
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setAmountError("");
                    }}
                    placeholder="0.00"
                    className="h-12 pl-8 font-mono text-lg tabular-nums"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = parseMoney(amountInput);
                        if (v !== null) addLine(v);
                        else
                          setAmountError(
                            "Ingresa un monto válido con máximo dos decimales.",
                          );
                      }
                    }}
                  />
                </div>
                <Button
                  className="h-12 px-5 hover:cursor-pointer"
                  onClick={() => {
                    const v = parseMoney(amountInput);
                    if (v !== null) addLine(v);
                    else
                      setAmountError(
                        "Ingresa un monto válido con máximo dos decimales.",
                      );
                  }}
                  disabled={parseMoney(amountInput) === null}
                >
                  + Abonar
                </Button>
              </div>
              {amountError && (
                <p role="alert" className="text-xs text-destructive">
                  {amountError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {activeMethod === "CASH" && (
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  Billetes sugeridos
                </Label>
              )}
              <div className="flex flex-wrap gap-2">
                {activeMethod === "CASH" &&
                  QUICK_CASH_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => addLine(amt)}
                      className="min-h-10 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold tabular-nums hover:cursor-pointer hover:bg-accent"
                    >
                      {mxn.format(amt)}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={applyExact}
                  disabled={remaining <= 0}
                  className={cn(
                    "min-h-10 rounded-md border px-3 py-2 text-sm font-semibold tabular-nums hover:cursor-pointer",
                    remaining > 0
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  Exacto ({mxn.format(remaining)})
                </button>
              </div>
            </div>

            <p className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {canComplete && change === 0 && creditAmount === 0
                ? "Pago exacto: listo para completar"
                : canComplete && change > 0
                  ? `Cambio a devolver: ${mxn.format(change)}`
                  : `Falta: ${mxn.format(remaining)}`}
            </p>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">
                Nota u observación interna
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentario interno (no se imprime al cliente)"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="flex min-w-0 flex-col gap-5">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total de la venta
              </p>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {mxn.format(total)}
              </p>
            </div>

            <div className="space-y-1.5">
              {payments.length === 0 && creditAmount === 0 && (
                <p className="rounded-md border border-dashed border-border bg-background/45 p-4 text-center text-xs text-muted-foreground">
                  Esperando registro de abonos…
                </p>
              )}
              {payments.map((p, idx) => (
                <div
                  key={`${p.key}-${idx}`}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase">
                        {p.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {mxn.format(p.amount)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-muted-foreground hover:text-destructive hover:cursor-pointer"
                    aria-label={`Quitar abono de ${p.label} por ${mxn.format(p.amount)}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {creditAmount > 0 && (
                <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase text-amber-700">
                        Crédito Tienda / Fiar
                      </p>
                      <p className="text-[10px] text-amber-700/80">
                        {mxn.format(creditAmount)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreditAmount(0)}
                    className="text-amber-700 hover:text-amber-900 hover:cursor-pointer"
                    aria-label="Quitar fiado"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase">Abonado</span>
                <span className="font-mono tabular-nums">
                  {mxn.format(paid + creditAmount)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.min(100, ((paid + creditAmount) / Math.max(0.01, total)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                creditAmount > 0
                  ? "border-red-500/40 bg-red-500/10 text-red-600"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase">
                  {creditAmount > 0 ? "Saldo Restante" : "Cambio a entregar"}
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {mxn.format(creditAmount > 0 ? creditAmount : change)}
                </span>
              </div>
              {change > 0 && creditAmount === 0 && (
                <p className="mt-1 text-xs">
                  Pagó {mxn.format(paid)} · Venta {mxn.format(total)}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3 sm:px-6 sm:py-4">
          <Button
            variant="outline"
            className="h-11 px-6 hover:cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cerrar
          </Button>
          <Button
            className="h-11 px-6 hover:cursor-pointer"
            onClick={handleComplete}
            disabled={submitting || !canComplete}
          >
            Completar
            <KeyboardKey emphasis>F6</KeyboardKey>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function methodLabel(method: PaymentKey): string {
  switch (method) {
    case "CASH":
      return "Efectivo";
    case "CARD":
      return "Tarjeta";
    case "DEBIT":
      return "T. Débito";
    case "CREDIT":
      return "T. Crédito";
    case "TRANSFER":
      return "Transfer.";
    case "VOUCHER":
      return "Vale";
    case "OTHER":
      return "Otro";
    case "STORE_CREDIT":
      return "Crédito Tienda";
    default:
      return "";
  }
}
