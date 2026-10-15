import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ImagePlus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductImage, PLACEHOLDER_IMAGE } from "@/components/ui/product-image";
import {
  addProduct,
  getProducts,
  refreshProducts,
  updateProduct,
} from "@/data/productStore";
import {
  assertSessionDataEpoch,
  getSessionDataEpoch,
} from "@/data/sessionEpoch";
import type { Product } from "../../../../../shared/ipc";
import { PRODUCT_STOCK_LIMIT } from "../../../../../shared/ipc";
import { getSettings } from "@/config/settings";
import {
  emptyForm,
  formFromProduct,
  productDetails,
  units,
  validateForm,
  type ProductForm,
  type ProductFormErrors,
} from "./model";

interface ProductFormDialogProps {
  product: Product | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ProductFormDialog({
  product,
  onClose,
  onSaved,
}: ProductFormDialogProps) {
  const [categoryOptions] = useState(() =>
    Array.from(
      new Set(
        getSettings()
          .categories.filter(
            (category) => typeof category === "string" && category.trim(),
          )
          .map((category) => category.trim()),
      ),
    ),
  );
  const [form, setFormState] = useState<ProductForm>(() =>
    product
      ? formFromProduct(product)
      : { ...emptyForm, category: categoryOptions[0] ?? "" },
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageReading, setImageReading] = useState(false);
  const savingRef = useRef(false);
  const stockBaseline = useRef({
    stock: product?.stock ?? 0,
    unit: product?.unit ?? "PIEZA",
  });
  const readerRef = useRef<FileReader | null>(null);
  const formMode = product ? "editar" : "crear";

  const setForm: Dispatch<SetStateAction<ProductForm>> = (update) => {
    setFormState(update);
    setSubmitError(null);
  };

  const close = () => {
    if (!savingRef.current) {
      readerRef.current?.abort();
      onClose();
    }
  };

  const clearError = (field: keyof ProductForm) => {
    setErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous,
    );
    setSubmitError(null);
  };

  const autogenerateSku = () => {
    const sku = String(
      Math.floor(1000000000000 + Math.random() * 9000000000000),
    );
    setForm((current) => ({ ...current, sku }));
    clearError("sku");
  };

  const saveProduct = async () => {
    if (savingRef.current || imageReading) return;
    const epoch = getSessionDataEpoch();
    const validation = validateForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    if (
      getProducts().some(
        (item) => item.sku === form.sku.trim() && item.id !== product?.id,
      )
    ) {
      setErrors({ sku: "Ya existe un producto con este SKU." });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const imageUrl = form.imagenFile
        ? await window.api.images.save(form.imagenFile)
        : form.imageUrl || PLACEHOLDER_IMAGE;
      assertSessionDataEpoch(epoch);
      const details = productDetails(form, imageUrl);
      if (product) {
        const stockChanged =
          Number(form.stock) !== stockBaseline.current.stock ||
          form.unit !== stockBaseline.current.unit;
        const updated = await updateProduct(product.id, {
          ...details,
          ...(stockChanged
            ? {
                stock: Number(form.stock),
                expectedStock: stockBaseline.current.stock,
                expectedUnit: stockBaseline.current.unit,
              }
            : {}),
        });
        if (!updated) throw new Error("El producto ya no está disponible.");
      } else {
        await addProduct({ ...details, stock: Number(form.stock) });
      }
      onSaved(product ? "Producto actualizado." : "Producto creado.");
      onClose();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("PRODUCT_STOCK_CHANGED:")
      ) {
        // Refresh the visible balance while preserving the draft and its original baseline.
        await refreshProducts().catch(() => undefined);
        if (epoch !== getSessionDataEpoch()) return;
      }
      setSubmitError(
        error instanceof Error
          ? error.message
              .replace(
                /^Error invoking remote method '[^']+': (?:Error: )?/,
                "",
              )
              .replace(/^PRODUCT_STOCK_CHANGED:\s*/, "")
          : "No se pudo guardar el producto.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {formMode === "crear"
              ? "Crear Ficha de Nuevo Producto"
              : "Ficha de Edición del Producto"}
          </DialogTitle>
          <DialogDescription>
            Captura la información maestra del catálogo y sus variantes.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Código de barras (SKU)</Label>
            <div className="flex gap-2">
              <Input
                value={form.sku}
                onChange={(e) => {
                  setForm((f) => ({ ...f, sku: e.target.value }));
                  clearError("sku");
                }}
                placeholder="7500000000000"
                className={errors.sku ? "border-destructive" : ""}
              />
              <Button
                variant="outline"
                size="icon"
                title="Autogenerar SKU"
                onClick={autogenerateSku}
              >
                <Wand2 />
              </Button>
            </div>
            {errors.sku && (
              <p className="text-xs text-destructive">{errors.sku}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Código de catálogo (Prov.)</Label>
            <Input
              value={form.providerCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, providerCode: e.target.value }))
              }
              placeholder="Marca-000"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
            <Label>Nombre comercial y medida</Label>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                clearError("name");
              }}
              placeholder="Nombre del producto y presentación"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 sm:col-span-2">
            <p className="text-sm font-semibold text-muted-foreground">
              VARIANTES Y CATEGORIZACIÓN
            </p>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Marca / Línea</Label>
                <Input
                  value={form.brand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand: e.target.value }))
                  }
                  placeholder="Marca o línea"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad de medida</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      unit: v as Product["unit"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {units.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Precio compra</Label>
              <Input
                value={form.purchasePrice}
                onChange={(e) => {
                  setForm((f) => ({ ...f, purchasePrice: e.target.value }));
                  clearError("purchasePrice");
                }}
                placeholder="$0.00"
                className={errors.purchasePrice ? "border-destructive" : ""}
              />
              {errors.purchasePrice && (
                <p className="text-xs text-destructive">
                  {errors.purchasePrice}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Precio venta</Label>
              <Input
                value={form.salePrice}
                onChange={(e) => {
                  setForm((f) => ({ ...f, salePrice: e.target.value }));
                  clearError("salePrice");
                }}
                placeholder="$0.00"
                className={errors.salePrice ? "border-destructive" : ""}
              />
              {errors.salePrice && (
                <p className="text-xs text-destructive">{errors.salePrice}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Precio mayoreo</Label>
              <Input
                value={form.wholesalePrice}
                onChange={(e) => {
                  setForm((f) => ({ ...f, wholesalePrice: e.target.value }));
                  clearError("wholesalePrice");
                }}
                placeholder="$0.00"
                aria-invalid={Boolean(errors.wholesalePrice)}
              />
              {errors.wholesalePrice && (
                <p className="text-xs text-destructive">
                  {errors.wholesalePrice}
                </p>
              )}
            </div>
          </div>

          <Field data-invalid={Boolean(errors.category)} data-disabled={saving}>
            <FieldLabel htmlFor="product-category">
              Familia / Categoría *
            </FieldLabel>
            <Select
              value={form.category}
              disabled={saving || (!categoryOptions.length && !form.category)}
              onValueChange={(category) => {
                setForm((f) => ({ ...f, category }));
                clearError("category");
              }}
            >
              <SelectTrigger
                id="product-category"
                className="w-full"
                aria-invalid={Boolean(errors.category)}
                aria-describedby={
                  errors.category
                    ? "product-category-error product-category-help"
                    : "product-category-help"
                }
              >
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {form.category && !categoryOptions.includes(form.category) ? (
                    <SelectItem value={form.category}>
                      {form.category} (actual)
                    </SelectItem>
                  ) : null}
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription id="product-category-help">
              {categoryOptions.length
                ? "Categorías de Administración > Ajustes > Catálogos base."
                : "Agrega categorías en Administración > Ajustes > Catálogos base para crear productos."}
            </FieldDescription>
            {errors.category ? (
              <FieldError id="product-category-error">
                {errors.category}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(errors.stock)} data-disabled={saving}>
            <FieldLabel htmlFor="product-stock">
              Existencias disponibles ({form.unit})
            </FieldLabel>
            <Input
              id="product-stock"
              type="number"
              inputMode={form.unit === "KG" ? "decimal" : "numeric"}
              min={0}
              max={PRODUCT_STOCK_LIMIT}
              step={form.unit === "KG" ? 0.001 : 1}
              value={form.stock}
              disabled={saving}
              onChange={(e) => {
                setForm((f) => ({ ...f, stock: e.target.value }));
                clearError("stock");
              }}
              placeholder="0"
              aria-invalid={Boolean(errors.stock)}
              aria-describedby={
                errors.stock
                  ? "product-stock-error product-stock-help"
                  : "product-stock-help"
              }
            />
            <FieldDescription id="product-stock-help">
              {product
                ? "Captura la cantidad total disponible. El cambio se registrará como ajuste de inventario."
                : "Captura la existencia inicial del producto."}
            </FieldDescription>
            {errors.stock && (
              <FieldError id="product-stock-error">{errors.stock}</FieldError>
            )}
            {product &&
              (product.stock !== stockBaseline.current.stock ||
                product.unit !== stockBaseline.current.unit) && (
                <>
                  <FieldDescription>
                    Existencia actual: {product.stock} {product.unit}.
                  </FieldDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      stockBaseline.current = {
                        stock: product.stock,
                        unit: product.unit,
                      };
                      setForm((f) => ({
                        ...f,
                        stock: String(product.stock),
                        unit: product.unit,
                      }));
                      clearError("stock");
                    }}
                  >
                    Usar existencia actual
                  </Button>
                </>
              )}
          </Field>

          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
            <Label>Notas o especificación corta</Label>
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Condiciones de almacenaje, caducidad, etc."
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
            <Label>Fotografía del catálogo</Label>
            <div className="flex flex-wrap items-center gap-4 rounded-md border border-dashed border-border p-4">
              {(form.imageUrl || form.imagenFile) && (
                <ProductImage
                  source={form.imagenFile || form.imageUrl}
                  alt="Vista previa"
                  className="size-20 rounded-md border border-border object-contain"
                />
              )}
              <label className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-xs text-muted-foreground hover:cursor-pointer">
                <ImagePlus className="size-5" />
                <span>
                  Arrastra una imagen o haz clic para seleccionar el archivo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      readerRef.current?.abort();
                      if (file.size > 10 * 1024 * 1024) {
                        setImageReading(false);
                        setForm((current) => ({ ...current, imagenFile: "" }));
                        setErrors((previous) => ({
                          ...previous,
                          imageUrl: "La imagen supera el límite de 10 MB.",
                        }));
                        e.target.value = "";
                        return;
                      }
                      clearError("imageUrl");
                      setImageReading(true);
                      const reader = new FileReader();
                      readerRef.current = reader;
                      reader.onerror = () => {
                        if (readerRef.current !== reader) return;
                        setImageReading(false);
                        setForm((current) => ({ ...current, imagenFile: "" }));
                        setErrors((previous) => ({
                          ...previous,
                          imageUrl: "No se pudo leer la imagen.",
                        }));
                      };
                      reader.onload = () => {
                        if (readerRef.current !== reader) return;
                        setForm((f) => ({
                          ...f,
                          imagenFile: reader.result as string,
                        }));
                        setImageReading(false);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            {errors.imageUrl && (
              <p className="text-xs text-destructive">{errors.imageUrl}</p>
            )}
          </div>
        </FieldGroup>

        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="hover:cursor-pointer"
            onClick={close}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="hover:cursor-pointer"
            onClick={saveProduct}
            disabled={saving || imageReading}
          >
            {saving
              ? "Guardando..."
              : imageReading
                ? "Cargando imagen..."
                : formMode === "crear"
                  ? "Crear Producto"
                  : "Guardar Producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
