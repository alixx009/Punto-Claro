import type { CreateProductInput, Product } from "./ipc";

export const PRODUCT_IMPORT_LIMITS = {
  maxFileBytes: 25 * 1024 * 1024,
  maxUncompressedBytes: 64 * 1024 * 1024,
  maxZipPartBytes: 32 * 1024 * 1024,
  maxZipEntries: 1000,
  maxRows: 5000,
  templateRows: 1000,
  maxIssues: 1000,
  maxCategories: 500,
  maxPrice: 1_000_000,
  sku: 100,
  providerCode: 100,
  name: 180,
  brand: 120,
  category: 120,
  notes: 2000,
  imageUrl: 2048,
} as const;

export const PRODUCT_IMPORT_COLUMNS = [
  { key: "sku", header: "Código de barras / SKU *", required: true, width: 27 },
  {
    key: "providerCode",
    header: "Código de catálogo",
    required: false,
    width: 24,
  },
  {
    key: "name",
    header: "Nombre comercial y medida *",
    required: true,
    width: 40,
  },
  { key: "brand", header: "Marca / línea", required: false, width: 25 },
  { key: "unit", header: "Unidad de medida *", required: true, width: 23 },
  {
    key: "purchasePrice",
    header: "Precio de compra *",
    required: true,
    width: 23,
  },
  { key: "salePrice", header: "Precio de venta *", required: true, width: 23 },
  {
    key: "wholesalePrice",
    header: "Precio de mayoreo",
    required: false,
    width: 23,
  },
  {
    key: "category",
    header: "Familia / categoría *",
    required: true,
    width: 30,
  },
  { key: "stock", header: "Existencias *", required: true, width: 20 },
  { key: "notes", header: "Notas", required: false, width: 40 },
  { key: "imageUrl", header: "Imagen (URL)", required: false, width: 40 },
] as const;

export interface ProductImportRow {
  sourceRow: number;
  input: CreateProductInput;
}

export interface ProductImportIssue {
  row: number | null;
  column: string;
  message: string;
}

export interface ProductImportSkippedRow {
  sourceRow: number;
  sku: string;
}

export interface ParsedProductImport {
  fileName: string;
  fileHash: string;
  rows: ProductImportRow[];
  skippedRows: ProductImportSkippedRow[];
  issues: ProductImportIssue[];
  issueCount: number;
  totalRows: number;
}

export interface ProductImportPreview extends Omit<
  ParsedProductImport,
  "fileHash"
> {
  token: string | null;
  alreadyImported?: { importedCount: number; createdAt: string };
}

export interface ProductImportTemplateInput {
  categories: string[];
}

export interface ProductExportResult {
  saved: boolean;
  fileName?: string;
  exportedCount?: number;
  missingCostCount?: number;
}

export interface ProductImportCommitInput extends ProductImportTemplateInput {
  token: string;
  requestId: string;
}

export interface ProductImportResult {
  batchId: string;
  importedCount: number;
  skippedCount: number;
  fileName: string;
  alreadyImported: boolean;
  products: Product[];
}

export interface ProductImportApi {
  downloadTemplate: (
    input: ProductImportTemplateInput,
  ) => Promise<{ saved: boolean; fileName?: string }>;
  exportExcel: (
    input: ProductImportTemplateInput,
  ) => Promise<ProductExportResult>;
  preview: (
    input: ProductImportTemplateInput,
  ) => Promise<ProductImportPreview | null>;
  commit: (input: ProductImportCommitInput) => Promise<ProductImportResult>;
}

export const PRODUCT_IMPORT_CHANNELS = {
  downloadTemplate: "product-import:download-template",
  exportExcel: "product-import:export-excel",
  preview: "product-import:preview",
  commit: "product-import:commit",
} as const;

export function normalizeProductImportCategories(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > PRODUCT_IMPORT_LIMITS.maxCategories
  )
    throw new Error(
      "Configura al menos una familia / categoría en Ajustes > Catálogos base antes de usar la plantilla.",
    );
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (
      typeof entry !== "string" ||
      !entry.trim() ||
      entry.trim().length > PRODUCT_IMPORT_LIMITS.category ||
      /[\u0000-\u001f\u007f]/.test(entry)
    )
      throw new Error(
        "Hay categorías no válidas en Catálogos base. Revisa sus nombres antes de importar.",
      );
    const name = entry.trim();
    const key = name.toLocaleLowerCase("es-MX");
    if (!seen.has(key)) {
      categories.push(name);
      seen.add(key);
    }
  }
  return categories;
}
