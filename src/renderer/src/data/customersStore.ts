import type {
  CreateCustomerInput,
  CustomerWithBalance,
  UpdateCustomerInput,
  AccountMovement,
  SaleItem,
} from "../../../shared/ipc";
import { assertSessionDataEpoch, getSessionDataEpoch } from "./sessionEpoch";

type Listener = (customers: CustomerWithBalance[]) => void;

let cache: CustomerWithBalance[] = [];
let loaded = false;
let loading: Promise<CustomerWithBalance[]> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = cache;
  listeners.forEach((listener) => listener(snapshot));
}

export function getCustomers(): CustomerWithBalance[] {
  return [...cache];
}

export async function loadCustomers(): Promise<CustomerWithBalance[]> {
  if (loaded) return cache;
  if (!loading) {
    const epoch = getSessionDataEpoch();
    loading = window.api.customers
      .list()
      .then((list) => {
        assertSessionDataEpoch(epoch);
        cache = list;
        loaded = true;
        emit();
        return list;
      })
      .finally(() => {
        if (epoch !== getSessionDataEpoch()) return;
        loading = null;
      });
  }
  return loading;
}

export async function refreshCustomers(): Promise<CustomerWithBalance[]> {
  loaded = false;
  return loadCustomers();
}

export function subscribeCustomers(listener: Listener): () => void {
  listeners.add(listener);
  if (loaded) listener([...cache]);
  return () => {
    listeners.delete(listener);
  };
}

export async function addCustomer(
  input: CreateCustomerInput,
): Promise<CustomerWithBalance> {
  const epoch = getSessionDataEpoch();
  const created = await window.api.customers.create(input);
  assertSessionDataEpoch(epoch);
  const withBalance = { ...created, balance: 0 };
  cache = [...cache, withBalance].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  loaded = true;
  emit();
  return withBalance;
}

export async function updateCustomer(
  id: number,
  input: UpdateCustomerInput,
): Promise<CustomerWithBalance | null> {
  const epoch = getSessionDataEpoch();
  const updated = await window.api.customers.update(id, input);
  assertSessionDataEpoch(epoch);
  if (!updated) return null;
  const current = cache.find((customer) => customer.id === id);
  const withBalance = { ...updated, balance: current?.balance ?? 0 };
  cache = cache
    .map((customer) => (customer.id === id ? withBalance : customer))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  emit();
  return withBalance;
}

export async function deleteCustomer(id: number): Promise<boolean> {
  const epoch = getSessionDataEpoch();
  const ok = await window.api.customers.remove(id);
  assertSessionDataEpoch(epoch);
  if (ok) {
    cache = cache.filter((customer) => customer.id !== id);
    emit();
  }
  return ok;
}

export function applyCustomerPayment(customerId: number, amount: number): void {
  cache = cache.map((customer) =>
    customer.id === customerId
      ? { ...customer, balance: Math.max(0, customer.balance - amount) }
      : customer,
  );
  emit();
}

export async function fetchMovements(
  customerId: number,
): Promise<AccountMovement[]> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.customers.movements(customerId);
  assertSessionDataEpoch(epoch);
  return result;
}

export async function fetchSaleItems(saleId: number): Promise<SaleItem[]> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.sales.items(saleId);
  assertSessionDataEpoch(epoch);
  return result;
}

export function resetCustomers(): void {
  cache = [];
  loaded = false;
  loading = null;
  emit();
}
