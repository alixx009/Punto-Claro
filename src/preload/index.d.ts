import { ElectronAPI } from "@electron-toolkit/preload";
import type { BackupApi } from "../shared/backup";
import type { AuthApi, UsersApi } from "../shared/auth";
import type { SuppliersApi } from "../shared/suppliers";
import type { PurchasesApi } from "../shared/purchases";
import type { ProductImportApi } from "../shared/product-import";
import type {
  CreateSaleReturnInput,
  SaleReturnDetail,
  SaleReturnResult,
  AccountMovement,
  AdjustStockInput,
  CashMovement,
  CloseRegisterInput,
  CreateCashMovementInput,
  CreateCustomerInput,
  CreatePaymentInput,
  CreateProductInput,
  CreateSaleInput,
  CreateTicketInput,
  Customer,
  CustomerWithBalance,
  OpenRegisterInput,
  Payment,
  Product,
  PrintTestTicketInput,
  PrintSaleTicketInput,
  PrintSaleNoteInput,
  PrintNoteResult,
  EnsureSaleTicketInput,
  SalesHistoryQuery,
  SalesHistoryResult,
  SalesHistoryDetail,
  RegisterSession,
  ReportsApi,
  Sale,
  SaleItem,
  SystemPrinter,
  Ticket,
  UpdateCustomerInput,
  UpdateProductInput,
} from "../shared/ipc";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      backup: BackupApi;
      auth: AuthApi;
      users: UsersApi;
      suppliers: SuppliersApi;
      purchases: PurchasesApi;
      productImport: ProductImportApi;
      reports: ReportsApi;
      products: {
        list: () => Promise<Product[]>;
        create: (input: CreateProductInput) => Promise<Product>;
        update: (
          id: number,
          input: UpdateProductInput,
        ) => Promise<Product | null>;
        remove: (id: number) => Promise<boolean>;
        adjustStock: (input: AdjustStockInput) => Promise<Product | null>;
      };
      images: {
        save: (dataUrl: string) => Promise<string>;
        read: (localPath: string) => Promise<string | null>;
      };
      customers: {
        list: () => Promise<CustomerWithBalance[]>;
        create: (input: CreateCustomerInput) => Promise<Customer>;
        update: (
          id: number,
          input: UpdateCustomerInput,
        ) => Promise<Customer | null>;
        remove: (id: number) => Promise<boolean>;
        movements: (id: number) => Promise<AccountMovement[]>;
      };
      payments: {
        list: () => Promise<Payment[]>;
        create: (input: CreatePaymentInput) => Promise<Payment>;
      };
      sales: {
        returnDetail: (id: number) => Promise<SaleReturnDetail>;
        returnCreate: (
          input: CreateSaleReturnInput,
        ) => Promise<SaleReturnResult>;
        history: (query: SalesHistoryQuery) => Promise<SalesHistoryResult>;
        detail: (id: number) => Promise<SalesHistoryDetail | null>;
        ensureTicket: (input: EnsureSaleTicketInput) => Promise<Ticket>;
        create: (input: CreateSaleInput) => Promise<Sale>;
        items: (id: number) => Promise<SaleItem[]>;
      };
      register: {
        current: () => Promise<RegisterSession | null>;
        open: (input: OpenRegisterInput) => Promise<RegisterSession>;
        close: (input: CloseRegisterInput) => Promise<RegisterSession>;
        movement: {
          create: (input: CreateCashMovementInput) => Promise<CashMovement>;
          list: (sessionId: number) => Promise<CashMovement[]>;
        };
      };
      tickets: {
        create: (input: CreateTicketInput) => Promise<Ticket>;
        get: (id: number) => Promise<Ticket | null>;
        list: () => Promise<Ticket[]>;
      };
      app: {
        getTimezone: () => Promise<string>;
      };
      printers: {
        printNote: (input: PrintSaleNoteInput) => Promise<PrintNoteResult>;
        list: () => Promise<SystemPrinter[]>;
        printTest: (input: PrintTestTicketInput) => Promise<void>;
        printSale: (input: PrintSaleTicketInput) => Promise<void>;
      };
    };
  }
}
