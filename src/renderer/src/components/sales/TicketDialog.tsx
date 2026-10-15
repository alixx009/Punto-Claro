import { useEffect, useState } from "react";
import { FileText, Printer, X } from "lucide-react";
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
import { storeContact, storeName } from "@/config/store";
import { getSettings, type TicketSettings } from "@/config/settings";
import { TicketDivider } from "./TicketDivider";
import { TicketItems } from "./TicketItems";
import type { PaymentMethod, TicketPayload } from "../../../../shared/ipc";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const STORE_INFO = {
  name: storeName,
  address: storeContact.address,
  phone: storeContact.phone,
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  DEBIT: "T. Débito",
  CREDIT: "T. Crédito",
  TRANSFER: "Transferencia",
  VOUCHER: "Vale",
  OTHER: "Otro",
};

function methodLabel(method: PaymentMethod): string {
  return METHOD_LABELS[method] ?? method;
}

function useAppTimezone(): string {
  const [tz, setTz] = useState<string>("America/Mazatlan");
  useEffect(() => {
    void window.api.app
      .getTimezone()
      .then((serverTz) => {
        if (serverTz) setTz(serverTz);
      })
      .catch(() => {});
  }, []);
  return tz;
}

function parseSQLiteAsLocalInTz(iso: string, tz: string): Date {
  // SQLite devuelve "YYYY-MM-DD HH:MM:SS" sin marcador de zona.
  // Interpretamos esa cadena como hora local de `tz` y devolvemos el Date UTC equivalente.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return new Date(iso);
  const [, y, mo, d, h, mi, s] = m;
  const naiveUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const probe = new Date(naiveUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(probe);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const tzAsUtc = Date.UTC(
    +get("year"),
    +get("month") - 1,
    +get("day"),
    +get("hour") === 24 ? 0 : +get("hour"),
    +get("minute"),
    +get("second"),
  );
  const offset = naiveUtc - tzAsUtc;
  return new Date(naiveUtc + offset);
}

function formatDate(iso: string, tz: string): string {
  const d = parseSQLiteAsLocalInTz(iso, tz);
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

function formatTime(iso: string, tz: string): string {
  const d = parseSQLiteAsLocalInTz(iso, tz);
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  return `${parts.find((p) => p.type === "hour")?.value ?? ""}:${parts.find((p) => p.type === "minute")?.value ?? ""}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function TicketPreview({
  payload,
  tz,
  design,
  logoSrc,
}: {
  payload: TicketPayload;
  tz: string;
  design: TicketSettings;
  logoSrc: string | null;
}) {
  const {
    sale,
    items,
    payments,
    subtotal,
    total,
    change,
    creditAmount,
    customer,
    attendedBy,
    store,
  } = payload;
  const margins = getSettings().printerMargins;
  const previewWidth = design.paperWidth === 58 ? 270 : 360;
  const pixelsPerMm = previewWidth / design.paperWidth;

  return (
    <div
      className={`mx-auto w-full rounded-md border bg-card p-4 font-mono text-foreground shadow-sm ${design.template === "framed" ? "border-2 border-foreground" : "border-border"}`}
      style={{
        maxWidth: previewWidth,
        fontSize: `${design.fontSize}px`,
        padding: `${margins.topMm * pixelsPerMm}px ${margins.rightMm * pixelsPerMm}px ${margins.bottomMm * pixelsPerMm}px ${margins.leftMm * pixelsPerMm}px`,
        lineHeight: design.template === "compact" ? 1.3 : 1.5,
      }}
    >
      <div className="text-center">
        {design.showLogo && logoSrc && (
          <img
            src={logoSrc}
            alt="Logotipo del negocio"
            className="mx-auto mb-2 max-h-14 max-w-24 object-contain"
          />
        )}
        <p className="text-sm font-bold uppercase tracking-wide">
          {store.name}
        </p>
        {store.address && <p className="text-[11px]">{store.address}</p>}
        {store.phone && <p className="text-[11px]">{store.phone}</p>}
      </div>

      <TicketDivider template={design.template} />

      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="font-bold">FOLIO DE VENTA:</span>
          <span className="tabular-nums">{sale.folio}</span>
        </div>
        <div className="flex justify-between">
          <span>FECHA:</span>
          <span className="tabular-nums">{formatDate(sale.createdAt, tz)}</span>
        </div>
        <div className="flex justify-between">
          <span>HORA:</span>
          <span className="tabular-nums">{formatTime(sale.createdAt, tz)}</span>
        </div>
        {design.showCashierName && attendedBy?.trim() && (
          <div className="flex justify-between gap-2">
            <span>CAJERO:</span>
            <span className="break-words text-right">{attendedBy.trim()}</span>
          </div>
        )}
        {customer && (
          <div className="flex justify-between gap-2">
            <span>CLIENTE:</span>
            <span className="truncate">{truncate(customer.name, 24)}</span>
          </div>
        )}
      </div>

      <TicketDivider template={design.template} />

      {payload.returns && (
        <div className="mb-2 flex flex-col gap-1 text-center">
          <p className="font-bold">
            {payload.returns.state === "FULL"
              ? "VENTA DEVUELTA"
              : "DEVOLUCIÓN PARCIAL"}
          </p>
          <p>Importe devuelto: {mxn.format(payload.returns.amount)}</p>
          {payload.returns.refunded > 0 && (
            <p>Reembolsado: {mxn.format(payload.returns.refunded)}</p>
          )}
          {payload.returns.debtReduced > 0 && (
            <p>Deuda reducida: {mxn.format(payload.returns.debtReduced)}</p>
          )}
        </div>
      )}
      {items.length > 0 ? (
        <TicketItems
          items={items}
          showAmount={design.showAmount}
          compact={design.template === "compact"}
        />
      ) : payload.returns ? (
        <p className="text-center">Todos los artículos fueron devueltos.</p>
      ) : null}

      <TicketDivider template={design.template} />

      <div className="space-y-0.5">
        {subtotal !== total && (
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="tabular-nums">{mxn.format(subtotal)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL NETO:</span>
          <span className="tabular-nums">{mxn.format(total)}</span>
        </div>
      </div>

      {(payments.length > 0 || creditAmount > 0 || change > 0) && (
        <>
          <TicketDivider template={design.template} />
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Métodos de cobro:
            </p>
            {payments.map((p, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{methodLabel(p.method)}:</span>
                <span className="tabular-nums">{mxn.format(p.amount)}</span>
              </div>
            ))}
            {creditAmount > 0 && (
              <div className="flex justify-between">
                <span>Crédito tienda:</span>
                <span className="tabular-nums">{mxn.format(creditAmount)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between">
                <span>Cambio:</span>
                <span className="tabular-nums">{mxn.format(change)}</span>
              </div>
            )}
          </div>
        </>
      )}

      <TicketDivider template={design.template} />
      <div className="flex flex-col gap-1 text-center text-[0.9em] text-muted-foreground">
        {design.thanks && <p>{design.thanks}</p>}
        {design.invoiceMessage && <p>{design.invoiceMessage}</p>}
        {design.terms && <p>{design.terms}</p>}
      </div>
    </div>
  );
}

export function TicketDialog({
  open,
  onOpenChange,
  payload,
  onPrint,
  printing,
  printDisabled = false,
  printFeedback,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payload: TicketPayload | null;
  onPrint: () => void;
  printing: boolean;
  printDisabled?: boolean;
  printFeedback: { kind: "success" | "error"; text: string } | null;
}) {
  const tz = useAppTimezone();
  const design = getSettings().ticket;
  const logoPath = getSettings().business.logoPath;
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!logoPath) {
      setLogoSrc(null);
      return;
    }
    let current = true;
    void window.api.images.read(logoPath).then((image) => {
      if (current) setLogoSrc(image);
    });
    return () => {
      current = false;
    };
  }, [logoPath]);
  useEffect(() => {
    if (!open || !payload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F7" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!e.repeat && !printing && !printDisabled) onPrint();
        return;
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, payload, onOpenChange, onPrint, printing, printDisabled]);

  if (!payload) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex min-h-0 flex-col gap-4 p-4 sm:max-w-md sm:gap-5 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Ticket de Venta
          </DialogTitle>
          <DialogDescription>
            Vista previa del comprobante generado para la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-semibold">
              Esc
            </span>
            para cerrar · F7 para imprimir.
          </span>
          <span className="ml-auto inline-block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            SUMA POS v1.0
          </span>
        </div>

        {printFeedback && (
          <div
            role={printFeedback.kind === "error" ? "alert" : "status"}
            className={
              printFeedback.kind === "error"
                ? "shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                : "shrink-0 rounded-md border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700"
            }
          >
            {printFeedback.text}
          </div>
        )}

        <div className="min-h-20 max-h-[55dvh] min-w-0 shrink overflow-auto rounded-md bg-muted/20 p-2 sm:p-3">
          <TicketPreview
            payload={payload}
            tz={tz}
            design={design}
            logoSrc={logoSrc}
          />
        </div>

        <Separator />

        <DialogFooter className="shrink-0 gap-2">
          <Button
            variant="outline"
            className="hover:cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            <X />
            Cerrar Preview
          </Button>
          <Button
            className="hover:cursor-pointer"
            onClick={onPrint}
            disabled={printing || printDisabled}
          >
            <Printer />
            {printing ? "Enviando…" : "Imprimir ticket"}
            <kbd className="rounded border border-current/25 px-1.5 py-0.5 font-mono text-[10px]">
              F7
            </kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function buildTicketPayload(args: {
  sale: { id: number; folio: string; createdAt: string; status: string };
  items: Array<{
    productName: string;
    unit: TicketPayload["items"][number]["unit"];
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{ method: PaymentMethod; amount: number }>;
  subtotal: number;
  total: number;
  discount?: number;
  creditAmount: number;
  change: number;
  customer: { name: string; code: string } | null;
  attendedBy?: string | null;
}): TicketPayload {
  const business = getSettings().business;
  return {
    sale: {
      id: args.sale.id,
      folio: args.sale.folio,
      createdAt: args.sale.createdAt,
      status: args.sale.status as TicketPayload["sale"]["status"],
    },
    items: args.items,
    payments: args.payments,
    subtotal: args.subtotal,
    total: args.total,
    discount: args.discount ?? 0,
    creditAmount: args.creditAmount,
    change: args.change,
    customer: args.customer,
    attendedBy: args.attendedBy ?? null,
    store: {
      name: business.name || STORE_INFO.name,
      address: business.address,
      phone: business.phone,
    },
  };
}
