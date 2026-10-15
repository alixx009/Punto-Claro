export interface Supplier {
  id: number;
  name: string;
  rfc: string | null;
  phone: string | null;
  contactName: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  rfc?: string | null;
  phone?: string | null;
  contactName?: string | null;
  email?: string | null;
  address?: string | null;
}

export const SUPPLIER_LIMITS = {
  name: 180,
  rfc: 20,
  phone: 40,
  contactName: 120,
  email: 254,
  address: 500,
} as const;

const RFC_FORMAT = /^[A-ZÑ&]{3,4}(\d{2})(\d{2})(\d{2})[A-Z0-9]{3}$/;

/** Checks local structure/date only, not registration with SAT or the assigned homoclave. */
export function isValidSupplierRfc(value: string | null | undefined): boolean {
  if (!value) return false;
  const match = RFC_FORMAT.exec(value.trim().toUpperCase());
  if (!match) return false;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export interface SuppliersApi {
  list: () => Promise<Supplier[]>;
  create: (input: SupplierInput) => Promise<Supplier>;
  update: (id: number, input: SupplierInput) => Promise<Supplier>;
  remove: (id: number) => Promise<boolean>;
}

export const SUPPLIER_CHANNELS = {
  list: "suppliers:list",
  create: "suppliers:create",
  update: "suppliers:update",
  remove: "suppliers:delete",
} as const;
