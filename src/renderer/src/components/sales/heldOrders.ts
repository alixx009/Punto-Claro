import type { CustomerWithBalance, Product } from "../../../../shared/ipc";

export interface CartItem {
  productId: number;
  sku: string;
  name: string;
  unit: Product["unit"];
  unitPrice: number;
  imageUrl: string;
  quantity: number;
}

export interface HeldOrder {
  id: number;
  items: Array<{ productId: number; quantity: number }>;
  customerId: number | null;
  createdAt: string;
}

const STORAGE_KEY = "pos.sales.heldOrders.v1";
const MAX_ORDERS = 50;
const MAX_ITEMS = 200;

function userStorageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

function validOrder(value: unknown): value is HeldOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<HeldOrder>;
  return (
    Number.isSafeInteger(order.id) &&
    typeof order.createdAt === "string" &&
    Number.isFinite(Date.parse(order.createdAt)) &&
    (order.customerId === null || Number.isSafeInteger(order.customerId)) &&
    Array.isArray(order.items) &&
    order.items.length > 0 &&
    order.items.length <= MAX_ITEMS &&
    new Set(order.items.map((item) => item?.productId)).size ===
      order.items.length &&
    order.items.every(
      (item) =>
        item &&
        Number.isSafeInteger(item.productId) &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 100000 &&
        Math.round(item.quantity * 1000) / 1000 === item.quantity,
    )
  );
}

export function loadHeldOrders(userId: string, isOwner = false): HeldOrder[] {
  if (!userId) return [];
  try {
    const key = userStorageKey(userId);
    const ownRaw = localStorage.getItem(key);
    const legacyRaw =
      ownRaw === null && isOwner ? localStorage.getItem(STORAGE_KEY) : null;
    const raw = ownRaw ?? legacyRaw;
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<number>();
    const orders = parsed
      .filter((order) => {
        if (!validOrder(order) || unique.has(order.id)) return false;
        unique.add(order.id);
        return true;
      })
      .slice(0, MAX_ORDERS);
    if (legacyRaw !== null) {
      try {
        localStorage.setItem(key, JSON.stringify(orders));
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Keep the legacy source until migration can finish successfully.
      }
    }
    return orders;
  } catch {
    return [];
  }
}

export function saveHeldOrders(orders: HeldOrder[], userId: string): boolean {
  if (!userId) return false;
  try {
    localStorage.setItem(
      userStorageKey(userId),
      JSON.stringify(orders.slice(0, MAX_ORDERS)),
    );
    return true;
  } catch {
    return false;
  }
}

export function cartItemFromProduct(
  product: Product,
  quantity: number,
): CartItem {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    unitPrice: product.salePrice,
    imageUrl: product.imageUrl,
    quantity,
  };
}

export function restoreOrder(
  order: HeldOrder,
  products: Product[],
  customers: CustomerWithBalance[],
): { items: CartItem[]; customer: CustomerWithBalance | null } | null {
  const byId = new Map(products.map((product) => [product.id, product]));
  const items: CartItem[] = [];
  for (const saved of order.items) {
    const product = byId.get(saved.productId);
    if (!product || product.stock <= 0 || saved.quantity > product.stock)
      return null;
    if (product.unit !== "KG" && !Number.isInteger(saved.quantity)) return null;
    items.push(cartItemFromProduct(product, saved.quantity));
  }
  const customer =
    order.customerId === null
      ? null
      : (customers.find((item) => item.id === order.customerId) ?? null);
  if (order.customerId !== null && !customer) return null;
  return { items, customer };
}
