import type { CreateProductInput, Product } from "../../../../../shared/ipc";
import { PRODUCT_STOCK_LIMIT } from "../../../../../shared/ipc";

export const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export const PAGE_SIZE = 10;
export const units: Product["unit"][] = ["PIEZA", "KG", "PAQ"];
export const categories: Product["category"][] = [
  "Bebidas",
  "Lacteos y refrigerados",
  "Abarrotes basicos",
  "Botanas y dulces",
  "Enlatados y conservas",
  "Panaderia y tortillas",
  "Frutas y verduras",
  "Cuidado del hogar",
  "Cuidado personal",
  "Mascotas",
];

export interface ProductForm {
  sku: string;
  providerCode: string;
  name: string;
  brand: string;
  unit: Product["unit"];
  purchasePrice: string;
  salePrice: string;
  wholesalePrice: string;
  category: Product["category"];
  stock: string;
  notes: string;
  imageUrl: string;
  imagenFile: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

export const emptyForm: ProductForm = {
  sku: "",
  providerCode: "",
  name: "",
  brand: "",
  unit: "PIEZA",
  purchasePrice: "",
  salePrice: "",
  wholesalePrice: "",
  category: "",
  stock: "",
  notes: "",
  imageUrl: "",
  imagenFile: "",
};

export function formFromProduct(product: Product): ProductForm {
  return {
    sku: product.sku,
    providerCode: product.providerCode ?? "",
    name: product.name,
    brand: product.brand,
    unit: product.unit,
    purchasePrice:
      product.purchasePrice === null ? "" : String(product.purchasePrice),
    salePrice: String(product.salePrice),
    wholesalePrice: String(product.wholesalePrice),
    category: product.category,
    stock: String(product.stock),
    notes: product.notes ?? "",
    imageUrl: product.imageUrl,
    imagenFile: "",
  };
}

function validMoney(value: string): boolean {
  const amount = Number(value);
  return (
    value.trim() !== "" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7
  );
}

export function validateForm(form: ProductForm): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!form.sku.trim()) errors.sku = "El código de barras es obligatorio.";
  if (!form.name.trim()) errors.name = "El nombre comercial es obligatorio.";
  if (!form.category.trim())
    errors.category = "Selecciona una familia o categoría.";
  if (!validMoney(form.purchasePrice))
    errors.purchasePrice = "Ingresa un precio válido con máximo dos decimales.";
  if (!validMoney(form.salePrice))
    errors.salePrice = "Ingresa un precio válido con máximo dos decimales.";
  if (form.wholesalePrice.trim() && !validMoney(form.wholesalePrice))
    errors.wholesalePrice =
      "Ingresa un precio válido con máximo dos decimales.";
  const stock = Number(form.stock);
  if (
    !form.stock.trim() ||
    !Number.isFinite(stock) ||
    stock < 0 ||
    stock > PRODUCT_STOCK_LIMIT ||
    (form.unit !== "KG" && !Number.isInteger(stock)) ||
    (form.unit === "KG" &&
      Math.abs(stock - Math.round(stock * 1000) / 1000) > 1e-9)
  ) {
    errors.stock =
      form.unit === "KG"
        ? "Usa una existencia de 0 a 1,000,000,000 kg, con máximo tres decimales."
        : "Usa una cantidad entera de 0 a 1,000,000,000.";
  }
  if (!form.imagenFile && !form.imageUrl.trim())
    errors.imageUrl = "La fotografía es obligatoria.";
  return errors;
}

export function productDetails(
  form: ProductForm,
  imageUrl: string,
): Omit<CreateProductInput, "stock"> {
  return {
    sku: form.sku.trim(),
    providerCode: form.providerCode.trim() || null,
    name: form.name.trim(),
    unit: form.unit,
    purchasePrice: Number(form.purchasePrice),
    wholesalePrice: form.wholesalePrice.trim()
      ? Number(form.wholesalePrice)
      : 0,
    salePrice: Number(form.salePrice),
    category: form.category,
    brand: form.brand.trim(),
    imageUrl,
    notes: form.notes.trim() || null,
  };
}
