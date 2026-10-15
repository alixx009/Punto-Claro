import {
  Banknote,
  CreditCard,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PaymentMethod } from "../../../../../shared/ipc";

export type Filter = "all" | "debtors";

export interface CustomerFormData {
  code: string;
  name: string;
  phone: string;
  email: string;
}

export type CustomerFormErrors = Partial<
  Record<keyof CustomerFormData, string>
>;

export const emptyCustomerForm: CustomerFormData = {
  code: "",
  name: "",
  phone: "",
  email: "",
};

export const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export const AVATAR_COLORS = [
  "bg-red-500/15 text-red-500",
  "bg-blue-500/15 text-blue-500",
  "bg-emerald-500/15 text-emerald-500",
  "bg-amber-500/15 text-amber-500",
  "bg-violet-500/15 text-violet-500",
  "bg-pink-500/15 text-pink-500",
  "bg-cyan-500/15 text-cyan-500",
  "bg-orange-500/15 text-orange-500",
];

export const paymentMethodOptions: Array<{
  value: PaymentMethod;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "CASH", label: "Efectivo", Icon: Banknote },
  { value: "CREDIT", label: "Tarjeta", Icon: CreditCard },
  { value: "TRANSFER", label: "Transferencia", Icon: Wallet },
  { value: "VOUCHER", label: "Vale", Icon: Receipt },
];
