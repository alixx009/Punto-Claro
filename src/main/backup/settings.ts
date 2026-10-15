import { isValidPrinterMargins } from "../../shared/ipc";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Los ajustes del respaldo no son válidos.");
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max || value.includes("\0"))
    throw new Error(
      "Un texto de los ajustes no es válido o es demasiado largo.",
    );
  return value;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("Los ajustes del respaldo no son válidos.");
  return value;
}

/** Shared by export and import; no filesystem paths or extra fields are restored. */
export function backupSettingsJson(value: unknown): string {
  const settings = record(value);
  const business = record(settings.business);
  const appearance = record(settings.appearance);
  const ticket = record(settings.ticket);
  if (
    business.region !== "MX" ||
    !["light", "dark"].includes(String(appearance.theme))
  )
    throw new Error("El país o tema del respaldo no es válido.");
  if (!Array.isArray(settings.categories) || settings.categories.length > 500)
    throw new Error("Las categorías del respaldo no son válidas.");
  const categories = settings.categories.map((value) => {
    const category = text(value, 120);
    if (!category.trim())
      throw new Error("Hay una categoría vacía en el respaldo.");
    return category;
  });
  const printerMargins = settings.printerMargins;
  if (!isValidPrinterMargins(printerMargins))
    throw new Error("Los márgenes de impresión del respaldo no son válidos.");
  if (
    !["classic", "modern", "compact", "framed", "multiline"].includes(
      String(ticket.template),
    ) ||
    typeof ticket.paperWidth !== "number" ||
    ![58, 80].includes(ticket.paperWidth) ||
    typeof ticket.fontSize !== "number" ||
    !Number.isFinite(ticket.fontSize) ||
    ticket.fontSize < 6 ||
    ticket.fontSize > 40
  )
    throw new Error("El diseño del ticket del respaldo no es válido.");
  return JSON.stringify({
    business: {
      name: text(business.name, 500),
      address: text(business.address, 4000),
      phone: text(business.phone, 100),
      region: "MX",
      logoPath: "",
      autoPrint: bool(business.autoPrint),
    },
    appearance: { theme: appearance.theme },
    ticket: {
      template: ticket.template,
      paperWidth: ticket.paperWidth,
      fontSize: ticket.fontSize,
      showLogo: bool(ticket.showLogo),
      showCashierName: bool(ticket.showCashierName),
      showAmount: bool(ticket.showAmount),
      thanks: text(ticket.thanks, 10000),
      invoiceMessage: text(ticket.invoiceMessage, 10000),
      terms: text(ticket.terms, 100000),
    },
    printerName: text(settings.printerName, 500),
    printerMargins: {
      leftMm: printerMargins.leftMm,
      rightMm: printerMargins.rightMm,
      topMm: printerMargins.topMm,
      bottomMm: printerMargins.bottomMm,
    },
    categories,
  });
}

export function validateSettingsJson(value: string): string {
  if (Buffer.byteLength(value, "utf8") > 512 * 1024)
    throw new Error("Los ajustes del respaldo son demasiado grandes.");
  try {
    return backupSettingsJson(JSON.parse(value));
  } catch {
    throw new Error("Los ajustes contenidos en el respaldo no son válidos.");
  }
}
