import type { Product, ProductUnit } from "./ipc";

export const PURCHASE_LIMITS = {
  pageSize: 25,
  searchLength: 180,
  maxItems: 200,
  maxQuantity: 1_000_000,
  maxUnitCost: 1_000_000,
  maxTotal: 100_000_000,
} as const;

/** Validated quantities/costs only. Round half a cent up using integer arithmetic. */
export function purchaseLineTotalCents(
  quantity: number,
  unitCost: number,
  unit: ProductUnit,
): number {
  const scale = unit === "KG" ? 1000 : 1;
  const quantityUnits = BigInt(Math.round(quantity * scale));
  const costCents = BigInt(Math.round(unitCost * 100));
  const divisor = BigInt(scale);
  return Number((quantityUnits * costCents + divisor / BigInt(2)) / divisor);
}

export interface PurchaseProduct {
  id: number;
  sku: string;
  name: string;
  unit: ProductUnit;
  stock: number;
  purchasePrice: number;
}

export interface PurchaseItem {
  id: number;
  productId: number | null;
  productName: string;
  sku: string;
  unit: ProductUnit;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: number;
  folio: string;
  supplierId: number;
  supplierName: string;
  source: "MANUAL";
  itemCount: number;
  total: number;
  createdAt: string;
  performedByName: string;
}

export interface PurchaseDetail extends Purchase {
  items: PurchaseItem[];
}

export interface PurchasesQuery {
  search?: string;
  page?: number;
}

export interface PurchasesResult {
  rows: Purchase[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    purchaseCount: number;
    totalInvestment: number;
    quantitiesByUnit: { unit: ProductUnit; quantity: number }[];
  };
}

export interface CreatePurchaseInput {
  requestId: string;
  supplierId: number;
  items: {
    productId: number;
    expectedUnit: ProductUnit;
    quantity: number;
    unitCost: number;
  }[];
}

export interface CreatePurchaseResult {
  purchase: PurchaseDetail;
  updatedProducts: Product[];
}

export interface PurchasesApi {
  list: (query?: PurchasesQuery) => Promise<PurchasesResult>;
  get: (id: number) => Promise<PurchaseDetail>;
  searchProducts: (search: string) => Promise<PurchaseProduct[]>;
  create: (input: CreatePurchaseInput) => Promise<CreatePurchaseResult>;
}

export const PURCHASE_CHANNELS = {
  list: "purchases:list",
  get: "purchases:get",
  searchProducts: "purchases:search-products",
  create: "purchases:create",
} as const;
