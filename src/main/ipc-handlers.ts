import { ipcMain } from "electron";
import { BACKUP_CHANNELS } from "../shared/backup";
import {
  exportDatabaseExcel,
  previewDatabaseRestore,
  restoreDatabaseExcel,
  discardDatabasePreview,
  pendingBackupSettings,
  acknowledgeBackupSettings,
} from "./backup";
import { assertDataAvailable } from "./backup/state";
import { AUTH_CHANNELS } from "../shared/auth";
import type { AuthUser } from "../shared/auth";
import { IPC_CHANNELS } from "../shared/ipc";
import { SUPPLIER_CHANNELS } from "../shared/suppliers";
import { PURCHASE_CHANNELS } from "../shared/purchases";
import { PRODUCT_IMPORT_CHANNELS } from "../shared/product-import";
import {
  downloadProductsTemplate,
  exportProductsExcel,
  previewProductsImport,
  confirmProductsImport,
} from "./product-import";
import type { Product, ReportInventoryRow } from "../shared/ipc";
import {
  login,
  logout,
  getCurrentAuthSession,
  isInitialSetupRequired,
  setupInitialAdmin,
  requireAdmin,
  listUsers,
  createUser,
  updateUser,
  changePassword,
} from "./auth";
import {
  authenticatedHandle as handle,
  assertTrustedSender,
  assertCanOperateRegister,
  hasPermission,
} from "./ipc-security";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from "./db/database";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listMovements,
} from "./db/customers";
import { listPayments, createPayment } from "./db/payments";
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "./db/suppliers";
import {
  listPurchases,
  getPurchase,
  searchPurchaseProducts,
  createPurchase,
} from "./db/purchases";
import {
  getCurrentSession,
  openSession,
  closeSession,
  createCashMovement,
  listCashMovements,
} from "./db/register";
import { createTicket, getTicket, listTickets } from "./db/tickets";
import { createSale, listSaleItems } from "./db/sales";
import { createSaleReturn, getSaleReturnDetail } from "./db/sale-returns";
import {
  ensureSaleTicket,
  getSaleHistoryDetail,
  listSalesHistory,
} from "./db/sales-history";
import {
  reportSales,
  reportCuts,
  reportAudit,
  reportInventory,
  reportRestock,
  reportMovements,
} from "./db/reports";
import { exportReportExcel } from "./reports-export";
import { saveImage, readImage } from "./files/images";
import {
  listSystemPrinters,
  printSaleTicket,
  printSaleNote,
  printTestTicket,
} from "./printing";

function visibleProduct(product: Product, user: AuthUser): Product {
  return hasPermission(user, "costs.view")
    ? product
    : { ...product, purchasePrice: null };
}
function visibleInventoryRow(
  row: ReportInventoryRow,
  user: AuthUser,
): ReportInventoryRow {
  return hasPermission(user, "costs.view")
    ? row
    : { ...row, purchasePrice: null, costValue: null };
}

function captureAdminSession(senderId: number): () => void {
  const sessionId = getCurrentAuthSession(senderId)?.id;
  if (!sessionId)
    throw new Error("AUTH_REQUIRED: Inicia sesión para continuar.");
  return () => {
    assertDataAvailable();
    const current = getCurrentAuthSession(senderId);
    if (!current || current.id !== sessionId) {
      throw new Error(
        "AUTH_REQUIRED: La sesión cambió. Inicia sesión de nuevo.",
      );
    }
    requireAdmin(senderId);
  };
}

export function registerIpcHandlers(): void {
  handle(
    BACKUP_CHANNELS.exportExcel,
    (event, _user, input) => exportDatabaseExcel(event.sender, input),
    "admin",
  );
  handle(
    BACKUP_CHANNELS.preview,
    (event) => previewDatabaseRestore(event.sender),
    "admin",
  );
  handle(
    BACKUP_CHANNELS.restore,
    (event, _user, input) => restoreDatabaseExcel(event.sender, input),
    "admin",
  );
  handle(
    BACKUP_CHANNELS.discardPreview,
    (event, _user, token) => discardDatabasePreview(event.sender, token),
    "admin",
  );
  ipcMain.handle(BACKUP_CHANNELS.pendingSettings, (event) => {
    assertTrustedSender(event);
    assertDataAvailable();
    return pendingBackupSettings();
  });
  ipcMain.handle(BACKUP_CHANNELS.acknowledgeSettings, (event, token) => {
    assertTrustedSender(event);
    assertDataAvailable();
    acknowledgeBackupSettings(token);
  });
  ipcMain.handle(AUTH_CHANNELS.setupRequired, (event) => {
    assertTrustedSender(event);
    return isInitialSetupRequired();
  });
  ipcMain.handle(AUTH_CHANNELS.setupAdmin, (event, input) => {
    assertTrustedSender(event);
    return setupInitialAdmin(event.sender.id, input, () =>
      assertTrustedSender(event),
    );
  });
  ipcMain.handle(AUTH_CHANNELS.current, (event) => {
    assertTrustedSender(event);
    return getCurrentAuthSession(event.sender.id);
  });
  ipcMain.handle(AUTH_CHANNELS.login, (event, input) => {
    assertTrustedSender(event);
    assertDataAvailable();
    return login(event.sender.id, input);
  });
  ipcMain.handle(AUTH_CHANNELS.logout, (event) => {
    assertTrustedSender(event);
    logout(event.sender.id);
  });
  ipcMain.handle(AUTH_CHANNELS.changePassword, (event, input) => {
    assertTrustedSender(event);
    assertDataAvailable();
    return changePassword(event.sender.id, input);
  });
  handle(AUTH_CHANNELS.usersList, () => listUsers(), "admin");
  handle(
    AUTH_CHANNELS.usersCreate,
    (event, user, input) =>
      createUser(input, user.id, captureAdminSession(event.sender.id)),
    "admin",
  );
  handle(
    AUTH_CHANNELS.usersUpdate,
    (event, user, id, input) =>
      updateUser(user.id, id, input, captureAdminSession(event.sender.id)),
    "admin",
  );

  handle(SUPPLIER_CHANNELS.list, () => listSuppliers(), "admin");
  handle(
    SUPPLIER_CHANNELS.create,
    (_event, _user, input) => createSupplier(input),
    "admin",
  );
  handle(
    SUPPLIER_CHANNELS.update,
    (_event, _user, id, input) => updateSupplier(id, input),
    "admin",
  );
  handle(
    SUPPLIER_CHANNELS.remove,
    (_event, _user, id) => deleteSupplier(id),
    "admin",
  );

  handle(
    PURCHASE_CHANNELS.list,
    (_event, _user, query) => listPurchases(query),
    "admin",
  );
  handle(
    PURCHASE_CHANNELS.get,
    (_event, _user, id) => getPurchase(id),
    "admin",
  );
  handle(
    PURCHASE_CHANNELS.searchProducts,
    (_event, _user, search) => searchPurchaseProducts(search),
    "admin",
  );
  handle(
    PURCHASE_CHANNELS.create,
    (_event, user, input) =>
      createPurchase(input, { id: user.id, displayName: user.displayName }),
    "admin",
  );

  handle(
    PRODUCT_IMPORT_CHANNELS.downloadTemplate,
    (event, _user, input) => downloadProductsTemplate(event.sender, input),
    "admin",
  );
  handle(
    PRODUCT_IMPORT_CHANNELS.exportExcel,
    (event, _user, input) => exportProductsExcel(event.sender, input),
    "admin",
  );
  handle(
    PRODUCT_IMPORT_CHANNELS.preview,
    (event, _user, input) => previewProductsImport(event.sender, input),
    "admin",
  );
  handle(
    PRODUCT_IMPORT_CHANNELS.commit,
    (event, _user, input) => confirmProductsImport(event.sender, input),
    "admin",
  );

  handle(IPC_CHANNELS.productsList, (_event, user) =>
    listProducts().map((product) => visibleProduct(product, user)),
  );
  handle(
    IPC_CHANNELS.productsCreate,
    (_event, _user, input) => createProduct(input),
    "admin",
  );
  handle(
    IPC_CHANNELS.productsUpdate,
    (_event, _user, id, input) => updateProduct(id, input),
    "admin",
  );
  handle(
    IPC_CHANNELS.productsDelete,
    (_event, _user, id) => deleteProduct(id),
    "admin",
  );
  handle(
    IPC_CHANNELS.productsAdjustStock,
    (_event, _user, input) => adjustStock(input.productId, input.delta),
    "admin",
  );
  handle(IPC_CHANNELS.imagesSave, (_event, _user, dataUrl) =>
    saveImage(dataUrl),
  );
  handle(IPC_CHANNELS.imagesRead, (_event, _user, path) => readImage(path));
  handle(IPC_CHANNELS.customersList, () => listCustomers());
  handle(IPC_CHANNELS.customersCreate, (_event, _user, input) =>
    createCustomer(input),
  );
  handle(IPC_CHANNELS.customersUpdate, (_event, _user, id, input) =>
    updateCustomer(id, input),
  );
  handle(
    IPC_CHANNELS.customersDelete,
    (_event, _user, id) => deleteCustomer(id),
    "admin",
  );
  handle(IPC_CHANNELS.customersMovements, (_event, _user, id) =>
    listMovements(id),
  );
  handle(IPC_CHANNELS.paymentsList, () => listPayments());
  handle(IPC_CHANNELS.paymentsCreate, (_event, user, input) => {
    assertCanOperateRegister(user, input?.registerSessionId);
    return createPayment(input, user);
  });
  handle(IPC_CHANNELS.registerCurrent, () => getCurrentSession());
  handle(IPC_CHANNELS.registerOpen, (_event, user, input) =>
    openSession(input, user),
  );
  handle(IPC_CHANNELS.registerClose, (_event, user, input) => {
    assertCanOperateRegister(user);
    return closeSession(input, user);
  });
  handle(
    IPC_CHANNELS.registerMovementCreate,
    (_event, user, input) => {
      assertCanOperateRegister(user, input?.sessionId);
      return createCashMovement(input, user);
    },
    "cash.adjust",
  );
  handle(
    IPC_CHANNELS.registerMovementList,
    (_event, user, sessionId) => {
      // Cashiers can review movements of their current shift; reports are a separate permission.
      if (!hasPermission(user, "reports.view") && user.role !== "admin")
        assertCanOperateRegister(user, sessionId);
      return listCashMovements(sessionId);
    },
    "cash.adjust",
  );
  handle(IPC_CHANNELS.ticketsCreate, (_event, _user, input) =>
    createTicket(input),
  );
  handle(IPC_CHANNELS.ticketsGet, (_event, _user, id) => getTicket(id));
  handle(IPC_CHANNELS.ticketsList, () => listTickets());
  ipcMain.handle(IPC_CHANNELS.appGetTimezone, (event) => {
    assertTrustedSender(event);
    return process.env.TZ;
  });
  handle(IPC_CHANNELS.printersList, (event) =>
    listSystemPrinters(event.sender),
  );
  handle(IPC_CHANNELS.printersPrintTest, (event, _user, input) =>
    printTestTicket(event.sender, input),
  );
  handle(IPC_CHANNELS.printersPrintSale, (event, _user, input) =>
    printSaleTicket(event.sender, input),
  );
  handle(IPC_CHANNELS.printersPrintNote, (event, _user, input) =>
    printSaleNote(event.sender, input),
  );
  handle(
    IPC_CHANNELS.reportsSales,
    (_event, user, query) => {
      const result = reportSales(query);
      return hasPermission(user, "costs.view")
        ? result
        : {
            ...result,
            summary: { ...result.summary, profit: null, missingCostSales: 0 },
          };
    },
    "reports.view",
  );
  handle(
    IPC_CHANNELS.reportsCuts,
    (_event, _user, query) => reportCuts(query),
    "reports.view",
  );
  handle(IPC_CHANNELS.reportsAudit, () => reportAudit(), "reports.view");
  handle(
    IPC_CHANNELS.reportsInventory,
    (_event, user, query) => {
      const result = reportInventory(query);
      return {
        ...result,
        rows: result.rows.map((row) => visibleInventoryRow(row, user)),
        summary: {
          ...result.summary,
          cost: hasPermission(user, "costs.view") ? result.summary.cost : null,
        },
      };
    },
    ["reports.view", "stock.inspect"],
  );
  handle(
    IPC_CHANNELS.reportsRestock,
    (_event, user, query) => {
      const result = reportRestock(query);
      return {
        ...result,
        rows: result.rows.map((row) => visibleInventoryRow(row, user)),
      };
    },
    ["reports.view", "stock.inspect"],
  );
  handle(
    IPC_CHANNELS.reportsMovements,
    (_event, _user, query) => reportMovements(query),
    ["reports.view", "stock.inspect"],
  );
  handle(
    IPC_CHANNELS.reportsExportExcel,
    (event, user, input) => {
      if (
        input?.kind === "inventory" &&
        !hasPermission(user, "stock.inspect")
      ) {
        throw new Error(
          "AUTH_FORBIDDEN: No tienes permiso para consultar el inventario.",
        );
      }
      return exportReportExcel(
        event.sender,
        input,
        hasPermission(user, "costs.view"),
      );
    },
    "reports.view",
  );
  handle(IPC_CHANNELS.salesCreate, (_event, user, input) => {
    assertCanOperateRegister(user, input?.registerSessionId);
    if (input?.discount > 0 && !hasPermission(user, "discounts.apply")) {
      throw new Error(
        "AUTH_FORBIDDEN: No tienes permiso para aplicar descuentos.",
      );
    }
    return createSale(input, user);
  });
  handle(IPC_CHANNELS.salesItems, (_event, _user, id) => listSaleItems(id));
  handle(IPC_CHANNELS.salesHistory, (_event, _user, query) =>
    listSalesHistory(query),
  );
  handle(IPC_CHANNELS.salesDetail, (_event, _user, id) =>
    getSaleHistoryDetail(id),
  );
  handle(IPC_CHANNELS.salesReturnDetail, (_event, _user, id) =>
    getSaleReturnDetail(id),
  );
  handle(IPC_CHANNELS.salesReturnCreate, (_event, user, input) => {
    assertCanOperateRegister(user, input?.registerSessionId);
    return createSaleReturn(input, user);
  });
  handle(IPC_CHANNELS.salesEnsureTicket, (_event, _user, input) =>
    ensureSaleTicket(input),
  );
}
