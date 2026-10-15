import { AVATAR_COLORS, type CustomerFormData, type CustomerFormErrors } from "./constants";
import type { CustomerWithBalance } from "../../../../../shared/ipc";

type CustomerLike = Pick<CustomerWithBalance, "code">;

export const avatarColorFor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getInitial = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || "?";
};

export const methodLabel = (method?: string): string => {
  switch (method) {
    case "CASH":
      return "EFECTIVO";
    case "DEBIT":
      return "T. DÉBITO";
    case "CREDIT":
    case "CARD":
      return "TARJETA";
    case "TRANSFER":
      return "TRANSFERENCIA";
    case "VOUCHER":
      return "VALE";
    case "OTHER":
      return "OTRO";
    default:
      return "";
  }
};

export const unitLabel = (unit: string): string => {
  switch (unit) {
    case "PIEZA":
      return "Por pieza";
    case "KG":
      return "Por kilogramo";
    case "PAQ":
      return "Por paquete";
    default:
      return unit;
  }
};

export const nextCustomerCode = (customers: CustomerLike[]): string => {
  const max = customers.reduce((acc, c) => {
    const match = /CLI-(\d+)/.exec(c.code);
    if (!match) return acc;
    const n = parseInt(match[1], 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `CLI-${String(max + 1).padStart(4, "0")}`;
};

export const validateCustomerForm = (form: CustomerFormData): CustomerFormErrors => {
  const errors: CustomerFormErrors = {};
  if (!form.code.trim()) errors.code = "El código de cuenta es obligatorio.";
  if (!form.name.trim()) errors.name = "El nombre completo es obligatorio.";
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    errors.email = "Correo no válido.";
  }
  return errors;
};
