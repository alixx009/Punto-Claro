import { useEffect, useState } from "react";
import { FileText, Loader2, Printer } from "lucide-react";
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
import { getSettings } from "@/config/settings";
import type { TicketPayload } from "../../../../shared/ipc";
import {
  formatMoney,
  formatQuantity,
  formatSaleDate,
  formatSaleTime,
  paymentLabel,
} from "./format";
import type { PrintFeedback } from "./useSaleDocuments";

interface Props {
  open: boolean;
  payload: TicketPayload | null;
  printing: boolean;
  feedback: PrintFeedback | null;
  onClose: () => void;
  onPrint: () => void;
}

export function SaleNoteDialog({
  open,
  payload,
  printing,
  feedback,
  onClose,
  onPrint,
}: Props) {
  const settings = getSettings();
  const logoPath = settings.business.logoPath;
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLogo(null);
    if (open && logoPath)
      void window.api.images
        .read(logoPath)
        .then((value) => {
          if (current) setLogo(value);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [open, logoPath]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key === "F7" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        if (!printing && !event.repeat) onPrint();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, printing, onPrint]);

  if (!payload) return null;
  const {
    store,
    sale,
    customer,
    attendedBy,
    payments,
    items,
    subtotal,
    discount,
    total,
    creditAmount,
    change,
  } = payload;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-4 sm:max-w-4xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-start gap-2">
            <FileText className="size-5 shrink-0" aria-hidden="true" />
            DOCUMENTO DIGITAL: Nota de Venta
          </DialogTitle>
          <DialogDescription>
            <span className="sales-history-success">
              Esc para cerrar · F7 para imprimir
            </span>
            <span className="ml-2">Hoja tamaño carta</span>
          </DialogDescription>
        </DialogHeader>
        {feedback && (
          <Alert
            variant={feedback.kind === "error" ? "destructive" : "default"}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            <AlertDescription>{feedback.text}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground sm:hidden">
          Desliza el documento horizontalmente para consultar la hoja completa.
        </p>
        <div
          className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md bg-muted p-2 sm:p-4"
          tabIndex={0}
          role="region"
          aria-label="Vista previa de la nota de venta; desplazamiento horizontal y vertical"
        >
          <article
            className="sales-note-paper mx-auto flex min-h-[650px] w-[760px] shrink-0 flex-col gap-7 p-9 shadow-sm"
            aria-label={`Nota de venta ${sale.folio}`}
          >
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex max-w-sm items-start gap-4">
                {logo && (
                  <img
                    src={logo}
                    alt="Logotipo del negocio"
                    className="max-h-16 max-w-20 object-contain"
                  />
                )}
                <div className="flex flex-col gap-1">
                  <h2 className="break-words text-xl font-bold">
                    {store.name}
                  </h2>
                  {store.address && (
                    <p className="whitespace-pre-line text-xs">
                      {store.address}
                    </p>
                  )}
                  {store.phone && <p className="text-xs">Tel. {store.phone}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline">NOTA DE VENTA</Badge>
                <p className="font-mono text-xl font-bold tabular-nums">
                  {sale.folio}
                </p>
              </div>
            </header>
            <Separator />
            {payload.returns && (
              <section
                className="rounded-md border p-3 text-sm"
                aria-label="Devolución registrada"
              >
                <p className="font-semibold">
                  {payload.returns.state === "FULL"
                    ? "VENTA DEVUELTA"
                    : "DEVOLUCIÓN PARCIAL"}
                </p>
                <p>Importe devuelto: {formatMoney(payload.returns.amount)}</p>
                {payload.returns.refunded > 0 && (
                  <p>Reembolsado: {formatMoney(payload.returns.refunded)}</p>
                )}
                {payload.returns.debtReduced > 0 && (
                  <p>
                    Deuda reducida: {formatMoney(payload.returns.debtReduced)}
                  </p>
                )}
              </section>
            )}
            <section
              className="grid grid-cols-2 gap-5 text-sm"
              aria-label="Datos de la venta"
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Cliente / Receptor
                </p>
                <p className="font-semibold">
                  {customer?.name || "Cliente General"}
                </p>
                {customer?.code && (
                  <p className="text-xs">Código: {customer.code}</p>
                )}
                {settings.ticket.showCashierName && attendedBy?.trim() && (
                  <p className="text-xs">Quién atendió: {attendedBy.trim()}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Emisión
                </p>
                <p className="tabular-nums">
                  {formatSaleDate(sale.createdAt)} ·{" "}
                  {formatSaleTime(sale.createdAt)}
                </p>
              </div>
            </section>
            <section
              className="flex flex-col gap-2 rounded-md border p-3 text-sm"
              aria-label="Métodos de pago"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Método de pago · montos recibidos
              </h3>
              {payments.map((payment, index) => (
                <p key={index} className="flex justify-between gap-4">
                  <span>{paymentLabel(payment.method)}</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(payment.amount)}
                  </span>
                </p>
              ))}
              {creditAmount > 0 && (
                <p className="flex justify-between gap-4">
                  <span>Crédito / Fiar</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(creditAmount)}
                  </span>
                </p>
              )}
              {payments.length === 0 && creditAmount === 0 && (
                <p>No hay datos de pago registrados.</p>
              )}
              {change > 0 && (
                <p className="flex justify-between gap-4 text-xs">
                  <span>Cambio entregado</span>
                  <span className="tabular-nums">{formatMoney(change)}</span>
                </p>
              )}
            </section>
            {items.length === 0 ? (
              <Alert>
                <AlertTitle>
                  {payload.returns
                    ? "Todos los artículos fueron devueltos"
                    : "Detalle de artículos no disponible"}
                </AlertTitle>
                <AlertDescription>
                  {payload.returns
                    ? "La venta se conserva como constancia de su devolución completa."
                    : "Esta venta histórica no contiene artículos guardados. Los importes corresponden al registro original."}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <caption className="sr-only">
                    Artículos de la nota de venta
                  </caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="py-3 pr-3 text-left">
                        CANT.
                      </th>
                      <th scope="col" className="py-3 pr-3 text-left">
                        DESCRIPCIÓN DEL ARTÍCULO
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap py-3 pr-3 text-right"
                      >
                        PRECIO UNIT.
                      </th>
                      <th scope="col" className="py-3 text-right">
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 pr-3 tabular-nums">
                          {formatQuantity(item.quantity)}
                          {item.unit === "KG" ? " kg" : ""}
                        </td>
                        <td className="min-w-36 py-3 pr-3 break-words">
                          {item.productName}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3 text-right tabular-nums">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="whitespace-nowrap py-3 text-right font-medium tabular-nums">
                          {formatMoney(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <section
              className="grid grid-cols-[1fr_240px] gap-6"
              aria-label="Totales y condiciones"
            >
              <div className="flex flex-col gap-2 text-xs">
                {settings.ticket.terms && (
                  <>
                    <h3 className="font-semibold">Términos y condiciones</h3>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {settings.ticket.terms}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <p className="flex justify-between gap-3 text-sm">
                  <span>SUBTOTAL</span>
                  <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </p>
                {discount > 0 && (
                  <p className="flex justify-between gap-3 text-sm">
                    <span>DESCUENTO</span>
                    <span className="tabular-nums">
                      −{formatMoney(discount)}
                    </span>
                  </p>
                )}
                <Separator />
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold">TOTAL NETO</span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatMoney(total)}
                  </span>
                </p>
                {creditAmount > 0 && (
                  <p className="text-xs">
                    Importe original a crédito: {formatMoney(creditAmount)}
                  </p>
                )}
              </div>
            </section>
            <footer className="mt-auto grid grid-cols-2 gap-8 pt-14 text-center text-xs">
              <div className="flex flex-col gap-2">
                <Separator />
                <p>CLIENTE</p>
              </div>
              <div className="flex flex-col gap-2">
                <Separator />
                <p>SELLO / FIRMA SUCURSAL</p>
              </div>
            </footer>
          </article>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cerrar Preview
          </Button>
          <Button
            className="sales-history-print-action min-w-0 whitespace-normal"
            onClick={onPrint}
            disabled={printing || (items.length === 0 && !payload.returns)}
          >
            {printing ? (
              <Loader2
                className="animate-spin motion-reduce:animate-none"
                data-icon="inline-start"
              />
            ) : (
              <Printer data-icon="inline-start" />
            )}
            {printing ? "Preparando impresión…" : "Imprimir Nota de Venta"}
            <kbd className="rounded border border-current/25 px-1 font-mono text-[10px]">
              F7
            </kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
