import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCashRegister } from "@/hooks/useCashRegister";
import { addCashMovement } from "@/data/registerStore";
import type { CashMovementKind } from "../../../../../shared/ipc";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const tabs = [
  {
    value: "retiro",
    label: "Retiro / Egreso",
    kind: "EXPENSE" as CashMovementKind,
    icon: ArrowDownCircle,
    color: "text-red-500",
    confirmLabel: "Registrar Retiro",
    conceptPlaceholder: "Ej. Retiro para cambio a proveedor",
  },
  {
    value: "ingreso",
    label: "Ingreso extra",
    kind: "INCOME" as CashMovementKind,
    icon: ArrowUpCircle,
    color: "text-emerald-500",
    confirmLabel: "Registrar Ingreso",
    conceptPlaceholder: "Ej. Surtido adicional de fondo",
  },
];

const REASON_MAX = 100;

export function CashAdjustDialog() {
  const { shift, session, refresh } = useCashRegister();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("retiro");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = (kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2500);
  };

  const reset = () => {
    setAmount("");
    setReason("");
    setError(null);
    setBusy(false);
    setActiveTab("retiro");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleConfirm = async () => {
    setError(null);
    if (!shift || !session) {
      setError("La caja está cerrada.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Ingresa un monto válido mayor a 0.");
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Indica el motivo del movimiento.");
      return;
    }
    if (trimmedReason.length > REASON_MAX) {
      setError(`El motivo no puede superar ${REASON_MAX} caracteres.`);
      return;
    }
    const tab = tabs.find((t) => t.value === activeTab);
    if (!tab) return;

    setBusy(true);
    try {
      await addCashMovement({
        sessionId: session.id,
        kind: tab.kind,
        amount: numericAmount,
        reason: trimmedReason,
      });
      const label = tab.kind === "INCOME" ? "ingreso" : "retiro";
      showToast(
        "success",
        `Se registró el ${label} de ${mxn.format(numericAmount)}`,
      );
      refresh();
      setOpen(false);
      reset();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo registrar el movimiento.";
      setError(message);
      showToast("error", message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!shift}
          aria-label="Ajuste de efectivo"
          title={shift ? "Ajuste de efectivo" : "Abre la caja para ajustar"}
        >
          <Tag aria-hidden="true" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-4" /> Ajuste de efectivo
          </DialogTitle>
          <DialogDescription>
            Ingresos o retiros directos de efectivo
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="min-w-0 flex-1 items-center gap-1.5 border-none"
                >
                  <Icon className={`size-3.5 ${tab.color}`} />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                <Field>
                  <Label htmlFor={`cash-adjust-${tab.value}-amount`}>
                    Monto total
                  </Label>
                  <MoneyInput
                    id={`cash-adjust-${tab.value}-amount`}
                    placeholder="$0.00"
                    value={amount}
                    onValueChange={setAmount}
                  />
                </Field>
                <Field>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`cash-adjust-${tab.value}-reason`}>
                      Motivo / Concepto
                    </Label>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {reason.length}/{REASON_MAX}
                    </span>
                  </div>
                  <Input
                    id={`cash-adjust-${tab.value}-reason`}
                    placeholder={tab.conceptPlaceholder}
                    maxLength={REASON_MAX}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </FieldGroup>

              <div className="rounded-md border border-dashed border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Caja actual:
                </span>{" "}
                {mxn.format(session?.cashPayments ?? 0)} (ventas) +{" "}
                {mxn.format(session?.cashMovements ?? 0)} (ajustes) ={" "}
                <span className="font-bold text-foreground">
                  {mxn.format(
                    (session?.openingAmount ?? 0) +
                      (session?.cashPayments ?? 0) +
                      (session?.cashMovements ?? 0),
                  )}
                </span>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="hover:cursor-pointer"
              variant="outline"
              disabled={busy}
            >
              Cancelar
            </Button>
          </DialogClose>
          <Button
            className="hover:cursor-pointer"
            onClick={handleConfirm}
            disabled={busy}
          >
            {tabs.find((t) => t.value === activeTab)?.confirmLabel}
          </Button>
        </DialogFooter>

        {toast && (
          <div
            role={toast.kind === "error" ? "alert" : "status"}
            className="pointer-events-none break-words rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground"
          >
            {toast.text}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
