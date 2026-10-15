export const toCents = (value: string | number): number =>
  Math.round(Number(value) * 100);

export const formatCents = (cents: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);

export const isMoneyInputValid = (value: string): boolean =>
  /^\d*\.?\d{0,2}$/.test(value) || value === "";