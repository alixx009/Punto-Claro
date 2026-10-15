import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { IPC_CHANNELS } from "../shared/ipc";
import { AUTH_CHANNELS } from "../shared/auth";
import { BACKUP_CHANNELS, type BackupApi } from "../shared/backup";
import type { AuthApi, UsersApi } from "../shared/auth";
import { SUPPLIER_CHANNELS, type SuppliersApi } from "../shared/suppliers";
import { PURCHASE_CHANNELS, type PurchasesApi } from "../shared/purchases";
import {
  PRODUCT_IMPORT_CHANNELS,
  type ProductImportApi,
} from "../shared/product-import";
import { UPDATE_CHANNELS } from "../shared/updates";
import type { UpdatesApi, UpdateState } from "../shared/updates";
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

// Custom APIs for renderer
const api = {
  backup: {
    exportExcel: (input) =>
      ipcRenderer.invoke(BACKUP_CHANNELS.exportExcel, input),
    preview: () => ipcRenderer.invoke(BACKUP_CHANNELS.preview),
    restore: (input) => ipcRenderer.invoke(BACKUP_CHANNELS.restore, input),
    discardPreview: (token) =>
      ipcRenderer.invoke(BACKUP_CHANNELS.discardPreview, token),
    pendingSettings: () => ipcRenderer.invoke(BACKUP_CHANNELS.pendingSettings),
    acknowledgeSettings: (token) =>
      ipcRenderer.invoke(BACKUP_CHANNELS.acknowledgeSettings, token),
  } satisfies BackupApi,
  auth: {
    current: () => ipcRenderer.invoke(AUTH_CHANNELS.current),
    setupRequired: () => ipcRenderer.invoke(AUTH_CHANNELS.setupRequired),
    setupAdmin: (input) => ipcRenderer.invoke(AUTH_CHANNELS.setupAdmin, input),
    login: (input) => ipcRenderer.invoke(AUTH_CHANNELS.login, input),
    logout: () => ipcRenderer.invoke(AUTH_CHANNELS.logout),
    changePassword: (input) =>
      ipcRenderer.invoke(AUTH_CHANNELS.changePassword, input),
  } satisfies AuthApi,
  users: {
    list: () => ipcRenderer.invoke(AUTH_CHANNELS.usersList),
    create: (input) => ipcRenderer.invoke(AUTH_CHANNELS.usersCreate, input),
    update: (id, input) =>
      ipcRenderer.invoke(AUTH_CHANNELS.usersUpdate, id, input),
  } satisfies UsersApi,
  suppliers: {
    list: () => ipcRenderer.invoke(SUPPLIER_CHANNELS.list),
    create: (input) => ipcRenderer.invoke(SUPPLIER_CHANNELS.create, input),
    update: (id, input) =>
      ipcRenderer.invoke(SUPPLIER_CHANNELS.update, id, input),
    remove: (id) => ipcRenderer.invoke(SUPPLIER_CHANNELS.remove, id),
  } satisfies SuppliersApi,
  purchases: {
    list: (query) => ipcRenderer.invoke(PURCHASE_CHANNELS.list, query),
    get: (id) => ipcRenderer.invoke(PURCHASE_CHANNELS.get, id),
    searchProducts: (search) =>
      ipcRenderer.invoke(PURCHASE_CHANNELS.searchProducts, search),
    create: (input) => ipcRenderer.invoke(PURCHASE_CHANNELS.create, input),
  } satisfies PurchasesApi,
  productImport: {
    downloadTemplate: (input) =>
      ipcRenderer.invoke(PRODUCT_IMPORT_CHANNELS.downloadTemplate, input),
    exportExcel: (input) =>
      ipcRenderer.invoke(PRODUCT_IMPORT_CHANNELS.exportExcel, input),
    preview: (input) =>
      ipcRenderer.invoke(PRODUCT_IMPORT_CHANNELS.preview, input),
    commit: (input) =>
      ipcRenderer.invoke(PRODUCT_IMPORT_CHANNELS.commit, input),
  } satisfies ProductImportApi,
  reports: {
    sales: (query) => ipcRenderer.invoke(IPC_CHANNELS.reportsSales, query),
    cuts: (query) => ipcRenderer.invoke(IPC_CHANNELS.reportsCuts, query),
    audit: () => ipcRenderer.invoke(IPC_CHANNELS.reportsAudit),
    inventory: (query) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsInventory, query),
    restock: (query) => ipcRenderer.invoke(IPC_CHANNELS.reportsRestock, query),
    movements: (query) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsMovements, query),
    exportExcel: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsExportExcel, input),
  } satisfies ReportsApi,
  products: {
    list: (): Promise<Product[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.productsList),
    create: (input: CreateProductInput): Promise<Product> =>
      ipcRenderer.invoke(IPC_CHANNELS.productsCreate, input),
    update: (id: number, input: UpdateProductInput): Promise<Product | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.productsUpdate, id, input),
    remove: (id: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.productsDelete, id),
    adjustStock: (input: AdjustStockInput): Promise<Product | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.productsAdjustStock, input),
  },
  images: {
    save: (dataUrl: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.imagesSave, dataUrl),
    read: (localPath: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.imagesRead, localPath),
  },
  customers: {
    list: (): Promise<CustomerWithBalance[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.customersList),
    create: (input: CreateCustomerInput): Promise<Customer> =>
      ipcRenderer.invoke(IPC_CHANNELS.customersCreate, input),
    update: (
      id: number,
      input: UpdateCustomerInput,
    ): Promise<Customer | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.customersUpdate, id, input),
    remove: (id: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.customersDelete, id),
    movements: (id: number): Promise<AccountMovement[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.customersMovements, id),
  },
  payments: {
    list: (): Promise<Payment[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.paymentsList),
    create: (input: CreatePaymentInput): Promise<Payment> =>
      ipcRenderer.invoke(IPC_CHANNELS.paymentsCreate, input),
  },
  sales: {
    returnDetail: (id: number): Promise<SaleReturnDetail> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesReturnDetail, id),
    returnCreate: (input: CreateSaleReturnInput): Promise<SaleReturnResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesReturnCreate, input),
    history: (query: SalesHistoryQuery): Promise<SalesHistoryResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesHistory, query),
    detail: (id: number): Promise<SalesHistoryDetail | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesDetail, id),
    ensureTicket: (input: EnsureSaleTicketInput): Promise<Ticket> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesEnsureTicket, input),
    create: (input: CreateSaleInput): Promise<Sale> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesCreate, input),
    items: (id: number): Promise<SaleItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.salesItems, id),
  },
  register: {
    current: (): Promise<RegisterSession | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.registerCurrent),
    open: (input: OpenRegisterInput): Promise<RegisterSession> =>
      ipcRenderer.invoke(IPC_CHANNELS.registerOpen, input),
    close: (input: CloseRegisterInput): Promise<RegisterSession> =>
      ipcRenderer.invoke(IPC_CHANNELS.registerClose, input),
    movement: {
      create: (input: CreateCashMovementInput): Promise<CashMovement> =>
        ipcRenderer.invoke(IPC_CHANNELS.registerMovementCreate, input),
      list: (sessionId: number): Promise<CashMovement[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.registerMovementList, sessionId),
    },
  },
  tickets: {
    create: (input: CreateTicketInput): Promise<Ticket> =>
      ipcRenderer.invoke(IPC_CHANNELS.ticketsCreate, input),
    get: (id: number): Promise<Ticket | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.ticketsGet, id),
    list: (): Promise<Ticket[]> => ipcRenderer.invoke(IPC_CHANNELS.ticketsList),
  },
  app: {
    getTimezone: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.appGetTimezone),
  },
  updates: {
    getState: (): Promise<UpdateState> =>
      ipcRenderer.invoke(UPDATE_CHANNELS.getState),
    check: (): Promise<UpdateState> =>
      ipcRenderer.invoke(UPDATE_CHANNELS.check),
    download: (): Promise<void> =>
      ipcRenderer.invoke(UPDATE_CHANNELS.download),
    install: (): Promise<void> =>
      ipcRenderer.invoke(UPDATE_CHANNELS.install),
    onStateChanged: (listener) => {
      const handler = (_event: IpcRendererEvent, state: UpdateState): void =>
        listener(state);
      ipcRenderer.on(UPDATE_CHANNELS.stateChanged, handler);
      return () => ipcRenderer.removeListener(UPDATE_CHANNELS.stateChanged, handler);
    },
  } satisfies UpdatesApi,
  printers: {
    printNote: (input: PrintSaleNoteInput): Promise<PrintNoteResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.printersPrintNote, input),
    list: (): Promise<SystemPrinter[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.printersList),
    printTest: (input: PrintTestTicketInput): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.printersPrintTest, input),
    printSale: (input: PrintSaleTicketInput): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.printersPrintSale, input),
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
