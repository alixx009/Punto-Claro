import type {
  AdjustStockInput,
  CreateProductInput,
  Product,
  UpdateProductInput,
} from "../../../shared/ipc";
import { assertSessionDataEpoch, getSessionDataEpoch } from "./sessionEpoch";

type Listener = (products: Product[]) => void;

let productsCache: Product[] = [];
let loaded = false;
let loading: Promise<Product[]> | null = null;
let inFlightChanges: Map<number, Product | null> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = productsCache;
  listeners.forEach((listener) => listener(snapshot));
}

export function getProducts(): Product[] {
  return [...productsCache];
}

export async function loadProducts(): Promise<Product[]> {
  if (loaded) return productsCache;
  if (!loading) {
    const epoch = getSessionDataEpoch();
    const changes = new Map<number, Product | null>();
    inFlightChanges = changes;
    loading = window.api.products
      .list()
      .then((list) => {
        assertSessionDataEpoch(epoch);
        const merged = list.filter(
          (product) => changes.get(product.id) !== null,
        );
        for (const [id, change] of changes) {
          if (!change) continue;
          const index = merged.findIndex((product) => product.id === id);
          if (index >= 0) merged[index] = change;
          else merged.push(change);
        }
        productsCache = merged.sort((a, b) => a.id - b.id);
        loaded = true;
        emit();
        return productsCache;
      })
      .finally(() => {
        if (epoch !== getSessionDataEpoch()) return;
        loading = null;
        inFlightChanges = null;
      });
  }
  return loading;
}

export async function refreshProducts(): Promise<Product[]> {
  const epoch = getSessionDataEpoch();
  if (loading) await loading.catch(() => undefined);
  assertSessionDataEpoch(epoch);
  loaded = false;
  return loadProducts();
}

function replaceProduct(product: Product): void {
  inFlightChanges?.set(product.id, product);
  const exists = productsCache.some((item) => item.id === product.id);
  productsCache = exists
    ? productsCache.map((item) => (item.id === product.id ? product : item))
    : [...productsCache, product];
  loaded = true;
  emit();
}

/** Publish a committed purchase without turning a partial catalog into a loaded catalog. */
export function applyPurchasedProducts(
  products: Product[],
  epoch: number,
): void {
  assertSessionDataEpoch(epoch);
  if (!products.length) return;
  const changes = new Map(products.map((product) => [product.id, product]));
  for (const product of products) inFlightChanges?.set(product.id, product);
  // When no full catalog was loaded, the next products view still fetches all products.
  if (!loaded && !loading) return;
  productsCache = productsCache.map((product) => {
    const changed = changes.get(product.id);
    changes.delete(product.id);
    return changed ?? product;
  });
  productsCache = [...productsCache, ...changes.values()].sort(
    (a, b) => a.id - b.id,
  );
  emit();
}

/** Merge an imported batch once so catalog subscribers render one consistent update. */
export function applyImportedProducts(
  products: Product[],
  epoch: number,
): void {
  applyPurchasedProducts(products, epoch);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (loaded) listener([...productsCache]);
  return () => {
    listeners.delete(listener);
  };
}

export async function addProduct(input: CreateProductInput): Promise<Product> {
  const epoch = getSessionDataEpoch();
  const created = await window.api.products.create(input);
  assertSessionDataEpoch(epoch);
  replaceProduct(created);
  return created;
}

export async function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<Product | null> {
  const epoch = getSessionDataEpoch();
  const updated = await window.api.products.update(id, input);
  assertSessionDataEpoch(epoch);
  if (updated) replaceProduct(updated);
  return updated;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const epoch = getSessionDataEpoch();
  const ok = await window.api.products.remove(id);
  assertSessionDataEpoch(epoch);
  if (ok) {
    inFlightChanges?.set(id, null);
    productsCache = productsCache.filter((product) => product.id !== id);
    loaded = true;
    emit();
  }
  return ok;
}

export async function adjustProductStock(
  input: AdjustStockInput,
): Promise<Product> {
  const epoch = getSessionDataEpoch();
  const updated = await window.api.products.adjustStock(input);
  assertSessionDataEpoch(epoch);
  if (!updated) throw new Error("Producto no encontrado.");
  replaceProduct(updated);
  return updated;
}

export function resetProducts(): void {
  productsCache = [];
  loaded = false;
  loading = null;
  inFlightChanges = null;
  emit();
}
