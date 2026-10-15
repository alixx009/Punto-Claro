import {
  ArrowDown,
  ArrowUp,
  FileText,
  Printer,
  ShoppingCart,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mxn } from "./constants";
import { methodLabel } from "./helpers";
import type {
  AccountMovement,
  CustomerWithBalance,
} from "../../../../../shared/ipc";

interface StatementDialogProps {
  open: boolean;
  customer: CustomerWithBalance | null;
  movements: AccountMovement[];
  loading: boolean;
  paperSize: "LETTER" | "A4";
  onPaperSizeChange: (size: "LETTER" | "A4") => void;
  onClose: () => void;
  onOpenSaleDetail: (movement: AccountMovement) => void;
}

export const StatementDialog = ({
  open,
  customer,
  movements,
  loading,
  paperSize,
  onPaperSizeChange,
  onClose,
  onOpenSaleDetail,
}: StatementDialogProps) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="sm:max-w-3xl">
      <style media="print">{`@page { size: ${paperSize} portrait; margin: 14mm; }`}</style>
      <DialogHeader data-customer-statement-screen>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Estado de Cuenta / Movimientos
            </DialogTitle>
            <DialogDescription>
              {customer?.name} · ID {customer?.code}
            </DialogDescription>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              DEUDA PENDIENTE
            </p>
            <p className="text-2xl font-bold tabular-nums text-red-500">
              {mxn.format(customer?.balance ?? 0)}
            </p>
          </div>
        </div>
      </DialogHeader>

      <section
        data-customer-statement-print
        aria-label="Estado de cuenta para imprimir"
      >
        <header>
          <h1>Estado de cuenta</h1>
          <p>
            {customer?.name} · Cuenta {customer?.code}
          </p>
          <p>Saldo pendiente: {mxn.format(customer?.balance ?? 0)}</p>
        </header>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Tipo</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={`${movement.kind}-${movement.id}`}>
                <td>{movement.date}</td>
                <td>{movement.description}</td>
                <td>
                  {movement.kind === "CHARGE"
                    ? "Cargo"
                    : movement.kind === "REFUND"
                      ? "Reembolso"
                      : "Abono"}
                </td>
                <td>{mxn.format(movement.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div
        data-customer-statement-screen
        className="max-h-[45dvh] min-w-0 overflow-y-auto overscroll-contain pr-2"
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Cargando movimientos...
          </p>
        ) : movements.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sin movimientos registrados.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {movements.map((m) => (
              <MovementCard
                key={`${m.kind}-${m.id}`}
                movement={m}
                onClick={
                  m.kind === "CHARGE" ? () => onOpenSaleDetail(m) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      <DialogFooter
        data-customer-statement-screen
        className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      >
        <div className="grid grid-cols-2 items-center gap-2 sm:flex">
          <Select
            value={paperSize}
            onValueChange={(v) => onPaperSizeChange(v as "LETTER" | "A4")}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-37.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="LETTER">Tamaño Carta</SelectItem>
                <SelectItem value="A4">Tamaño A4</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="default"
            className="bg-blue-600 text-white hover:cursor-pointer hover:bg-blue-700"
            onClick={() => window.print()}
            disabled={loading}
          >
            <Printer />
            Imprimir
          </Button>
        </div>
        <Button
          variant="default"
          className="bg-zinc-900 text-white hover:cursor-pointer hover:bg-zinc-800"
          onClick={onClose}
        >
          <X />
          Cerrar Ventana
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface MovementCardProps {
  movement: AccountMovement;
  onClick?: () => void;
}

const MovementCard = ({ movement, onClick }: MovementCardProps) => {
  const isCharge = movement.kind === "CHARGE";
  const tone = isCharge
    ? {
        icon: "bg-red-500/10 text-red-500",
        amount: "text-red-500",
        badge: "bg-red-500/10 text-red-500",
      }
    : movement.kind === "REFUND"
      ? {
          icon: "bg-blue-500/10 text-blue-500",
          amount: "text-blue-500",
          badge: "bg-blue-500/10 text-blue-500",
        }
      : {
          icon: "bg-green-500/10 text-green-500",
          amount: "text-green-500",
          badge: "bg-green-500/10 text-green-500",
        };

  const Wrapper = isCharge && onClick ? "button" : "div";

  return (
    <Wrapper
      type={Wrapper === "button" ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-left sm:gap-3",
        isCharge &&
          onClick &&
          "cursor-pointer transition-colors hover:border-red-500/50 hover:bg-red-500/5",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          tone.icon,
        )}
      >
        {isCharge ? (
          <ShoppingCart />
        ) : movement.kind === "REFUND" ? (
          <ArrowUp />
        ) : (
          <ArrowDown />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{movement.date}</p>
        <p className="truncate text-sm font-medium">{movement.description}</p>
      </div>
      <div className="ml-auto max-w-full text-right">
        <p className={cn("font-bold tabular-nums", tone.amount)}>
          {movement.kind === "REFUND"
            ? mxn.format(movement.amount)
            : isCharge
              ? `-${mxn.format(movement.amount)}`
              : `+${mxn.format(movement.amount)}`}
        </p>
        <Badge className={cn("mt-1", tone.badge)}>
          {isCharge
            ? "CARGO"
            : movement.kind === "REFUND"
              ? "REEMBOLSO"
              : methodLabel(movement.method)}
        </Badge>
      </div>
    </Wrapper>
  );
};
