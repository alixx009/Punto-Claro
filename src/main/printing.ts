import { BrowserWindow, type WebContents } from "electron";
import { isValidPrinterMargins } from "../shared/ipc";
import type {
  PrintSaleTicketInput,
  PrintSaleNoteInput,
  PrintNoteResult,
  PrintTestTicketInput,
  SystemPrinter,
  TicketPrintSettings,
  TicketTemplate,
} from "../shared/ipc";
import { getTicket } from "./db/tickets";
import { readImage } from "./files/images";
import { renderSaleTicketHtml } from "./ticket-html";
import { renderSaleNoteHtml } from "./sale-note-html";
import {
  getSaleHistoryDetail,
  validateDocumentStore,
} from "./db/sales-history";

const templates: TicketTemplate[] = [
  "classic",
  "modern",
  "compact",
  "framed",
  "multiline",
];

function normalizePrintSettings(
  settings: TicketPrintSettings,
): TicketPrintSettings {
  if (!settings || ![58, 80].includes(settings.paperWidth)) {
    throw new Error("Configura un ancho de papel válido en Diseño de ticket.");
  }
  return {
    template: templates.includes(settings.template)
      ? settings.template
      : "classic",
    paperWidth: settings.paperWidth,
    fontSize: Number.isFinite(settings.fontSize)
      ? Math.max(9, Math.min(18, Math.round(settings.fontSize)))
      : 11,
    showLogo: settings.showLogo === true,
    showCashierName: settings.showCashierName === true,
    showAmount: settings.showAmount === true,
    thanks:
      typeof settings.thanks === "string" ? settings.thanks.slice(0, 500) : "",
    invoiceMessage:
      typeof settings.invoiceMessage === "string"
        ? settings.invoiceMessage.slice(0, 500)
        : "",
    terms:
      typeof settings.terms === "string" ? settings.terms.slice(0, 2000) : "",
  };
}

export async function listSystemPrinters(
  contents: WebContents,
): Promise<SystemPrinter[]> {
  const printers = await contents.getPrintersAsync();
  return printers.map(({ name, displayName, description }) => ({
    name,
    displayName: displayName || name,
    description,
  }));
}

export async function printTestTicket(
  contents: WebContents,
  input: PrintTestTicketInput,
): Promise<void> {
  if (
    !input ||
    typeof input.printerName !== "string" ||
    ![58, 80].includes(input.paperWidth)
  ) {
    throw new Error("Selecciona una impresora y un ancho de papel válidos.");
  }
  if (!isValidPrinterMargins(input.margins)) {
    throw new Error("Configura márgenes válidos antes de imprimir.");
  }

  const printers = await listSystemPrinters(contents);
  if (!printers.some((printer) => printer.name === input.printerName)) {
    throw new Error(
      "La impresora seleccionada ya no está disponible en Windows.",
    );
  }

  const width = input.paperWidth;
  const date = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const html = `<!doctype html>
    <html lang="es"><head><meta charset="utf-8" />
    <style>
      @page { margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { width: ${width}mm; color: #000; font: 11px/1.45 monospace; }
      #receipt { width: ${width}mm; padding: ${input.margins.topMm}mm ${input.margins.rightMm}mm ${input.margins.bottomMm}mm ${input.margins.leftMm}mm; }
      h1 { margin: 0; font-size: 16px; text-align: center; }
      p { margin: 4px 0; }
      .center { text-align: center; }
      .rule { border-top: 1px dashed #000; margin: 10px 0; }
    </style></head><body><div id="receipt">
      <h1>SUMA POS</h1>
      <p class="center">Prueba de impresora</p>
      <div class="rule"></div>
      <p>Fecha: ${date}</p>
      <p>Ancho configurado: ${width} mm</p>
      <div class="rule"></div>
      <p class="center">Si puedes leer este ticket,<br>la impresión está configurada.</p>
    </div></body></html>`;

  await printHtmlTicket(html, width, input.printerName);
}

export async function printSaleTicket(
  contents: WebContents,
  input: PrintSaleTicketInput,
): Promise<void> {
  if (!input || !Number.isSafeInteger(input.ticketId) || input.ticketId <= 0) {
    throw new Error("No se encontró un ticket válido para imprimir.");
  }
  if (typeof input.printerName !== "string" || !input.printerName.trim()) {
    throw new Error("Selecciona una impresora en Administración > Ajustes.");
  }

  const settings = normalizePrintSettings(input.settings);
  if (!isValidPrinterMargins(input.margins)) {
    throw new Error("Configura márgenes válidos antes de imprimir.");
  }
  const printers = await listSystemPrinters(contents);
  if (!printers.some((printer) => printer.name === input.printerName)) {
    throw new Error(
      "La impresora guardada no está disponible en Windows. Revísala en Administración > Ajustes.",
    );
  }

  const ticket = getTicket(input.ticketId);
  if (!ticket) throw new Error("El ticket ya no está disponible.");

  let logoDataUrl: string | null = null;
  if (
    settings.showLogo &&
    typeof input.logoPath === "string" &&
    input.logoPath
  ) {
    const image = await readImage(input.logoPath);
    if (image && /^data:image\/(png|jpeg|webp|gif);base64,/.test(image))
      logoDataUrl = image;
  }

  const html = renderSaleTicketHtml(
    ticket.payload,
    settings,
    input.margins,
    logoDataUrl,
  );
  await printHtmlTicket(html, settings.paperWidth, input.printerName);
}

async function printHtmlTicket(
  html: string,
  paperWidth: 58 | 80,
  printerName: string,
): Promise<void> {
  const printWindow = new BrowserWindow({
    show: false,
    width: 600,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );
    const heightPx = (await printWindow.webContents.executeJavaScript(
      'Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined))).then(() => document.getElementById("receipt")?.getBoundingClientRect().height ?? 0)',
    )) as number;
    if (!Number.isFinite(heightPx) || heightPx <= 0) {
      throw new Error("No se pudo preparar el contenido del ticket.");
    }
    // El controlador POS-58 admite formatos desde unos 20 mm de longitud.
    // El redondeo a décimas evita recortes sin añadir un margen fijo al final.
    const heightMm = Math.max(
      21,
      Math.ceil(((heightPx * 25.4) / 96) * 10) / 10,
    );
    if (heightMm > 3100) {
      throw new Error(
        "El ticket es demasiado largo para el formato de la impresora.",
      );
    }

    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          pageSize: {
            width: paperWidth * 1000,
            height: Math.round(heightMm * 1000),
          },
          margins: { marginType: "none" },
          printBackground: false,
          color: false,
          header: "",
          footer: "",
        },
        (success, failureReason) => {
          if (success) resolve();
          else
            reject(
              new Error(
                failureReason || "Windows no aceptó el trabajo de impresión.",
              ),
            );
        },
      );
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
}

export async function printSaleNote(
  contents: WebContents,
  input: PrintSaleNoteInput,
): Promise<PrintNoteResult> {
  if (!input || !Number.isSafeInteger(input.saleId) || input.saleId <= 0)
    throw new Error("Selecciona una venta válida para imprimir.");
  const store = validateDocumentStore(input.store);
  if (
    typeof input.terms !== "string" ||
    input.terms.length > 2000 ||
    typeof input.logoPath !== "string"
  ) {
    throw new Error("Los parámetros de la nota de venta no son válidos.");
  }
  const detail = getSaleHistoryDetail(input.saleId);
  if (!detail) throw new Error("La venta ya no está disponible.");
  if (detail.payload.items.length === 0 && !detail.payload.returns)
    throw new Error(
      "Esta venta histórica no tiene artículos guardados para imprimir una nota.",
    );
  const payload = {
    ...detail.payload,
    store: detail.reconstructed ? store : detail.payload.store,
  };
  let logo: string | null = null;
  if (input.logoPath) {
    const image = await readImage(input.logoPath);
    if (image && /^data:image\/(png|jpeg|webp|gif);base64,/.test(image))
      logo = image;
  }
  const printWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1000,
    parent: BrowserWindow.fromWebContents(contents) ?? undefined,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    const html = renderSaleNoteHtml(
      payload,
      input.terms,
      input.showCashierName === true,
      logo,
    );
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );
    await printWindow.webContents.executeJavaScript(
      "Promise.all([document.fonts.ready, ...Array.from(document.images, image => image.decode().catch(() => undefined))])",
    );
    return await new Promise<PrintNoteResult>((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          pageSize: "Letter",
          color: false,
          printBackground: true,
          header: "",
          footer: "",
        },
        (success, failureReason) => {
          if (success) resolve({ printed: true });
          else if (/cancel/i.test(failureReason ?? ""))
            resolve({ printed: false });
          else
            reject(
              new Error(
                failureReason || "No se pudo imprimir la nota de venta.",
              ),
            );
        },
      );
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
}
