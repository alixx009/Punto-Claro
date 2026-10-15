import { Box, Info, Loader2, Plus, X } from "lucide-react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RefundMethod } from "../../../../shared/ipc";
import { formatMoney, formatQuantity } from "./format";
import type { useSaleReturns } from "./useSaleReturns";

export function SaleReturnDialog({
  returns,
}: {
  returns: ReturnType<typeof useSaleReturns>;
}) {
  const { detail, selected, submitting, loading, plan } = returns;
  const hasRemaining =
    detail?.items.some((item) => item.soldQuantity > item.returnedQuantity) ??
    false;
  return (
    <Dialog
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) returns.close();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={!submitting}
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submitting) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b bg-muted/25 px-4 py-4 text-left sm:px-6 sm:py-5">
          <DialogTitle className="flex items-start gap-3 pr-6">
            <Box className="size-5 shrink-0 text-destructive" />
            Gestionar Reembolsos o Devolución
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase tracking-wide">
            Ticket relacionado: {selected?.folio}
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
          aria-busy={loading || submitting}
        >
          <Alert>
            <Info />
            <AlertTitle className="line-clamp-none">
              Reglas de devolución de tienda
            </AlertTitle>
            <AlertDescription>
              Selecciona los productos recibidos en buen estado. Al confirmar,
              volverán al inventario y se descontarán del ticket. El botón ×
              reduce la cantidad; + la aumenta.
            </AlertDescription>
          </Alert>
          {loading ? (
            <div
              className="flex flex-col gap-3"
              aria-label="Cargando productos de la venta"
            >
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : detail ? (
            <>
              <div className="min-w-0 shrink-0 overflow-hidden rounded-xl border">
                <Table
                  className="block md:table"
                  aria-label="Productos de la venta y cantidades a devolver"
                >
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow className="bg-muted/35">
                      <TableHead className="min-w-48 pl-4 text-xs">
                        NOMBRE COMERCIAL
                      </TableHead>
                      <TableHead className="text-center text-xs">
                        VENDIDO
                      </TableHead>
                      <TableHead className="text-center text-xs">
                        RETORNADO
                      </TableHead>
                      <TableHead className="pr-4 text-center text-xs">
                        PENDIENTE A<br />
                        DEVOLUCIÓN
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="block md:table-row-group">
                    {detail.items.map((item) => {
                      const remaining =
                        Math.round(
                          (item.soldQuantity - item.returnedQuantity) * 1000,
                        ) / 1000;
                      const raw = returns.quantities[item.id] ?? "0";
                      const value = Number(raw.replace(",", "."));
                      const valid =
                        Number.isFinite(value) &&
                        value >= 0 &&
                        value <= remaining &&
                        (item.unit === "KG"
                          ? Math.abs(value * 1000 - Math.round(value * 1000)) <
                            1e-7
                          : Number.isInteger(value));
                      const step = item.unit === "KG" ? 0.1 : 1;
                      function adjust(direction: number) {
                        const current = valid ? value : 0;
                        returns.changeQuantity(
                          item.id,
                          String(
                            Math.round(
                              Math.max(
                                0,
                                Math.min(remaining, current + direction * step),
                              ) * 1000,
                            ) / 1000,
                          ),
                        );
                      }
                      return (
                        <TableRow
                          key={item.id}
                          className={
                            remaining === 0
                              ? "grid grid-cols-2 bg-muted/20 md:table-row"
                              : "grid grid-cols-2 md:table-row"
                          }
                        >
                          <TableCell className="col-span-2 block min-w-0 px-4 pt-4 pb-2 md:table-cell md:py-4">
                            <p className="max-w-80 whitespace-normal break-words text-sm font-semibold leading-snug">
                              {item.productName}
                            </p>
                            <p className="mt-1.5 break-all font-mono text-xs text-muted-foreground">
                              SKU: {item.sku || "Sin SKU"}
                            </p>
                            {item.unit === "KG" && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Peso en kg · admite hasta 3 decimales
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="block px-4 text-left font-medium tabular-nums md:table-cell md:px-2 md:text-center">
                            <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                              Vendido
                            </span>
                            {formatQuantity(item.soldQuantity)}
                            {item.unit === "KG" ? " kg" : ""}
                          </TableCell>
                          <TableCell className="block px-4 text-left font-medium tabular-nums md:table-cell md:px-2 md:text-center">
                            <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                              Retornado
                            </span>
                            {formatQuantity(item.returnedQuantity)}
                            {item.unit === "KG" ? " kg" : ""}
                          </TableCell>
                          <TableCell className="col-span-2 block px-4 pb-4 md:table-cell md:py-2 md:pl-2">
                            <span className="mb-2 block text-xs text-muted-foreground md:hidden">
                              Cantidad a devolver
                            </span>
                            <div className="flex w-fit items-center gap-1 rounded-lg border bg-background p-1 md:mx-auto">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Disminuir devolución de ${item.productName}`}
                                disabled={submitting || !valid || value <= 0}
                                onClick={() => adjust(-1)}
                              >
                                <X />
                              </Button>
                              <Input
                                type="text"
                                inputMode={
                                  item.unit === "KG" ? "decimal" : "numeric"
                                }
                                className="h-10 w-20 border-0 px-1 text-center font-mono shadow-none md:h-8 md:w-16"
                                aria-label={`Cantidad a devolver de ${item.productName}`}
                                aria-invalid={!valid}
                                value={raw}
                                disabled={submitting || remaining === 0}
                                onChange={(event) =>
                                  returns.changeQuantity(
                                    item.id,
                                    event.target.value,
                                  )
                                }
                                onFocus={(event) => event.target.select()}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "ArrowUp" ||
                                    event.key === "ArrowDown"
                                  ) {
                                    event.preventDefault();
                                    adjust(event.key === "ArrowUp" ? 1 : -1);
                                  }
                                }}
                              />
                              <Button
                                variant="outline"
                                size="icon-sm"
                                aria-label={`Aumentar devolución de ${item.productName}`}
                                disabled={
                                  submitting || !valid || value >= remaining
                                }
                                onClick={() => adjust(1)}
                              >
                                <Plus />
                              </Button>
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground md:text-center">
                              {remaining === 0
                                ? "Devuelto por completo"
                                : `Disponible: ${formatQuantity(remaining)}${item.unit === "KG" ? " kg" : ""}`}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {!hasRemaining && (
                <Alert>
                  <Box />
                  <AlertTitle className="line-clamp-none">
                    Devolución completa registrada
                  </AlertTitle>
                  <AlertDescription>
                    Todos los productos de este ticket ya se devolvieron.
                  </AlertDescription>
                </Alert>
              )}
              {detail.registerSessionId === null && hasRemaining && (
                <Alert variant="destructive">
                  <Info />
                  <AlertTitle className="line-clamp-none">
                    Se necesita una caja abierta
                  </AlertTitle>
                  <AlertDescription>
                    Abre la caja y vuelve a cargar esta venta para registrar la
                    devolución.
                  </AlertDescription>
                </Alert>
              )}
              {plan && (
                <section
                  className="grid gap-4 rounded-xl border bg-muted/25 p-4 sm:grid-cols-2"
                  aria-label="Resumen de devolución"
                >
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-muted-foreground">
                        Valor de lo seleccionado
                      </span>
                      <strong className="tabular-nums">
                        {formatMoney(plan.amount)}
                      </strong>
                    </div>
                    {plan.discount !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        Incluye el descuento proporcional de la venta.
                      </p>
                    )}
                    {plan.debtReduction > 0 && (
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-muted-foreground">
                          Reducción de deuda
                        </span>
                        <strong className="tabular-nums">
                          {formatMoney(plan.debtReduction)}
                        </strong>
                      </div>
                    )}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-medium">Importe a reembolsar</span>
                      <strong className="text-lg tabular-nums">
                        {formatMoney(plan.refundAmount)}
                      </strong>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {returns.selectionCount} productos seleccionados
                    </Badge>
                  </div>
                  {plan.refundAmount > 0 ? (
                    <Field>
                      <FieldLabel htmlFor="sale-refund-method">
                        Método del reembolso
                      </FieldLabel>
                      <Select
                        value={returns.refundMethod}
                        onValueChange={(value) =>
                          returns.setRefundMethod(value as RefundMethod)
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger
                          id="sale-refund-method"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="CASH">Efectivo</SelectItem>
                            <SelectItem value="CARD">
                              Pago con tarjeta
                            </SelectItem>
                            <SelectItem value="TRANSFER">
                              Transferencia
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Registra el método utilizado para entregar el reembolso.
                      </FieldDescription>
                    </Field>
                  ) : (
                    <p className="self-center text-sm text-muted-foreground">
                      {plan.debtReduction > 0
                        ? "La devolución se aplicará al saldo pendiente del cliente."
                        : "Selecciona las cantidades para calcular el importe."}
                    </p>
                  )}
                </section>
              )}
            </>
          ) : null}
          {(returns.error || returns.validation) && (
            <Alert variant="destructive">
              <Info />
              <AlertTitle>No se puede confirmar</AlertTitle>
              <AlertDescription>
                {returns.error || returns.validation}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-muted/25 px-4 py-4 sm:flex-col sm:px-6 lg:flex-row lg:justify-between">
          <Button
            variant="outline"
            className="border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={returns.selectAll}
            disabled={loading || submitting || !hasRemaining}
          >
            <Box data-icon="inline-start" />
            Devolución completa
          </Button>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Button
              variant="outline"
              className="sm:flex-1 lg:flex-none"
              onClick={returns.close}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              className="min-w-0 whitespace-normal sm:flex-1 lg:flex-none"
              onClick={() => void returns.confirm()}
              disabled={
                loading ||
                submitting ||
                !plan ||
                !!returns.validation ||
                returns.selectionCount === 0 ||
                detail?.registerSessionId == null
              }
            >
              {submitting && (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              )}
              {submitting ? "Registrando…" : "Confirmar seleccionados"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
