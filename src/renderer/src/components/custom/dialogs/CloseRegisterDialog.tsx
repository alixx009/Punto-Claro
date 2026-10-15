import { useEffect, useId, useMemo, useState } from "react";
import { Lock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { RegisterExpectedByMethod } from "../../../../../shared/ipc";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

interface CloseRegisterDialogProps {
  openingMoney: number;
  cashMovements: number;
  expectedByMethod: RegisterExpectedByMethod;
  onClose: (declared: {
    cash: number;
    card: number;
    transfer: number;
  }) => Promise<void>;
}

interface MethodRowProps {
  label: string;
  expected: number;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}

function MethodRow({ label, expected, value, onChange, hint }: MethodRowProps) {
  const inputId = useId();
  return (
    <Field>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          id={inputId}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <p className="text-[10px] uppercase text-muted-foreground">
        {hint}: {mxn.format(expected)}
      </p>
    </Field>
  );
}

export function CloseRegisterDialog({
  openingMoney,
  cashMovements,
  expectedByMethod,
  onClose,
}: CloseRegisterDialogProps) {
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [transfer, setTransfer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCash("");
      setCard("");
      setTransfer("");
      setSubmitting(false);
    }
  }, [open]);

  const declared = useMemo(
    () => ({
      cash: Number(cash) || 0,
      card: Number(card) || 0,
      transfer: Number(transfer) || 0,
    }),
    [cash, card, transfer],
  );

  const declaredTotal = declared.cash + declared.card + declared.transfer;

  const expectedCash = openingMoney + expectedByMethod.cash + cashMovements;
  const expectedCard = expectedByMethod.card;
  const expectedTransfer = expectedByMethod.transfer;
  const expectedOther = expectedByMethod.other;
  const expectedTotal =
    expectedCash + expectedCard + expectedTransfer + expectedOther;

  const difference = declaredTotal - expectedTotal;

  const differenceBadge = useMemo(() => {
    if (Math.abs(difference) < 0.005) {
      return (
        <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          Cuadra exactamente
        </Badge>
      );
    }
    if (difference < 0) {
      return (
        <Badge className="border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300">
          Falta {mxn.format(Math.abs(difference))}
        </Badge>
      );
    }
    return (
      <Badge className="border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300">
        Sobra {mxn.format(difference)}
      </Badge>
    );
  }, [difference]);

  const allInputsValid =
    cash.trim() !== "" &&
    card.trim() !== "" &&
    transfer.trim() !== "" &&
    Number.isFinite(declaredTotal) &&
    declaredTotal >= 0 &&
    declared.cash >= 0 &&
    declared.card >= 0 &&
    declared.transfer >= 0;

  const handleClose = async () => {
    if (!allInputsValid) return;
    setSubmitting(true);
    try {
      await onClose(declared);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Cierre de caja"
        >
          <Lock data-icon="inline-start" aria-hidden="true" />
          <span className="hidden sm:inline">Cierre de caja</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cierre de caja</DialogTitle>
          <DialogDescription>
            Captura el conteo físico real de cada formato de cobro
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Total esperado
            </p>
            <p className="break-words text-xl font-bold tabular-nums text-foreground">
              {mxn.format(expectedTotal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Total declarado
            </p>
            <p className="break-words text-xl font-bold tabular-nums text-foreground">
              {mxn.format(declaredTotal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Diferencia
            </p>
            <div className="mt-1">{differenceBadge}</div>
          </div>
        </div>

        <Separator />

        <FieldGroup>
          <MethodRow
            label="Efectivo en caja"
            expected={expectedCash}
            value={cash}
            onChange={setCash}
            hint="Efectivo esperado"
          />
          <MethodRow
            label="Pagos con tarjeta"
            expected={expectedCard}
            value={card}
            onChange={setCard}
            hint="Tarjeta esperada"
          />
          <MethodRow
            label="Transferencias"
            expected={expectedTransfer}
            value={transfer}
            onChange={setTransfer}
            hint="Transferencias esperadas"
          />
        </FieldGroup>

        {expectedOther > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Hay {mxn.format(expectedOther)} registrados en otros métodos
            (vale/otro) que no se capturan manualmente.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button className="hover:cursor-pointer" variant="outline">
              Regresar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleClose}
            className="hover:cursor-pointer"
            disabled={submitting || !allInputsValid}
          >
            Concluir corte y cierre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
