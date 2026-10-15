import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatKg } from "@/lib/utils";
import { mxn } from "./constants";
import { unitLabel } from "./helpers";
import type { AccountMovement, SaleItem } from "../../../../../shared/ipc";

interface SaleDetailDialogProps {
  movement: AccountMovement | null;
  items: SaleItem[];
  loading: boolean;
  onClose: () => void;
}

export const SaleDetailDialog = ({
  movement,
  items,
  loading,
  onClose,
}: SaleDetailDialogProps) => (
  <Dialog open={movement !== null} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="size-5" />
          Detalle de la Venta
        </DialogTitle>
        <DialogDescription>{movement?.description}</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <SaleMeta
          label="Folio"
          value={movement?.description.split(" · ")[0] ?? "—"}
          mono
        />
        <SaleMeta label="Fecha y Hora" value={movement?.date ?? "—"} />
        <SaleMeta label="Estado" value={movement?.status ?? "—"} bold />
        <SaleMeta
          label="Cargo a cuenta"
          value={movement ? mxn.format(movement.amount) : "—"}
          danger
        />
      </div>

      <div className="max-h-[45dvh] min-w-0 overflow-auto overscroll-contain">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Cargando productos...
          </p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sin productos registrados.
          </p>
        ) : (
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead className="text-right">P. Unitario</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-72 whitespace-normal">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {unitLabel(item.unit)}
                    </p>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {item.unit === "KG"
                      ? formatKg(item.quantity)
                      : item.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {mxn.format(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {mxn.format(item.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {items.length > 0 && (
        <SaleTotals
          subtotal={items.reduce((sum, i) => sum + i.lineTotal, 0)}
          charge={movement ? mxn.format(movement.amount) : "—"}
        />
      )}

      <DialogFooter>
        <Button
          variant="default"
          className="bg-zinc-900 text-white hover:cursor-pointer hover:bg-zinc-800"
          onClick={onClose}
        >
          <X />
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface SaleMetaProps {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  danger?: boolean;
}

const SaleMeta = ({ label, value, mono, bold, danger }: SaleMetaProps) => (
  <div className="min-w-0 rounded-md border border-border bg-card p-2">
    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
      {label}
    </p>
    <p
      className={cn(
        "break-words tabular-nums",
        mono && "font-mono",
        bold && "font-semibold",
        danger && "font-bold text-red-500",
      )}
    >
      {value}
    </p>
  </div>
);

interface SaleTotalsProps {
  subtotal: number;
  charge: string;
}

const SaleTotals = ({ subtotal, charge }: SaleTotalsProps) => (
  <div className="flex justify-end">
    <div className="w-full max-w-xs space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Subtotal productos</span>
        <span className="tabular-nums">{mxn.format(subtotal)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-1 font-bold">
        <span>Cargo a cuenta</span>
        <span className="tabular-nums text-red-500">{charge}</span>
      </div>
    </div>
  </div>
);
