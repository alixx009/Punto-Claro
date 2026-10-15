import type Database from "better-sqlite3";
import type { ProductMovementKind } from "../../shared/ipc";

export function recordStockMovement(
  database: Database.Database,
  productId: number,
  quantity: number,
  stockBefore: number,
  stockAfter: number,
  kind: ProductMovementKind,
  saleId: number | null = null,
  purchaseId: number | null = null,
): void {
  database
    .prepare(
      `INSERT INTO product_movements
    (product_id, product_name, sku, unit, kind, quantity, stock_before, stock_after, sale_id, purchase_id, reason, created_at)
    SELECT id, name, sku, unit, @kind, @quantity, @stockBefore, @stockAfter, @saleId, @purchaseId, @reason,
      COALESCE((SELECT created_at FROM purchases WHERE id = @purchaseId), app_now())
    FROM products WHERE id = @productId`,
    )
    .run({
      productId,
      kind,
      quantity,
      stockBefore,
      stockAfter,
      saleId,
      purchaseId,
      reason:
        kind === "SALE"
          ? "Salida por venta"
          : kind === "RETURN"
            ? "Entrada por devolución de venta"
            : kind === "PURCHASE"
              ? "Entrada por compra de mercancía"
              : "Ajuste manual de existencias",
    });
}

export function initializeInventoryLedger(database: Database.Database): void {
  database
    .transaction(() => {
      database.exec(`CREATE TABLE IF NOT EXISTS inventory_tracking (
      id INTEGER PRIMARY KEY CHECK (id = 1), started_at TEXT NOT NULL DEFAULT (app_now())
    )`);
      const initialized = database
        .prepare("SELECT 1 FROM inventory_tracking WHERE id = 1")
        .get();
      if (!initialized) {
        // Las ventas sí conservaron sus cantidades; los ajustes previos y saldos no se pueden reconstruir.
        database.exec(`INSERT INTO product_movements
        (product_id, product_name, sku, unit, kind, quantity, sale_id, reason, created_at)
        SELECT i.product_id, i.product_name, COALESCE(p.sku, ''), i.unit, 'SALE',
          -i.quantity, i.sale_id, 'Venta histórica; saldo anterior no registrado', s.created_at
        FROM sale_items i JOIN sales s ON s.id = i.sale_id LEFT JOIN products p ON p.id = i.product_id;
        INSERT INTO product_movements
        (product_id, product_name, sku, unit, kind, quantity, stock_before, stock_after, reason)
        SELECT id, name, sku, unit, 'INITIAL', stock, 0, stock, 'Existencia al activar Kardex' FROM products;
        INSERT INTO inventory_tracking (id) VALUES (1)`);
      }
      // INSERT/DELETE son una sola operación atómica; ajustes y ventas se registran en su propia transacción.
      database.exec(`CREATE TRIGGER IF NOT EXISTS products_movement_create AFTER INSERT ON products BEGIN
      INSERT INTO product_movements
      (product_id, product_name, sku, unit, kind, quantity, stock_before, stock_after, reason)
      VALUES (new.id, new.name, new.sku, new.unit, 'CREATE', new.stock, 0, new.stock, 'Alta de producto');
    END;
    CREATE TRIGGER IF NOT EXISTS products_movement_delete AFTER DELETE ON products BEGIN
      INSERT INTO product_movements
      (product_id, product_name, sku, unit, kind, quantity, stock_before, stock_after, reason)
      VALUES (old.id, old.name, old.sku, old.unit, 'DELETE', -old.stock, old.stock, 0, 'Baja de producto');
    END;`);
    })
    .immediate();
}
