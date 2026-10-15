import { app } from "electron";
import { join } from "path";
import Database from "better-sqlite3";
import { initializeSaleFolios } from "./folios";
import { migrateSaleReturns } from "./returns-migration";
import { initializeAuth } from "../auth";
import { migrateOperationActors } from "./operator-migration";
import { migrateSuppliers } from "./suppliers-migration";
import { migratePurchases } from "./purchases-migration";
import { migrateProductImports } from "./product-import-migration";
import {
  initializeInventoryLedger,
  recordStockMovement,
} from "./inventory-ledger";
import type {
  CreateProductInput,
  Product,
  ProductUnit,
  UpdateProductInput,
} from "../../shared/ipc";
import { PRODUCT_STOCK_LIMIT } from "../../shared/ipc";

let db: Database.Database | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_backup_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    settings_json TEXT NOT NULL,
    restore_pending INTEGER NOT NULL DEFAULT 0 CHECK (restore_pending IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    provider_code TEXT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('PIEZA', 'KG', 'PAQ')),
    purchase_price REAL NOT NULL DEFAULT 0,
    wholesale_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    stock REAL NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL DEFAULT '',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (app_now()),
    updated_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    image_url TEXT,
    credit_limit REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (app_now()),
    updated_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

  CREATE TABLE IF NOT EXISTS register_cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES register_sessions (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
    amount REAL NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON register_cash_movements (session_id);

  CREATE TABLE IF NOT EXISTS register_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_name TEXT NOT NULL DEFAULT 'ADMIN',
    opening_amount REAL NOT NULL DEFAULT 0,
    opened_at TEXT NOT NULL DEFAULT (app_now()),
    closed_at TEXT,
    closing_amount REAL,
    expected_amount REAL,
    difference REAL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_register_sessions_status ON register_sessions (status);

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers (id) ON DELETE RESTRICT,
    register_session_id INTEGER,
    status TEXT NOT NULL CHECK (status IN ('PAID', 'PARTIAL', 'PENDING')),
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    credit_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (app_now()),
    updated_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales (customer_id);
  CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);
  CREATE INDEX IF NOT EXISTS idx_sales_created ON sales (created_at);

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    purchase_cost REAL,
    created_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers (id) ON DELETE RESTRICT,
    sale_id INTEGER,
    amount REAL NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('CASH', 'DEBIT', 'CREDIT', 'CARD', 'TRANSFER', 'VOUCHER', 'OTHER')),
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments (customer_id);
  CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at);

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL UNIQUE REFERENCES sales (id) ON DELETE RESTRICT,
    folio TEXT NOT NULL,
    payload TEXT NOT NULL,
    total_amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (app_now())
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_folio ON tickets (folio);
  CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets (created_at);
`;

// Helper: formatea `new Date()` en la TZ de la app como string SQLite-compatible.
// Lo registramos como función SQL `app_now()` porque `datetime('now', 'localtime')`
// no respeta la variable de entorno TZ en Windows.
function formatNowInAppTz(): string {
  const tz = process.env.TZ || "America/Mexico_City";
  const d = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  } catch {
    return d.toISOString().replace("T", " ").slice(0, 19);
  }
}

export function nowInAppTz(): string {
  return formatNowInAppTz();
}

const SELECT_PRODUCT_COLUMNS = `
  id, sku, provider_code, name, unit, purchase_price,
  wholesale_price, sale_price, category, brand, stock,
  image_url, notes, created_at, updated_at
`;

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = join(app.getPath("userData"), "pos.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.function("app_now", { deterministic: false, varargs: false }, () =>
    formatNowInAppTz(),
  );
  db.exec(SCHEMA);
  runMigrations(db);
  initializeAuth(db);
  migrateOperationActors(db);
  migrateSuppliers(db);
  migratePurchases(db);
  migrateProductImports(db);

  try {
    initializeSaleFolios(db);
  } catch (error) {
    db.close();
    db = null;
    throw error;
  }

  const counts = {
    products: getTableCount(db, "products"),
    customers: getTableCount(db, "customers"),
    sales: getTableCount(db, "sales"),
    payments: getTableCount(db, "payments"),
  };
  initializeInventoryLedger(db);
  console.log(
    `[db] inicializada en ${dbPath} (${counts.products} productos, ${counts.customers} clientes, ${counts.sales} ventas, ${counts.payments} pagos)`,
  );
  return db;
}

function getTableCount(database: Database.Database, table: string): number {
  const { count } = database
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .get() as { count: number };
  return count;
}

function runMigrations(database: Database.Database): void {
  ensureColumn(database, "sales", "register_session_id", "INTEGER");
  ensureColumn(database, "payments", "sale_id", "INTEGER");
  ensureColumn(database, "payments", "register_session_id", "INTEGER");
  ensureColumn(database, "sales", "returned_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn(
    database,
    "sale_items",
    "returned_quantity",
    "REAL NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity)",
  );
  ensureColumn(database, "customers", "deleted_at", "TEXT");
  migrateCustomersCodeUnique(database);
  migratePaymentsCustomerNullable(database);
  migrateQuantitiesRounding(database);
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_payments_sale_method ON payments (sale_id, method)",
  );
  database
    .transaction(() => {
      ensureColumn(
        database,
        "register_sessions",
        "cashier_name",
        "TEXT NOT NULL DEFAULT 'ADMIN'",
      );
      ensureColumn(database, "sale_items", "purchase_cost", "REAL");
      database.exec(`CREATE TABLE IF NOT EXISTS product_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit TEXT NOT NULL CHECK (unit IN ('PIEZA', 'KG', 'PAQ')),
      kind TEXT NOT NULL CHECK (kind IN ('INITIAL', 'CREATE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DELETE')),
      quantity REAL NOT NULL,
      stock_before REAL,
      stock_after REAL,
      sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (app_now())
    );
    CREATE INDEX IF NOT EXISTS idx_product_movements_created ON product_movements(created_at, id);
    CREATE INDEX IF NOT EXISTS idx_product_movements_product ON product_movements(product_id, id);
    CREATE INDEX IF NOT EXISTS idx_payments_session_method ON payments(register_session_id, method);
    CREATE INDEX IF NOT EXISTS idx_register_sessions_opened ON register_sessions(opened_at);`);
    })
    .immediate();
  migrateSaleReturns(database);
}

function migrateQuantitiesRounding(database: Database.Database): void {
  const flag = database
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migration_round_quantities'`,
    )
    .get();
  if (flag) return;

  database.exec(`
    UPDATE products SET stock = ROUND(stock, 3);
    UPDATE sale_items SET quantity = ROUND(quantity, 3);

    CREATE TABLE _migration_round_quantities (
      applied_at TEXT NOT NULL DEFAULT (app_now())
    );
    INSERT INTO _migration_round_quantities DEFAULT VALUES;
  `);
  console.log(
    "[db] migración: stock y sale_items.quantity redondeados a 3 decimales",
  );
}

function migrateCustomersCodeUnique(database: Database.Database): void {
  const partialIndex = database
    .prepare(
      `SELECT 1 FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_customers_code_active'`,
    )
    .get();
  if (partialIndex) return;

  const hasCodeUnique = database
    .prepare(
      `SELECT 1 FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = 'customers'
          AND sql IS NULL
          AND name LIKE 'sqlite_autoindex_%'
        LIMIT 1`,
    )
    .get();
  if (!hasCodeUnique) {
    database.exec(
      `CREATE UNIQUE INDEX idx_customers_code_active
         ON customers (code) WHERE deleted_at IS NULL`,
    );
    return;
  }

  database.exec("PRAGMA foreign_keys = OFF");
  try {
    database.exec("BEGIN");
    database.exec(`
      CREATE TABLE customers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        image_url TEXT,
        credit_limit REAL NOT NULL DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (app_now()),
        updated_at TEXT NOT NULL DEFAULT (app_now())
      );

      INSERT INTO customers_new
        (id, code, name, phone, email, address, notes, image_url, credit_limit,
         deleted_at, created_at, updated_at)
      SELECT id, code, name, phone, email, address, notes, image_url, credit_limit,
             deleted_at, created_at, updated_at
        FROM customers;

      DROP TABLE customers;

      ALTER TABLE customers_new RENAME TO customers;

      CREATE INDEX idx_customers_name ON customers (name);
      CREATE INDEX idx_customers_phone ON customers (phone);

      CREATE UNIQUE INDEX idx_customers_code_active
        ON customers (code) WHERE deleted_at IS NULL;

      COMMIT;
    `);
    console.log(
      "[db] migración: customers.code UNIQUE reemplazado por índice único parcial",
    );
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

function migratePaymentsCustomerNullable(database: Database.Database): void {
  const columnInfo = database
    .prepare(`PRAGMA table_info(payments)`)
    .all() as Array<{ name: string; notnull: number }>;
  const customerCol = columnInfo.find((c) => c.name === "customer_id");
  if (!customerCol || customerCol.notnull === 0) return;

  database.exec("PRAGMA foreign_keys = OFF");
  try {
    database.exec("BEGIN");
    database.exec(`
      CREATE TABLE payments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers (id) ON DELETE RESTRICT,
        sale_id INTEGER,
        register_session_id INTEGER,
        amount REAL NOT NULL,
        method TEXT NOT NULL CHECK (method IN ('CASH', 'DEBIT', 'CREDIT', 'CARD', 'TRANSFER', 'VOUCHER', 'OTHER')),
        reference TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (app_now())
      );

      INSERT INTO payments_new (id, customer_id, sale_id, register_session_id, amount, method, reference, notes, created_at)
      SELECT id, customer_id, sale_id, register_session_id, amount, method, reference, notes, created_at
        FROM payments;

      DROP TABLE payments;

      ALTER TABLE payments_new RENAME TO payments;

      CREATE INDEX idx_payments_customer ON payments (customer_id);
      CREATE INDEX idx_payments_created ON payments (created_at);

      COMMIT;
    `);
    console.log(
      "[db] migración: payments.customer_id ahora permite NULL (para ventas públicas)",
    );
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (cols.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`[db] migración: agregada columna ${table}.${column}`);
}

export function getDb(): Database.Database {
  if (!db)
    throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

export function listProducts(): Product[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_PRODUCT_COLUMNS} FROM products ORDER BY id`)
    .all();

  return rows.map(mapProductRow);
}

export function createProduct(input: CreateProductInput): Product {
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO products (
          sku, provider_code, name, unit, purchase_price,
          wholesale_price, sale_price, category, brand, stock, image_url, notes
        ) VALUES (
          @sku, @providerCode, @name, @unit, @purchasePrice,
          @wholesalePrice, @salePrice, @category, @brand, @stock, @imageUrl, @notes
        )`,
      )
      .run({ ...input, notes: input.notes ?? null });

    const row = getDb()
      .prepare(`SELECT ${SELECT_PRODUCT_COLUMNS} FROM products WHERE id = ?`)
      .get(info.lastInsertRowid) as Record<string, unknown>;

    return mapProductRow(row);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: products.sku")
    ) {
      throw new Error(`Ya existe un producto con el SKU "${input.sku}".`);
    }
    throw error;
  }
}

export function updateProduct(
  id: number,
  input: UpdateProductInput,
): Product | null {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("El producto no es válido.");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Los datos del producto no son válidos.");
  return getDb()
    .transaction(() => updateProductInTransaction(id, input))
    .immediate();
}

function updateProductInTransaction(
  id: number,
  input: UpdateProductInput,
): Product | null {
  const database = getDb();
  const current = database
    .prepare(`SELECT * FROM products WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  if (!current) return null;

  const values = {
    sku: current.sku as string,
    providerCode: current.provider_code as string | null,
    name: current.name as string,
    unit: current.unit as ProductUnit,
    purchasePrice: current.purchase_price as number,
    wholesalePrice: current.wholesale_price as number,
    salePrice: current.sale_price as number,
    category: current.category as string,
    brand: current.brand as string,
    imageUrl: current.image_url as string,
    notes: (current.notes as string | null) ?? null,
    ...input,
  };

  const stockBefore = current.stock as number;
  let stockAfter = stockBefore;
  const changingStock = Object.prototype.hasOwnProperty.call(input, "stock");
  const changingUnit = values.unit !== current.unit;
  if (changingUnit && !changingStock)
    throw new Error(
      "Al cambiar la unidad de medida, captura también la existencia total en la nueva unidad.",
    );
  if (changingStock) {
    if (
      typeof input.expectedStock !== "number" ||
      !Number.isFinite(input.expectedStock) ||
      input.expectedStock !== stockBefore ||
      input.expectedUnit !== current.unit
    ) {
      throw new Error(
        "PRODUCT_STOCK_CHANGED: Las existencias o la unidad cambiaron mientras editabas. Actualiza las existencias del formulario y revisa la cantidad antes de guardar.",
      );
    }
    if (!["PIEZA", "KG", "PAQ"].includes(values.unit))
      throw new Error("La unidad de medida no es válida.");
    const precision = values.unit === "KG" ? 1000 : 1;
    if (
      typeof input.stock !== "number" ||
      !Number.isFinite(input.stock) ||
      input.stock < 0 ||
      input.stock > PRODUCT_STOCK_LIMIT ||
      !Number.isSafeInteger(Math.round(input.stock * precision)) ||
      (precision === 1 && !Number.isInteger(input.stock)) ||
      Math.abs(input.stock - Math.round(input.stock * precision) / precision) >
        1e-9
    ) {
      throw new Error(
        values.unit === "KG"
          ? "Las existencias por kilogramo deben ser de 0 a 1,000,000,000 y admitir hasta tres decimales."
          : "Las existencias por pieza o paquete deben ser enteras de 0 a 1,000,000,000.",
      );
    }
    stockAfter = Math.round(input.stock * precision) / precision;
  }

  let result: Database.RunResult;
  try {
    // Close the old unit balance before recording inventory in a different unit.
    if (changingUnit && stockBefore !== 0)
      recordStockMovement(
        database,
        id,
        -stockBefore,
        stockBefore,
        0,
        "ADJUSTMENT",
      );
    result = database
      .prepare(
        `UPDATE products SET
          sku = @sku, provider_code = @providerCode, name = @name, unit = @unit,
          purchase_price = @purchasePrice, wholesale_price = @wholesalePrice,
          sale_price = @salePrice, category = @category, brand = @brand,
          image_url = @imageUrl, notes = @notes, stock = @stock,
          updated_at = app_now()
        WHERE id = @id`,
      )
      .run({
        id,
        sku: values.sku,
        providerCode: values.providerCode,
        name: values.name,
        unit: values.unit,
        purchasePrice: values.purchasePrice,
        wholesalePrice: values.wholesalePrice,
        salePrice: values.salePrice,
        category: values.category,
        brand: values.brand,
        imageUrl: values.imageUrl,
        notes: values.notes,
        stock: stockAfter,
      });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: products.sku")
    ) {
      throw new Error(`Ya existe un producto con el SKU "${values.sku}".`);
    }
    throw error;
  }

  if (result.changes === 0) return null;

  const movementBefore = changingUnit ? 0 : stockBefore;
  if (stockAfter !== movementBefore) {
    recordStockMovement(
      database,
      id,
      Math.round((stockAfter - movementBefore) * 1000) / 1000,
      movementBefore,
      stockAfter,
      "ADJUSTMENT",
    );
  }

  const row = database
    .prepare(`SELECT ${SELECT_PRODUCT_COLUMNS} FROM products WHERE id = ?`)
    .get(id) as Record<string, unknown>;

  return mapProductRow(row);
}

export function deleteProduct(id: number): boolean {
  try {
    const result = getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
    return result.changes > 0;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("FOREIGN KEY constraint failed")
    ) {
      throw new Error(
        "No se puede eliminar un producto que aparece en ventas registradas.",
      );
    }
    throw error;
  }
}

export function adjustStock(id: number, delta: number): Product | null {
  return getDb()
    .transaction(() => adjustStockInTransaction(id, delta))
    .immediate();
}

function adjustStockInTransaction(id: number, delta: number): Product | null {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("La cantidad debe ser un número distinto de 0.");
  }
  const row = getDb()
    .prepare("SELECT stock, unit FROM products WHERE id = ?")
    .get(id) as { stock: number; unit: ProductUnit } | undefined;
  if (!row) return null;

  const precision = row.unit === "KG" ? 1000 : 1;
  if (Math.abs(delta * precision - Math.round(delta * precision)) > 1e-7) {
    throw new Error(
      row.unit === "KG"
        ? "Los ajustes por kilogramo admiten hasta tres decimales."
        : "Los ajustes por pieza o paquete deben ser enteros.",
    );
  }

  const newStock = Math.round((row.stock + delta) * 1000) / 1000;
  if (newStock < 0) {
    throw new Error(
      `Stock insuficiente. Stock actual: ${row.stock}, intento restar: ${Math.abs(delta)}.`,
    );
  }

  getDb()
    .prepare(
      `UPDATE products SET stock = ?, updated_at = app_now() WHERE id = ?`,
    )
    .run(newStock, id);
  recordStockMovement(
    getDb(),
    id,
    Math.round(delta * 1000) / 1000,
    row.stock,
    newStock,
    "ADJUSTMENT",
  );

  const updated = getDb()
    .prepare(`SELECT ${SELECT_PRODUCT_COLUMNS} FROM products WHERE id = ?`)
    .get(id) as Record<string, unknown>;
  return updated ? mapProductRow(updated) : null;
}

function mapProductRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    sku: row.sku as string,
    providerCode: (row.provider_code as string | null) ?? null,
    name: row.name as string,
    unit: row.unit as ProductUnit,
    purchasePrice: row.purchase_price as number,
    wholesalePrice: row.wholesale_price as number,
    salePrice: row.sale_price as number,
    category: row.category as string,
    brand: row.brand as string,
    stock: row.stock as number,
    imageUrl: row.image_url as string,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
