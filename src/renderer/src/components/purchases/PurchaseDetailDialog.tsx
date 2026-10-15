import { AlertCircle, RotateCw } from "lucide-react";
import type { PurchaseDetail } from "../../../../shared/purchases";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatMoney,
  formatQuantity,
  formatSaleDate,
  formatSaleTime,
} from "@/components/sales-history/format";
import { purchaseUnitLabel } from "./purchaseUtils";

export function PurchaseDetailDialog({
  purchase,
  loading,
  error,
  onClose,
  onRetry,
  restoreFocus,
}: {
  purchase: PurchaseDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  restoreFocus: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-4 sm:max-w-4xl sm:p-6"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Detalle de compra{purchase ? ` ${purchase.folio}` : ""}
          </DialogTitle>
          <DialogDescription>
            Consulta los productos, cantidades y costos registrados en esta
            entrada.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto [&>[data-slot=table-container]]:shrink-0">
          {loading ? (
            <div
              className="flex flex-col gap-3"
              role="status"
              aria-label="Cargando detalle de compra"
            >
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>No se pudo cargar la compra</AlertTitle>
              <AlertDescription>
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-fit"
                  onClick={onRetry}
                >
                  <RotateCw data-icon="inline-start" />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : purchase ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">Proveedor</p>
                  <p className="break-words font-semibold">
                    {purchase.supplierName}
                  </p>
                  <Badge variant="secondary">Compra manual</Badge>
                </div>
                <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Registro</dt>
                  <dd className="text-right">
                    {formatSaleDate(purchase.createdAt)} ·{" "}
                    {formatSaleTime(purchase.createdAt)}
                  </dd>
                  <dt className="text-muted-foreground">Registró</dt>
                  <dd className="break-words text-right">
                    {purchase.performedByName}
                  </dd>
                </dl>
              </div>
              <Separator />
              <Table className="min-w-140">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium">{item.productName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          SKU: {item.sku || "Sin SKU"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(item.quantity)}{" "}
                        {purchaseUnitLabel[item.unit]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.unitCost)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {purchase.items.length} conceptos registrados
                </p>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Inversión total
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatMoney(purchase.total)}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar detalle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
