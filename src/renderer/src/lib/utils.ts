import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const kgFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

export function formatKg(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return kgFormatter.format(n)
}
