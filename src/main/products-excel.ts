import { app, dialog, type BrowserWindow } from "electron";
import { basename, extname, join } from "node:path";
import { open, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Cell, CellValue, DataValidation, Workbook } from "exceljs";
import type { CreateProductInput, Product, ProductUnit } from "../shared/ipc";
import { PRODUCT_STOCK_LIMIT } from "../shared/ipc";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_LIMITS,
  normalizeProductImportCategories,
  type ParsedProductImport,
  type ProductExportResult,
  type ProductImportRow,
} from "../shared/product-import";
import { guardProductWorkbookArchive } from "./products-excel/archive-guard";
import { nowInAppTz } from "./db/database";

type ImportKey = (typeof PRODUCT_IMPORT_COLUMNS)[number]["key"];
type FindRegisteredSkus = (skus: string[]) => Set<string>;
type ReportIssue = (
  row: number | null,
  column: string,
  message: string,
) => void;

const HEADER_COLOR = "FF27272A";
const BODY_COLOR = "FF18181B";
const MUTED_COLOR = "FF52525B";
const MONEY_FORMAT = '"$"#,##0.00';
const UNIT_LABELS = ["PIEZA", "KG", "PAQUETE"];

/** Saves only a path selected by the authenticated user's native file dialog. */
export async function downloadProductTemplate(
  owner: BrowserWindow,
  categoriesInput: string[],
  assertAllowed: () => void = () => {},
): Promise<{ saved: boolean; fileName?: string }> {
  const categories = normalizeProductImportCategories(categoriesInput);
  assertAllowed();
  const result = await dialog.showSaveDialog(owner, {
    title: "Descargar plantilla de productos",
    defaultPath: join(app.getPath("documents"), "Plantilla de productos.xlsx"),
    filters: [{ name: "Libro de Excel (.xlsx)", extensions: ["xlsx"] }],
  });
  assertAllowed();
  if (result.canceled || !result.filePath) return { saved: false };
  const filePath = /\.xlsx$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.xlsx`;
  const buffer = await buildProductTemplate(categories);
  assertAllowed();
  try {
    await writeFile(filePath, buffer);
  } catch (error) {
    console.error("[products-excel] template write failed", error);
    throw new Error(
      "No se pudo guardar la plantilla. Comprueba que el archivo no esté abierto y que tengas permiso para guardar en esa carpeta.",
    );
  }
  assertAllowed();
  return { saved: true, fileName: basename(filePath) };
}

export async function saveProductExport(
  owner: BrowserWindow,
  products: readonly Product[],
  categoriesInput: string[],
  assertAllowed: () => void,
): Promise<ProductExportResult> {
  if (!products.length)
    throw new Error("No hay productos registrados para exportar.");
  const categories = normalizeProductImportCategories(categoriesInput);
  assertAllowed();
  const result = await dialog.showSaveDialog(owner, {
    title: "Exportar productos a Excel",
    defaultPath: join(
      app.getPath("documents"),
      `Productos-${nowInAppTz().slice(0, 10)}.xlsx`,
    ),
    filters: [{ name: "Libro de Excel (.xlsx)", extensions: ["xlsx"] }],
  });
  assertAllowed();
  if (result.canceled || !result.filePath) return { saved: false };
  const filePath = /\.xlsx$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.xlsx`;
  const buffer = await buildProductWorkbook(categories, products);
  assertAllowed();
  try {
    await writeFile(filePath, buffer);
  } catch (error) {
    console.error("[products-excel] export write failed", error);
    throw new Error(
      "No se pudo guardar el Excel. Comprueba que el archivo no esté abierto y que tengas permiso para guardar en esa carpeta.",
    );
  }
  return {
    saved: true,
    fileName: basename(filePath),
    exportedCount: products.length,
    missingCostCount: products.filter(
      (product) => product.purchasePrice === null,
    ).length,
  };
}

/** Opens and reads the selected file in main. Renderer never supplies an arbitrary path. */
export async function selectProductImport(
  owner: BrowserWindow,
  categoriesInput: string[],
  assertAllowed: () => void = () => {},
  findRegisteredSkus?: FindRegisteredSkus,
): Promise<ParsedProductImport | null> {
  const categories = normalizeProductImportCategories(categoriesInput);
  assertAllowed();
  const selection = await dialog.showOpenDialog(owner, {
    title: "Importar productos desde Excel",
    filters: [{ name: "Libro de Excel (.xlsx)", extensions: ["xlsx"] }],
    properties: ["openFile"],
  });
  assertAllowed();
  if (selection.canceled || selection.filePaths.length === 0) return null;
  const filePath = selection.filePaths[0];
  if (extname(filePath).toLowerCase() !== ".xlsx")
    throw new Error(
      "Selecciona un archivo .xlsx. Si tienes un archivo .xls, ábrelo en Excel o LibreOffice y guarda una copia como .xlsx.",
    );
  let buffer: Buffer;
  try {
    const file = await open(filePath, "r");
    try {
      const info = await file.stat();
      if (!info.isFile()) throw new Error("PRODUCT_IMPORT_NOT_FILE");
      if (info.size > PRODUCT_IMPORT_LIMITS.maxFileBytes)
        throw new Error("PRODUCT_IMPORT_TOO_LARGE");
      // A bounded read also covers a file that grows after stat().
      buffer = Buffer.alloc(info.size + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const chunk = await file.read(
          buffer,
          bytesRead,
          buffer.length - bytesRead,
          bytesRead,
        );
        if (chunk.bytesRead === 0) break;
        bytesRead += chunk.bytesRead;
      }
      if (bytesRead > info.size) throw new Error("PRODUCT_IMPORT_FILE_CHANGED");
      buffer = buffer.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PRODUCT_IMPORT_TOO_LARGE")
        throw new Error("El archivo de Excel no puede superar 25 MB.");
      if (error.message === "PRODUCT_IMPORT_FILE_CHANGED")
        throw new Error(
          "El archivo cambió mientras se leía. Guárdalo, ciérralo y vuelve a seleccionarlo.",
        );
    }
    console.error("[products-excel] import read failed", error);
    throw new Error(
      "No se pudo leer el archivo. Comprueba que exista y que tengas permiso para abrirlo.",
    );
  }
  assertAllowed();
  const parsed = await parseProductWorkbook(
    buffer,
    categories,
    basename(filePath),
    findRegisteredSkus,
  );
  assertAllowed();
  return parsed;
}

export async function buildProductTemplate(
  categoriesInput: string[],
): Promise<Buffer> {
  return buildProductWorkbook(categoriesInput);
}

async function buildProductWorkbook(
  categoriesInput: string[],
  products?: readonly Product[],
): Promise<Buffer> {
  const categories = normalizeProductImportCategories(categoriesInput);
  const rowCount = products
    ? Math.max(1, products.length)
    : PRODUCT_IMPORT_LIMITS.templateRows;
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SUMA POS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Productos", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 1, showGridLines: true }],
    properties: { defaultRowHeight: 21 },
  });
  sheet.columns = PRODUCT_IMPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  const header = sheet.getRow(1);
  header.height = 38;
  header.font = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_COLOR },
  };
  header.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  header.eachCell((cell) => {
    cell.border = { right: { style: "thin", color: { argb: "FF52525B" } } };
  });
  sheet.autoFilter = `A1:L${rowCount + 1}`;
  const catalogs = workbook.addWorksheet("Catalogos", { state: "veryHidden" });
  catalogs.getCell("A1").value = "Unidades de medida";
  catalogs.getCell("B1").value = "Familias / categorías";
  UNIT_LABELS.forEach((unit, index) => {
    catalogs.getCell(index + 2, 1).value = unit;
  });
  categories.forEach((category, index) => {
    catalogs.getCell(index + 2, 2).value = category;
  });
  workbook.definedNames.add("'Catalogos'!$A$2:$A$4", "UnidadesProducto");
  workbook.definedNames.add(
    `'Catalogos'!$B$2:$B$${categories.length + 1}`,
    "CategoriasProducto",
  );
  for (const column of PRODUCT_IMPORT_COLUMNS) {
    const target = sheet.getColumn(column.key);
    target.font = { name: "Arial", size: 11, color: { argb: BODY_COLOR } };
    target.alignment = {
      vertical: "middle",
      horizontal: [
        "purchasePrice",
        "salePrice",
        "wholesalePrice",
        "stock",
      ].includes(column.key)
        ? "right"
        : "left",
    };
    target.numFmt = ["purchasePrice", "salePrice", "wholesalePrice"].includes(
      column.key,
    )
      ? MONEY_FORMAT
      : column.key === "stock"
        ? "0.###"
        : "@";
  }
  // ExcelJS column style inheritance can also touch the header; keep its contrast explicit.
  header.font = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  header.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  for (let row = 2; row <= rowCount + 1; row += 1) {
    for (const column of PRODUCT_IMPORT_COLUMNS) {
      const cell = sheet.getCell(row, sheet.getColumn(column.key).number);
      cell.dataValidation = templateValidation(
        column.key,
        column.required,
        cell.address,
      );
    }
  }
  products?.forEach((product, index) => {
    const values: Record<ImportKey, string | number | null> = {
      sku: product.sku,
      providerCode: product.providerCode ?? "",
      name: product.name,
      brand: product.brand,
      unit: product.unit === "PAQ" ? "PAQUETE" : product.unit,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      wholesalePrice: product.wholesalePrice,
      category: product.category,
      stock: product.stock,
      notes: product.notes ?? "",
      imageUrl: "",
    };
    PRODUCT_IMPORT_COLUMNS.forEach((column) => {
      sheet.getCell(index + 2, sheet.getColumn(column.key).number).value =
        values[column.key];
    });
  });
  addInstructions(workbook, products !== undefined);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function templateValidation(
  key: ImportKey,
  required: boolean,
  address: string,
): DataValidation {
  const common = {
    allowBlank: !required,
    showInputMessage: true,
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Revisa este dato",
  };
  if (key === "unit" || key === "category")
    return {
      ...common,
      type: "list",
      formulae: [key === "unit" ? "UnidadesProducto" : "CategoriasProducto"],
      promptTitle: key === "unit" ? "Unidad de medida" : "Familia / categoría",
      prompt: "Selecciona una opción de la lista desplegable.",
      error: "Selecciona una de las opciones disponibles en la lista.",
    };
  if (["purchasePrice", "salePrice", "wholesalePrice", "stock"].includes(key))
    return {
      ...common,
      type: "custom",
      formulae: [
        key === "stock"
          ? `AND(ISNUMBER(${address}),${address}>=0,${address}<=${PRODUCT_STOCK_LIMIT},IF($E${address.replace(/\D/g, "")}="KG",ABS(${address}-ROUND(${address},3))<0.000000001,${address}=INT(${address})))`
          : `AND(ISNUMBER(${address}),${address}>=0,${address}<=${PRODUCT_IMPORT_LIMITS.maxPrice},ABS(${address}*100-ROUND(${address}*100,0))<0.0000001)`,
      ],
      promptTitle: key === "stock" ? "Existencias" : "Precio en pesos",
      prompt:
        key === "stock"
          ? "PIEZA y PAQUETE: enteros. KG: máximo 3 decimales. Captura 0 si no hay existencias."
          : "Usa un número mayor o igual a 0, con máximo 2 decimales.",
      error:
        key === "stock"
          ? "Usa una cantidad entera para PIEZA / PAQUETE o hasta 3 decimales para KG, dentro del límite indicado."
          : "Usa un número mayor o igual a 0, con máximo 2 decimales, dentro del límite indicado.",
    };
  const limit =
    PRODUCT_IMPORT_LIMITS[
      key as "sku" | "providerCode" | "name" | "brand" | "notes" | "imageUrl"
    ];
  return {
    ...common,
    type: "textLength",
    operator: "between",
    formulae: [required ? 1 : 0, limit],
    promptTitle: required ? "Campo obligatorio" : "Campo opcional",
    prompt:
      key === "sku" || key === "providerCode"
        ? "Escribe el código como texto para conservar ceros iniciales y códigos largos."
        : key === "imageUrl"
          ? "Opcional: enlace http:// o https:// a una imagen. No pegues rutas de archivos."
          : `Máximo ${limit} caracteres. ${required ? "No lo dejes vacío." : "Puedes dejarlo vacío."}`,
    error: `Usa ${required ? "de 1 a" : "hasta"} ${limit} caracteres.`,
  };
}

function addInstructions(workbook: Workbook, exported = false): void {
  const sheet = workbook.addWorksheet("Instrucciones", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 24 },
  });
  sheet.columns = [{ width: 28 }, { width: 94 }];
  const instructions = [
    [exported ? "Exportación de productos" : "Plantilla de productos", ""],
    [
      "Formato",
      "Completa una fila por producto en la hoja Productos y guarda el archivo como .xlsx (Excel o LibreOffice). No se admiten archivos .xls ni fórmulas.",
    ],
    [
      "Campos obligatorios",
      "Los encabezados con * son obligatorios. No borres ni renombres los encabezados. Las filas completamente vacías se omiten.",
    ],
    [
      "Código de barras / SKU",
      "La columna está configurada como texto. Conserva ese formato antes de escribir o pegar códigos para no perder ceros iniciales ni precisión en códigos largos.",
    ],
    [
      "Unidad de medida",
      "Selecciona PIEZA, KG o PAQUETE en la lista de cada celda. No hay una unidad preseleccionada.",
    ],
    [
      "Familia / categoría",
      exported
        ? "Se incluyen las categorías configuradas y las utilizadas por los productos. Antes de importar en otra instalación, registra estas mismas familias / categorías en Ajustes > Catálogos base. La exportación no modifica los ajustes de la otra instalación."
        : "Selecciona una opción en la lista. Se incluyen las categorías configuradas en Ajustes > Catálogos base al descargar esta plantilla. Si cambian, descarga una plantilla nueva.",
    ],
    [
      "Precios",
      "Captura precios en pesos mayores o iguales a 0, con máximo 2 decimales y hasta $1,000,000. El precio de mayoreo es opcional; si está vacío se guarda 0.",
    ],
    [
      "Existencias",
      "Captura la cantidad inicial, incluido 0. PIEZA y PAQUETE aceptan enteros; KG acepta hasta 3 decimales. Máximo: 1,000,000,000.",
    ],
    [
      "Imagen (URL)",
      exported
        ? "Las imágenes se omiten para evitar rutas locales que no funcionarían en otra máquina. Puedes añadir una URL pública o una imagen después de importar."
        : "Opcional: enlace directo a una imagen PNG, JPG, WEBP, GIF o BMP pública (http:// o https://). Al confirmar se descarga y guarda localmente para verla sin internet. Máximo 10 MB. Si falla la descarga, corrige el enlace o deja la celda vacía. No se importan imágenes incrustadas ni rutas de archivos.",
    ],
    [
      "Otros campos opcionales",
      "Código de catálogo, marca / línea y notas pueden quedar vacíos.",
    ],
    [
      "Productos existentes",
      "La importación agrega productos nuevos. Los SKU ya registrados se omiten y conservan sus datos y existencias. Cada SKU nuevo debe aparecer una sola vez en el archivo.",
    ],
    [
      "Antes de confirmar",
      "La app muestra una revisión de los productos y los errores de cada fila. Si hay errores, corrige el archivo y vuelve a cargarlo. No se guarda una importación incompleta.",
    ],
    [
      "Cantidad de filas",
      exported
        ? "La exportación contiene todos los productos registrados. La importación admite hasta 5,000 productos y 25 MB por archivo; si el catálogo es mayor, divídelo en archivos con los mismos encabezados y la hoja Productos."
        : "La plantilla tiene listas desplegables en 1,000 filas. Puedes copiar una fila vacía con sus validaciones para ampliarla, hasta 5,000 productos por archivo (máximo 25 MB).",
    ],
    ...(exported
      ? [
          [
            "Alcance del respaldo",
            "Solo contiene el catálogo de productos con sus precios y existencias al exportar. No incluye ventas, clientes, proveedores, usuarios ni movimientos. Los costos desconocidos permanecen vacíos: complétalos antes de importar.",
          ],
        ]
      : []),
  ];
  instructions.forEach(([title, description]) => {
    const row = sheet.addRow([title, description]);
    row.height = row.number === 1 ? 30 : title === "Imagen (URL)" ? 80 : 48;
    row.font = { name: "Arial", size: 11, color: { argb: BODY_COLOR } };
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(1).font = {
      name: "Arial",
      size: row.number === 1 ? 14 : 11,
      bold: true,
      color: { argb: BODY_COLOR },
    };
    row.getCell(2).font = {
      name: "Arial",
      size: 11,
      color: { argb: MUTED_COLOR },
    };
  });
  sheet.getRow(1).border = {
    bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
  };
}

function normalizedHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasContent(value: CellValue): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

function plainCellValue(cell: Cell): string | number | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object" && "richText" in value)
    return value.richText.map((part) => part.text).join("");
  if (
    typeof value === "object" &&
    ("formula" in value || "sharedFormula" in value)
  )
    throw new Error(
      "No se admiten fórmulas. Pega únicamente el valor del dato.",
    );
  if (typeof value === "object" && "error" in value)
    throw new Error("Esta celda contiene un error de Excel. Corrige su valor.");
  if (typeof value === "object" && "hyperlink" in value) return value.text;
  throw new Error("Usa texto o números; no fechas ni valores verdadero/falso.");
}

/** Shared by the lookup and row parser so numeric codes and leading zeros match exactly. */
function identifierCellText(cell: Cell | null): string {
  if (!cell) return "";
  const value = plainCellValue(cell);
  let parsed = value === null ? "" : String(value).trim();
  if (typeof value === "number") {
    const format = cell.numFmt ?? "";
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      String(value).length > 15 ||
      /e[+-]?\d/i.test(format)
    )
      throw new Error(
        "Captura el código como texto para conservar todos los dígitos y ceros iniciales; no uses notación científica.",
      );
    if (/^0+$/.test(format)) parsed = parsed.padStart(format.length, "0");
  }
  if (/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(parsed))
    throw new Error(
      "Escribe el código completo como texto, sin notación científica.",
    );
  return parsed;
}

export async function parseProductWorkbook(
  buffer: Buffer,
  categoriesInput: string[],
  fileName = "Productos.xlsx",
  findRegisteredSkus?: FindRegisteredSkus,
): Promise<ParsedProductImport> {
  const categories = normalizeProductImportCategories(categoriesInput);
  await guardProductWorkbookArchive(buffer, PRODUCT_IMPORT_LIMITS.maxRows);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer, {
      ignoreNodes: [
        "dimension",
        "sheetViews",
        "drawing",
        "picture",
        "dataValidations",
        "sheetProtection",
        "tableParts",
        "conditionalFormatting",
        "pageSetup",
        "pageMargins",
        "headerFooter",
        "rowBreaks",
        "autoFilter",
      ],
    });
  } catch (error) {
    console.error("[products-excel] workbook parsing failed", error);
    throw new Error(
      "No se pudo abrir el libro de Excel. Guarda una copia en formato .xlsx o descarga una plantilla nueva.",
    );
  }
  const result: ParsedProductImport = {
    fileName,
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    rows: [],
    skippedRows: [],
    issues: [],
    issueCount: 0,
    totalRows: 0,
  };
  const issue: ReportIssue = (row, column, message) => {
    result.issueCount += 1;
    if (result.issues.length < PRODUCT_IMPORT_LIMITS.maxIssues)
      result.issues.push({ row, column, message });
  };
  const sheet = workbook.worksheets.find(
    (entry) => entry.name.trim().toLocaleLowerCase("es-MX") === "productos",
  );
  if (!sheet) {
    issue(
      null,
      "Hoja",
      'No se encontró la hoja "Productos". Conserva el nombre de la hoja de la plantilla.',
    );
    return result;
  }
  if (sheet.rowCount > PRODUCT_IMPORT_LIMITS.maxRows + 1)
    throw new Error(
      `El archivo supera el máximo de ${PRODUCT_IMPORT_LIMITS.maxRows} filas de productos.`,
    );
  const columnByKey = new Map<ImportKey, number>();
  const knownHeaders = new Map(
    PRODUCT_IMPORT_COLUMNS.map((column) => [
      normalizedHeader(column.header),
      column.key,
    ]),
  );
  const unknownColumns = new Map<number, string>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    let header: string;
    try {
      const value = plainCellValue(cell);
      if (value === null || String(value).trim() === "") return;
      header = String(value).trim();
    } catch (error) {
      issue(
        1,
        `Columna ${columnNumber}`,
        error instanceof Error ? error.message : "El encabezado no es válido.",
      );
      return;
    }
    const key = knownHeaders.get(normalizedHeader(header));
    if (!key) {
      unknownColumns.set(columnNumber, header);
      return;
    }
    if (columnByKey.has(key)) {
      issue(
        1,
        header,
        "Este encabezado aparece más de una vez. Conserva una sola columna para este dato.",
      );
      return;
    }
    columnByKey.set(key, columnNumber);
  });
  const missingHeaders = PRODUCT_IMPORT_COLUMNS.filter(
    (column) => column.required && !columnByKey.has(column.key),
  );
  missingHeaders.forEach((column) => {
    issue(
      1,
      column.header,
      "Falta esta columna obligatoria. Conserva los encabezados de la plantilla.",
    );
  });
  const skuByRow = new Map<number, string>();
  const skuColumn = columnByKey.get("sku");
  if (!missingHeaders.length && skuColumn !== undefined) {
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      try {
        const sku = identifierCellText(
          sheet.getRow(rowNumber).getCell(skuColumn),
        );
        if (
          sku &&
          sku.length <= PRODUCT_IMPORT_LIMITS.sku &&
          !/[\u0000-\u001f\u007f]/.test(sku)
        )
          skuByRow.set(rowNumber, sku);
      } catch {
        // An unreadable SKU cannot be matched safely; the row parser reports its error.
      }
    }
  }
  const registeredSkus = findRegisteredSkus
    ? findRegisteredSkus([...new Set(skuByRow.values())])
    : new Set<string>();
  const seenSkus = new Map<string, number>();
  const unknownWithContent = new Set<number>();
  const knownColumnNumbers = new Set(columnByKey.values());
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let filled = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (hasContent(cell.value)) filled = true;
    });
    if (!filled) continue;
    result.totalRows += 1;
    const sku = skuByRow.get(rowNumber);
    if (sku && registeredSkus.has(sku)) {
      result.skippedRows.push({ sourceRow: rowNumber, sku });
      continue;
    }
    const beforeIssues = result.issueCount;
    row.eachCell({ includeEmpty: false }, (cell, column) => {
      if (
        hasContent(cell.value) &&
        !knownColumnNumbers.has(column) &&
        !unknownWithContent.has(column)
      ) {
        unknownWithContent.add(column);
        issue(
          rowNumber,
          unknownColumns.get(column) ?? `Columna ${column}`,
          "Esta columna no pertenece a la plantilla. Revisa el encabezado para evitar omitir datos.",
        );
      }
    });
    if (missingHeaders.length) continue;
    const input = parseProductRow(
      rowNumber,
      (key) => {
        const column = columnByKey.get(key);
        return column === undefined ? null : row.getCell(column);
      },
      categories,
      issue,
    );
    if (input.sku) {
      const previous = seenSkus.get(input.sku);
      if (previous !== undefined)
        issue(
          rowNumber,
          PRODUCT_IMPORT_COLUMNS[0].header,
          `Este SKU está repetido en el archivo (también aparece en la fila ${previous}).`,
        );
      else seenSkus.set(input.sku, rowNumber);
    }
    if (result.issueCount === beforeIssues)
      result.rows.push({
        sourceRow: rowNumber,
        input,
      } satisfies ProductImportRow);
  }
  if (result.totalRows === 0 && result.issueCount === 0)
    issue(
      null,
      "Productos",
      "El archivo no contiene productos. Completa al menos una fila debajo de los encabezados.",
    );
  return result;
}

function parseProductRow(
  row: number,
  getCell: (key: ImportKey) => Cell | null,
  categories: string[],
  issue: ReportIssue,
): CreateProductInput {
  const columnName = (key: ImportKey) =>
    PRODUCT_IMPORT_COLUMNS.find((column) => column.key === key)!.header;
  const read = (key: ImportKey): string | number | null => {
    const cell = getCell(key);
    if (!cell) return null;
    try {
      return plainCellValue(cell);
    } catch (error) {
      issue(
        row,
        columnName(key),
        error instanceof Error ? error.message : "El dato no es válido.",
      );
      return null;
    }
  };
  const text = (
    key:
      | "sku"
      | "providerCode"
      | "name"
      | "brand"
      | "category"
      | "notes"
      | "imageUrl",
    required = false,
  ): string => {
    let parsed = "";
    if (key === "sku" || key === "providerCode") {
      try {
        parsed = identifierCellText(getCell(key));
      } catch (error) {
        issue(
          row,
          columnName(key),
          error instanceof Error ? error.message : "El código no es válido.",
        );
      }
    } else {
      const value = read(key);
      parsed = value === null ? "" : String(value).trim();
    }
    if (required && !parsed)
      issue(row, columnName(key), "Este dato es obligatorio.");
    const forbiddenCharacters =
      key === "notes"
        ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
        : /[\u0000-\u001f\u007f]/;
    if (forbiddenCharacters.test(parsed))
      issue(
        row,
        columnName(key),
        "El dato contiene caracteres de control no válidos.",
      );
    if (parsed.length > PRODUCT_IMPORT_LIMITS[key])
      issue(
        row,
        columnName(key),
        `Usa como máximo ${PRODUCT_IMPORT_LIMITS[key]} caracteres.`,
      );
    return parsed;
  };
  const number = (
    key: "purchasePrice" | "salePrice" | "wholesalePrice" | "stock",
    required: boolean,
  ): number => {
    const value = read(key);
    if (value === null || (typeof value === "string" && !value.trim())) {
      if (required)
        issue(
          row,
          columnName(key),
          "Este dato es obligatorio; captura 0 cuando corresponda.",
        );
      return 0;
    }
    if (typeof value === "string" && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) {
      issue(
        row,
        columnName(key),
        "Captura un número sin símbolos de moneda ni separadores de miles.",
      );
      return 0;
    }
    const amount =
      typeof value === "number"
        ? value
        : Number(value.trim().replace(",", "."));
    const max =
      key === "stock" ? PRODUCT_STOCK_LIMIT : PRODUCT_IMPORT_LIMITS.maxPrice;
    if (!Number.isFinite(amount) || amount < 0 || amount > max) {
      issue(
        row,
        columnName(key),
        `Captura un número de 0 a ${max.toLocaleString("es-MX")}.`,
      );
      return 0;
    }
    if (
      key !== "stock" &&
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7
    )
      issue(row, columnName(key), "Usa como máximo dos decimales.");
    return amount;
  };
  const sku = text("sku", true);
  const providerCode = text("providerCode");
  const name = text("name", true);
  const brand = text("brand");
  const rawUnit = read("unit");
  const unitLabel =
    typeof rawUnit === "string"
      ? rawUnit.trim().toLocaleUpperCase("es-MX")
      : "";
  const unit: ProductUnit =
    unitLabel === "KG"
      ? "KG"
      : unitLabel === "PAQ" || unitLabel === "PAQUETE"
        ? "PAQ"
        : "PIEZA";
  if (!["PIEZA", "KG", "PAQUETE", "PAQ"].includes(unitLabel))
    issue(
      row,
      columnName("unit"),
      "Selecciona PIEZA, KG o PAQUETE en la lista.",
    );
  const purchasePrice = number("purchasePrice", true);
  const salePrice = number("salePrice", true);
  const wholesalePrice = number("wholesalePrice", false);
  const categoryValue = text("category", true);
  const category = categories.find(
    (entry) =>
      entry.toLocaleLowerCase("es-MX") ===
      categoryValue.toLocaleLowerCase("es-MX"),
  );
  if (categoryValue && !category)
    issue(
      row,
      columnName("category"),
      "Esta categoría no existe en Ajustes > Catálogos base. Selecciona una opción vigente o descarga una plantilla nueva.",
    );
  const stock = number("stock", true);
  const stockScale = unit === "KG" ? 1000 : 1;
  if (
    Math.abs(stock - Math.round(stock * stockScale) / stockScale) > 1e-9 ||
    (stockScale === 1 && !Number.isInteger(stock))
  )
    issue(
      row,
      columnName("stock"),
      unit === "KG"
        ? "Para KG usa como máximo tres decimales."
        : "Para PIEZA y PAQUETE usa una cantidad entera.",
    );
  const notes = text("notes");
  const imageUrl = text("imageUrl");
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      )
        throw new Error("invalid URL");
    } catch {
      issue(
        row,
        columnName("imageUrl"),
        "Usa un enlace http:// o https:// sin credenciales. No se admiten rutas de archivos.",
      );
    }
  }
  return {
    sku,
    providerCode: providerCode || null,
    name,
    brand,
    unit,
    purchasePrice,
    salePrice,
    wholesalePrice,
    category: category ?? categoryValue,
    stock,
    notes: notes || null,
    imageUrl,
  };
}
