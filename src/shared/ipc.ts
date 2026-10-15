export type ProductUnit = "PIEZA" | "KG" | "PAQ";

export interface Product {
  id: number;
  sku: string;
  providerCode: string | null;
  name: string;
  unit: ProductUnit;
  purchasePrice: number | null;
  wholesalePrice: number;
  salePrice: number;
  category: string;
  brand: string;
  stock: number;
  imageUrl: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  sku: string;
  providerCode: string | null;
  name: string;
  unit: ProductUnit;
  purchasePrice: number;
  wholesalePrice: number;
  salePrice: number;
  category: string;
  brand: string;
  stock: number;
  imageUrl: string;
  notes?: string | null;
}

export const PRODUCT_STOCK_LIMIT = 1_000_000_000;

export type UpdateProductInput = Partial<CreateProductInput> & {
  /** Required when setting stock: protect against inventory changes since opening the form. */
  expectedStock?: number;
  expectedUnit?: ProductUnit;
};

export interface AdjustStockInput {
  productId: number;
  delta: number;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  imageUrl: string | null;
  creditLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWithBalance extends Customer {
  balance: number;
}

export interface CreateCustomerInput {
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  creditLimit?: number;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export type SaleStatus = "PAID" | "PARTIAL" | "PENDING";

export interface Sale {
  id: number;
  folio: string;
  customerId: number | null;
  registerSessionId: number | null;
  cashierId: string | null;
  cashierName: string | null;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  returnedAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod =
  "CASH" | "CARD" | "DEBIT" | "CREDIT" | "TRANSFER" | "VOUCHER" | "OTHER";

export interface Payment {
  id: number;
  customerId: number;
  saleId: number | null;
  registerSessionId: number | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreatePaymentInput {
  customerId: number;
  amount: number;
  method: PaymentMethod;
  saleId?: number | null;
  registerSessionId?: number | null;
  reference?: string | null;
  notes?: string | null;
}

export type RegisterStatus = "OPEN" | "CLOSED";

export interface RegisterSession {
  id: number;
  cashierName: string;
  cashierId: string | null;
  openingAmount: number;
  cashPayments: number;
  cashMovements: number;
  expectedByMethod: RegisterExpectedByMethod;
  openedAt: string;
  closedAt: string | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  status: RegisterStatus;
  notes: string | null;
}

export interface RegisterExpectedByMethod {
  cash: number;
  card: number;
  transfer: number;
  other: number;
}

export interface OpenRegisterInput {
  openingAmount: number;
  notes?: string | null;
}

export interface CloseRegisterInput {
  declaredByMethod: {
    cash: number;
    card: number;
    transfer: number;
  };
  notes?: string | null;
}

export type CashMovementKind = "INCOME" | "EXPENSE";

export interface CashMovement {
  id: number;
  sessionId: number;
  kind: CashMovementKind;
  amount: number;
  reason: string;
  performedByUserId: string | null;
  performedByName: string | null;
  createdAt: string;
}

export interface CreateCashMovementInput {
  sessionId: number;
  kind: CashMovementKind;
  amount: number;
  reason: string;
}

export interface SaleItemInput {
  productId: number;
  quantity: number;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface TicketLineItem {
  productName: string;
  unit: ProductUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface TicketPaymentLine {
  method: PaymentMethod;
  amount: number;
}

export interface TicketStoreInfo {
  name: string;
  address: string;
  phone: string;
}

export interface TicketPayload {
  sale: {
    id: number;
    folio: string;
    createdAt: string;
    status: SaleStatus;
  };
  items: TicketLineItem[];
  payments: TicketPaymentLine[];
  subtotal: number;
  total: number;
  discount: number;
  creditAmount: number;
  change: number;
  customer: {
    name: string;
    code: string;
  } | null;
  attendedBy: string | null;
  store: TicketStoreInfo;
  returns?: {
    state: SaleReturnState;
    amount: number;
    refunded: number;
    debtReduced: number;
  };
}

export type TicketTemplate =
  "classic" | "modern" | "compact" | "framed" | "multiline";

export interface TicketPrintSettings {
  template: TicketTemplate;
  paperWidth: 58 | 80;
  fontSize: number;
  showLogo: boolean;
  showCashierName: boolean;
  showAmount: boolean;
  thanks: string;
  invoiceMessage: string;
  terms: string;
}

export interface Ticket {
  id: number;
  saleId: number;
  folio: string;
  payload: TicketPayload;
  totalAmount: number;
  createdAt: string;
}

export interface CreateTicketInput {
  saleId: number;
  payload: TicketPayload;
}

export interface SalePaymentInput {
  method: PaymentMethod;
  amount: number;
}

export type SalesHistoryPaymentFilter =
  "ALL" | "CASH" | "CARD" | "TRANSFER" | "STORE_CREDIT";

export interface SalesHistoryQuery {
  search?: string;
  payment?: SalesHistoryPaymentFilter;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}

export interface SalesHistoryRow {
  id: number;
  folio: string;
  createdAt: string;
  customerName: string;
  total: number;
  status: SaleStatus;
  paymentMethods: PaymentMethod[];
  creditAmount: number;
  ticketId: number | null;
  itemCount: number;
  returnState: SaleReturnState;
  returnedAmount: number;
}

export type SaleReturnState = "NONE" | "PARTIAL" | "FULL";
export type RefundMethod = "CASH" | "CARD" | "TRANSFER";

export interface SaleReturnItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  unit: ProductUnit;
  soldQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  originalLineSubtotal: number;
  originalLineDiscount: number;
}

export interface SaleReturnDetail {
  sale: Sale;
  items: SaleReturnItem[];
  revision: number;
  customerBalance: number;
  registerSessionId: number | null;
}

export interface SaleReturnSelection {
  saleItemId: number;
  quantity: number;
}

export interface CreateSaleReturnInput {
  saleId: number;
  requestId: string;
  revision: number;
  registerSessionId: number;
  items: SaleReturnSelection[];
  refundMethod: RefundMethod;
  expectedRefund: number;
  expectedDebtReduction: number;
}

export interface SaleReturnResult {
  id: number;
  saleId: number;
  amount: number;
  refundAmount: number;
  debtReduction: number;
  refundMethod: RefundMethod | null;
}

export interface SalesHistoryResult {
  rows: SalesHistoryRow[];
  totalRecords: number;
  page: number;
  pageSize: number;
  summary: { count: number; total: number; average: number };
}

export interface SalesHistoryDetail {
  sale: Sale;
  ticketId: number | null;
  payload: TicketPayload;
  reconstructed: boolean;
}

export interface EnsureSaleTicketInput {
  saleId: number;
  store: TicketStoreInfo;
}

export interface PrintSaleNoteInput {
  saleId: number;
  store: TicketStoreInfo;
  logoPath: string;
  terms: string;
  showCashierName: boolean;
}

export interface PrintNoteResult {
  printed: boolean;
}

export interface ReportPageQuery {
  search?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
}

export interface ReportPage<T> {
  rows: T[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface ReportSalesQuery extends ReportPageQuery {
  payment?: SalesHistoryPaymentFilter;
  state?: "ALL" | "ACTIVE" | "RETURNED";
  cashier?: string;
  date?: string | null;
}

export interface ReportSaleRow extends SalesHistoryRow {
  cashierName: string;
  notes: string | null;
  paidAmount: number;
}

export interface ReportSalesResult extends ReportPage<ReportSaleRow> {
  summary: {
    collected: number;
    profit: number | null;
    missingCostSales: number;
    count: number;
    volume: number;
    volumeByUnit: { unit: ProductUnit; quantity: number }[];
  };
  trend: { date: string; income: number; accumulated: number }[];
  availableYears: number[];
  availableCashiers: string[];
  returnsSupported: boolean;
}

export interface ReportCutRow {
  id: number;
  cashierName: string;
  terminal: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  cashIncome: number;
  closingAmount: number;
  expectedAmount: number;
  difference: number;
}

export interface ReportAuditRow {
  cashierName: string;
  shifts: number;
  shortage: number;
  surplus: number;
  balance: number;
}

export interface ReportInventoryRow {
  id: number;
  name: string;
  sku: string;
  unit: ProductUnit;
  stock: number;
  purchasePrice: number | null;
  salePrice: number;
  costValue: number | null;
  publicValue: number;
}

export interface ReportInventoryResult extends ReportPage<ReportInventoryRow> {
  summary: {
    count: number;
    stock: number;
    cost: number | null;
    publicValue: number;
    stockByUnit: { unit: ProductUnit; quantity: number }[];
  };
}

export interface ReportRestockResult extends ReportPage<ReportInventoryRow> {
  threshold: number;
}

export type ProductMovementKind =
  | "INITIAL"
  | "CREATE"
  | "SALE"
  | "RETURN"
  | "ADJUSTMENT"
  | "DELETE"
  | "PURCHASE";

export interface ReportMovementRow {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  unit: ProductUnit;
  kind: ProductMovementKind;
  quantity: number;
  stockBefore: number | null;
  stockAfter: number | null;
  saleId: number | null;
  folio: string;
  reason: string;
  createdAt: string;
}

export interface ReportMovementsResult extends ReportPage<ReportMovementRow> {
  trackingStartedAt: string;
}

export type ReportExportInput =
  | { kind: "sales"; query: ReportSalesQuery }
  | { kind: "inventory"; query: ReportPageQuery };

export interface ReportExportResult {
  saved: boolean;
  path?: string;
}

export interface ReportsApi {
  sales: (query: ReportSalesQuery) => Promise<ReportSalesResult>;
  cuts: (query: ReportPageQuery) => Promise<ReportPage<ReportCutRow>>;
  audit: () => Promise<ReportAuditRow[]>;
  inventory: (query: ReportPageQuery) => Promise<ReportInventoryResult>;
  restock: (query: ReportPageQuery) => Promise<ReportRestockResult>;
  movements: (query: ReportPageQuery) => Promise<ReportMovementsResult>;
  exportExcel: (input: ReportExportInput) => Promise<ReportExportResult>;
}

export interface CreateSaleInput {
  registerSessionId: number;
  customerId: number | null;
  items: SaleItemInput[];
  payments: SalePaymentInput[];
  discount: number;
  notes: string | null;
  creditAmount: number;
}

export type AccountMovementKind = "CHARGE" | "PAYMENT" | "REFUND";

export interface SystemPrinter {
  name: string;
  displayName: string;
  description: string;
}

export interface PrintTestTicketInput {
  printerName: string;
  paperWidth: 58 | 80;
  margins: PrinterMargins;
}

export interface PrintSaleTicketInput {
  ticketId: number;
  printerName: string;
  settings: TicketPrintSettings;
  margins: PrinterMargins;
  logoPath: string;
}

export interface PrinterMargins {
  leftMm: number;
  rightMm: number;
  topMm: number;
  bottomMm: number;
}

export const DEFAULT_PRINTER_MARGINS: PrinterMargins = {
  leftMm: 6,
  rightMm: 5,
  topMm: 2,
  bottomMm: 3,
};
export const MAX_PRINTER_SIDE_MARGIN_MM = 12;
export const MAX_PRINTER_VERTICAL_MARGIN_MM = 30;

function isValidMargin(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= maximum
  );
}

export function normalizePrinterMargins(
  value: unknown,
  legacyTopMarginPx?: unknown,
): PrinterMargins {
  const saved =
    value && typeof value === "object"
      ? (value as Partial<PrinterMargins>)
      : {};
  // El diseño anterior añadía 8 px al margen superior configurado.
  const migratedTop =
    typeof legacyTopMarginPx === "number" && Number.isFinite(legacyTopMarginPx)
      ? Math.round(
          (((8 + Math.max(0, Math.min(60, legacyTopMarginPx))) * 25.4) / 96) *
            10,
        ) / 10
      : DEFAULT_PRINTER_MARGINS.topMm;
  return {
    leftMm: isValidMargin(saved.leftMm, MAX_PRINTER_SIDE_MARGIN_MM)
      ? saved.leftMm
      : DEFAULT_PRINTER_MARGINS.leftMm,
    rightMm: isValidMargin(saved.rightMm, MAX_PRINTER_SIDE_MARGIN_MM)
      ? saved.rightMm
      : DEFAULT_PRINTER_MARGINS.rightMm,
    topMm: isValidMargin(saved.topMm, MAX_PRINTER_VERTICAL_MARGIN_MM)
      ? saved.topMm
      : migratedTop,
    bottomMm: isValidMargin(saved.bottomMm, MAX_PRINTER_VERTICAL_MARGIN_MM)
      ? saved.bottomMm
      : DEFAULT_PRINTER_MARGINS.bottomMm,
  };
}

export function isValidPrinterMargins(value: unknown): value is PrinterMargins {
  if (!value || typeof value !== "object") return false;
  const margins = value as Partial<PrinterMargins>;
  return (
    isValidMargin(margins.leftMm, MAX_PRINTER_SIDE_MARGIN_MM) &&
    isValidMargin(margins.rightMm, MAX_PRINTER_SIDE_MARGIN_MM) &&
    isValidMargin(margins.topMm, MAX_PRINTER_VERTICAL_MARGIN_MM) &&
    isValidMargin(margins.bottomMm, MAX_PRINTER_VERTICAL_MARGIN_MM)
  );
}

export interface AccountMovement {
  kind: AccountMovementKind;
  id: number;
  date: string;
  description: string;
  amount: number;
  method?: PaymentMethod;
  status?: SaleStatus;
}

export const IPC_CHANNELS = {
  productsList: "products:list",
  productsCreate: "products:create",
  productsUpdate: "products:update",
  productsDelete: "products:delete",
  productsAdjustStock: "products:adjust-stock",
  imagesSave: "images:save",
  imagesRead: "images:read",
  customersList: "customers:list",
  customersCreate: "customers:create",
  customersUpdate: "customers:update",
  customersDelete: "customers:delete",
  customersMovements: "customers:movements",
  paymentsList: "payments:list",
  paymentsCreate: "payments:create",
  salesListByCustomer: "sales:listByCustomer",
  salesCreate: "sales:create",
  salesItems: "sales:items",
  salesHistory: "sales:history",
  salesDetail: "sales:detail",
  salesEnsureTicket: "sales:ensure-ticket",
  salesReturnDetail: "sales:return-detail",
  salesReturnCreate: "sales:return-create",
  reportsSales: "reports:sales",
  reportsCuts: "reports:cuts",
  reportsAudit: "reports:audit",
  reportsInventory: "reports:inventory",
  reportsRestock: "reports:restock",
  reportsMovements: "reports:movements",
  reportsExportExcel: "reports:export-excel",
  registerOpen: "register:open",
  registerClose: "register:close",
  registerCurrent: "register:current",
  registerMovementCreate: "register:movement:create",
  registerMovementList: "register:movement:list",
  ticketsCreate: "tickets:create",
  ticketsGet: "tickets:get",
  ticketsList: "tickets:list",
  appGetTimezone: "app:get-timezone",
  printersList: "printers:list",
  printersPrintTest: "printers:print-test",
  printersPrintSale: "printers:print-sale",
  printersPrintNote: "printers:print-note",
} as const;
