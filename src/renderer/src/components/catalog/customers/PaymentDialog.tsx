import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mxn, paymentMethodOptions } from "./constants";
import type {
  CustomerWithBalance,
  PaymentMethod,
} from "../../../../../shared/ipc";

interface PaymentDialogProps {
  open: boolean;
  customer: CustomerWithBalance | null;
  amount: string;
  method: PaymentMethod;
  error: string | null;
  saving: boolean;
  canConfirm: boolean;
  onAmountChange: (value: string) => void;
  onMethodChange: (method: PaymentMethod) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const PaymentDialog = ({
  open,
  customer,
  amount,
  method,
  error,
  saving,
  canConfirm,
  onAmountChange,
  onMethodChange,
  onConfirm,
  onClose,
}: PaymentDialogProps) => (
  <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Registrar Abono a Cuenta</DialogTitle>
        <DialogDescription>
          Registra un pago que reduce el saldo pendiente del cliente.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm font-semibold">{customer?.name}</p>
          <p className="text-xs text-muted-foreground">ID: {customer?.code}</p>
          <Badge
            variant="outline"
            className="mt-2 border-destructive text-destructive"
          >
            {mxn.format(customer?.balance ?? 0)}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label>MONTO A ABONAR (MXN)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              $
            </span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              aria-invalid={error !== null}
              placeholder="0.00"
              className="pl-8 font-mono tabular-nums"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>MÉTODO DE PAGO</Label>
          <Select
            value={method}
            onValueChange={(v) => onMethodChange(v as PaymentMethod)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map(({ value, label, Icon }) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <span>{label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className="hover:cursor-pointer"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button
          className="hover:cursor-pointer"
          onClick={onConfirm}
          disabled={!canConfirm || saving}
        >
          {saving ? "Registrando..." : "Confirmar Abono"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
