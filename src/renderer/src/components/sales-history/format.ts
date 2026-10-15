import type { PaymentMethod } from "../../../../shared/ipc";
import type { DateRange } from "react-day-picker";

export const formatMoney = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
}).format;
export const formatQuantity = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 3,
}).format;

export function formatSaleDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Fecha no disponible";
}

export function formatSaleTime(value: string): string {
  return value.match(/[ T](\d{2}:\d{2})/)?.[1] ?? "Hora no disponible";
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function currentWeekRange(): DateRange {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  // getDay() cuenta desde domingo; desplaza el inicio de la semana al lunes.
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  return { from, to };
}

export function customerInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "CG"
  );
}

export function paymentLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    DEBIT: "Tarjeta",
    CREDIT: "Tarjeta",
    TRANSFER: "Transferencia",
    VOUCHER: "Vale",
    OTHER: "Otro",
  };
  return labels[method] ?? method;
}
