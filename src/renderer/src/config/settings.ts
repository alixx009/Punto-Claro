import { categories as baseCategories } from "@/components/catalog/products/model";
import { storeContact, storeName } from "./store";
import { DEFAULT_PRINTER_MARGINS, normalizePrinterMargins, type PrinterMargins, type TicketPrintSettings } from "../../../shared/ipc";

export type { TicketTemplate } from "../../../shared/ipc";

export interface BusinessSettings {
  name: string;
  address: string;
  phone: string;
  region: "MX";
  logoPath: string;
  autoPrint: boolean;
}

export type TicketSettings = TicketPrintSettings;
export type AppTheme = "light" | "dark";

export interface AppearanceSettings {
  theme: AppTheme;
}

export interface AppSettings {
  business: BusinessSettings;
  appearance: AppearanceSettings;
  ticket: TicketSettings;
  printerName: string;
  printerMargins: PrinterMargins;
  categories: string[];
}

const STORAGE_KEY = "suma-pos:settings:v1";
export const SETTINGS_CHANGED_EVENT = "suma-pos:settings-changed";

export const defaultSettings: AppSettings = {
  appearance: { theme: "dark" },
  business: {
    name: storeName,
    address: storeContact.address,
    phone: storeContact.phone,
    region: "MX",
    logoPath: "",
    autoPrint: false,
  },
  ticket: {
    template: "classic",
    paperWidth: 58,
    fontSize: 11,
    showLogo: true,
    showCashierName: false,
    showAmount: true,
    thanks: "¡Gracias por su compra!",
    invoiceMessage: "Solicita tu factura en caja.",
    terms: "",
  },
  printerName: "",
  printerMargins: DEFAULT_PRINTER_MARGINS,
  categories: [...baseCategories],
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const ticket = { ...defaultSettings.ticket, ...parsed.ticket } as TicketSettings & { extendedDescription?: unknown; topMargin?: unknown; showUnitPrice?: unknown };
    // El importe siempre se mostraba en el formato anterior; se conserva al migrar.
    ticket.showAmount = typeof parsed.ticket?.showAmount === "boolean" ? parsed.ticket.showAmount : true;
    const printerMargins = normalizePrinterMargins(parsed.printerMargins, ticket.topMargin);
    delete ticket.extendedDescription;
    delete ticket.topMargin;
    delete ticket.showUnitPrice;
    return {
      business: { ...defaultSettings.business, ...parsed.business },
      appearance: { theme: parsed.appearance?.theme === "light" ? "light" : "dark" },
      ticket,
      printerName: typeof parsed.printerName === "string" ? parsed.printerName : "",
      printerMargins,
      categories: Array.isArray(parsed.categories) ? parsed.categories : defaultSettings.categories,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(next: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}
