import { app, BrowserWindow, dialog, type WebContents } from "electron";
import { join } from "path";
import type {
  ReportExportInput,
  ReportExportResult,
  PaymentMethod,
} from "../shared/ipc";
import { reportInventory, reportSales } from "./db/reports";
import { nowInAppTz } from "./db/database";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  DEBIT: "Tarjeta",
  CREDIT: "Tarjeta",
  TRANSFER: "Transferencia",
  VOUCHER: "Vale",
  OTHER: "Otro",
};

export async function exportReportExcel(
  contents: WebContents,
  input: ReportExportInput,
  showCosts = true,
): Promise<ReportExportResult> {
  if (!input || !["sales", "inventory"].includes(input.kind) || !input.query)
    throw new Error("Selecciona un reporte válido para exportar.");
  // Validar y capturar los datos antes del diálogo conserva el mismo reporte durante la exportación.
  const sales = input.kind === "sales" ? reportSales(input.query, true) : null;
  const inventory =
    input.kind === "inventory" ? reportInventory(input.query, true) : null;
  const options = {
    title: "Exportar reporte a Excel",
    defaultPath: join(
      app.getPath("documents"),
      `${input.kind === "sales" ? "Ventas" : "Inventario"}-${nowInAppTz().slice(0, 10)}.xlsx`,
    ),
    filters: [{ name: "Libro de Excel", extensions: ["xlsx"] }],
  };
  const parent = BrowserWindow.fromWebContents(contents);
  const result = await (parent
    ? dialog.showSaveDialog(parent, options)
    : dialog.showSaveDialog(options));
  if (result.canceled || !result.filePath) return { saved: false };
  const path = /\.xlsx$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.xlsx`;
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SUMA POS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sales ? "Ventas" : "Inventario", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  if (sales) {
    sheet.columns = [
      { header: "ID venta", key: "id", width: 12 },
      { header: "Folio", key: "folio", width: 20 },
      { header: "Fecha y hora", key: "createdAt", width: 23 },
      { header: "Cliente", key: "customerName", width: 35 },
      { header: "Cajero", key: "cashierName", width: 18 },
      { header: "Pagos", key: "payments", width: 30 },
      { header: "Monto neto", key: "total", width: 18 },
      { header: "Estado de devolución", key: "returnState", width: 25 },
      { header: "Importe devuelto", key: "returnedAmount", width: 20 },
      { header: "Cobrado en venta", key: "paidAmount", width: 20 },
      { header: "Crédito / Fiar", key: "creditAmount", width: 18 },
      { header: "Notas", key: "notes", width: 40 },
    ];
    sales.rows.forEach((row) =>
      sheet.addRow({
        ...row,
        returnState:
          row.returnState === "FULL"
            ? "Devuelta"
            : row.returnState === "PARTIAL"
              ? "Devolución parcial"
              : "Activa",
        payments: [
          ...new Set(
            row.paymentMethods.map(
              (method) => PAYMENT_LABELS[method] ?? method,
            ),
          ),
        ].join(", "),
      }),
    );
    ["total", "paidAmount", "creditAmount", "returnedAmount"].forEach((key) => {
      sheet.getColumn(key).numFmt = '"$"#,##0.00';
    });
  } else if (inventory) {
    sheet.columns = [
      { header: "SKU", key: "sku", width: 22 },
      { header: "Producto", key: "name", width: 40 },
      { header: "Unidad", key: "unit", width: 14 },
      { header: "Disponible", key: "stock", width: 16 },
      { header: "Costo unitario", key: "purchasePrice", width: 18 },
      { header: "Precio público", key: "salePrice", width: 18 },
      { header: "Valuación costo", key: "costValue", width: 20 },
      { header: "Valuación público", key: "publicValue", width: 20 },
    ].filter(
      (column) =>
        showCosts || !["purchasePrice", "costValue"].includes(column.key),
    );
    inventory.rows.forEach((row) =>
      sheet.addRow(
        showCosts ? row : { ...row, purchasePrice: null, costValue: null },
      ),
    );
    sheet.getColumn("stock").numFmt = "0.###";
    (showCosts
      ? ["purchasePrice", "salePrice", "costValue", "publicValue"]
      : ["salePrice", "publicValue"]
    ).forEach((key) => {
      sheet.getColumn(key).numFmt = '"$"#,##0.00';
    });
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF27272A" },
  };
  sheet.getRow(1).height = 25;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
  };
  await workbook.xlsx.writeFile(path);
  return { saved: true, path };
}
