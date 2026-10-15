import { useEffect, useRef, useState } from "react";
import { getSettings } from "@/config/settings";
import type { SalesHistoryDetail, TicketPayload } from "../../../../shared/ipc";

export type DocumentFormat = "ticket" | "note";
export type PrintFeedback = { kind: "success" | "error"; text: string };

export function useSaleDocuments() {
  const [detail, setDetail] = useState<SalesHistoryDetail | null>(null);
  const [format, setFormat] = useState<DocumentFormat | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [feedback, setFeedback] = useState<PrintFeedback | null>(null);
  const request = useRef(0);
  const printBusy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);

  async function open(saleId: number, target: DocumentFormat) {
    const token = ++request.current;
    setLoadingId(saleId);
    setError(null);
    setFeedback(null);
    try {
      const data = await window.api.sales.detail(saleId);
      if (!mounted.current || token !== request.current) return;
      if (!data) throw new Error("Sale unavailable");
      setDetail(data);
      setFormat(target);
    } catch {
      if (mounted.current && token === request.current)
        setError(
          "No se pudo recuperar la venta. Actualiza el historial e inténtalo de nuevo.",
        );
    } finally {
      if (mounted.current && token === request.current) setLoadingId(null);
    }
  }

  function close() {
    request.current += 1;
    setFormat(null);
    setDetail(null);
    setFeedback(null);
    setLoadingId(null);
  }

  const business = getSettings().business;
  const payload: TicketPayload | null = detail
    ? {
        ...detail.payload,
        store: detail.reconstructed
          ? {
              name: business.name,
              address: business.address,
              phone: business.phone,
            }
          : detail.payload.store,
      }
    : null;

  async function print() {
    if (!detail || !format || printBusy.current) return;
    if (detail.payload.items.length === 0 && !detail.payload.returns) {
      setFeedback({
        kind: "error",
        text: "Esta venta histórica no tiene artículos guardados. No se puede imprimir un comprobante incompleto.",
      });
      return;
    }
    printBusy.current = true;
    setPrinting(true);
    setFeedback(null);
    const token = request.current;
    const selected = detail;
    const settings = getSettings();
    try {
      if (format === "ticket") {
        if (!settings.printerName)
          throw new Error(
            "Selecciona una impresora en Administración > Ajustes > Configuración de impresora.",
          );
        let ticketId = selected.ticketId;
        if (ticketId === null) {
          const recovered = await window.api.sales.ensureTicket({
            saleId: selected.sale.id,
            store: {
              name: settings.business.name,
              address: settings.business.address,
              phone: settings.business.phone,
            },
          });
          ticketId = recovered.id;
          if (mounted.current && token === request.current)
            setDetail({
              ...selected,
              ticketId,
              payload: recovered.payload,
              reconstructed: false,
            });
        }
        await window.api.printers.printSale({
          ticketId,
          printerName: settings.printerName,
          settings: settings.ticket,
          margins: settings.printerMargins,
          logoPath: settings.business.logoPath,
        });
        if (mounted.current && token === request.current)
          setFeedback({
            kind: "success",
            text: "Ticket enviado a la cola de impresión.",
          });
      } else {
        const result = await window.api.printers.printNote({
          saleId: selected.sale.id,
          store: {
            name: settings.business.name,
            address: settings.business.address,
            phone: settings.business.phone,
          },
          logoPath: settings.business.logoPath,
          terms: settings.ticket.terms,
          showCashierName: settings.ticket.showCashierName,
        });
        if (mounted.current && token === request.current)
          setFeedback({
            kind: "success",
            text: result.printed
              ? "Nota enviada a la cola de impresión."
              : "Impresión cancelada.",
          });
      }
    } catch (cause) {
      if (mounted.current && token === request.current)
        setFeedback({
          kind: "error",
          text:
            cause instanceof Error
              ? cause.message
              : "No se pudo imprimir. Revisa la impresora e inténtalo de nuevo.",
        });
    } finally {
      printBusy.current = false;
      if (mounted.current) setPrinting(false);
    }
  }

  return {
    detail,
    payload,
    format,
    loadingId,
    error,
    printing,
    feedback,
    open,
    close,
    print,
  };
}
