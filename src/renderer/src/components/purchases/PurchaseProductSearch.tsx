import { AlertCircle, RotateCw } from "lucide-react";
import type { PurchaseProduct } from "../../../../shared/purchases";
import { PURCHASE_LIMITS } from "../../../../shared/purchases";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatQuantity } from "@/components/sales-history/format";
import { purchaseUnitLabel } from "./purchaseUtils";

export function PurchaseProductSearch({
  search,
  onSearch,
  products,
  loading,
  error,
  disabled,
  onSelect,
  onRetry,
}: {
  search: string;
  onSearch: (search: string) => void;
  products: PurchaseProduct[];
  loading: boolean;
  error: string;
  disabled: boolean;
  onSelect: (product: PurchaseProduct) => void;
  onRetry: () => void;
}) {
  return (
    <Field className="min-w-0" data-disabled={disabled}>
      <FieldLabel htmlFor="purchase-product-search">
        Buscar producto por nombre o SKU
      </FieldLabel>
      <Command
        shouldFilter={false}
        loop
        className="h-auto border"
        label="Buscar productos para la compra"
      >
        <CommandInput
          id="purchase-product-search"
          placeholder="Escribe un nombre o código..."
          value={search}
          onValueChange={onSearch}
          disabled={disabled}
          maxLength={PURCHASE_LIMITS.searchLength}
          autoComplete="off"
          aria-describedby="purchase-search-help"
        />
        <CommandList className="max-h-48">
          {loading ? (
            <div
              className="flex flex-col gap-2 p-2"
              role="status"
              aria-label="Buscando productos"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : search.trim() && !error ? (
            <>
              <CommandEmpty>
                No se encontraron productos. Prueba otro nombre o SKU.
              </CommandEmpty>
              {products.length ? (
                <CommandGroup
                  heading={`${products.length} coincidencias${products.length === 25 ? " · refina la búsqueda para ver otras" : ""}`}
                >
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={String(product.id)}
                      disabled={disabled}
                      onSelect={() => onSelect(product)}
                      className="flex-col items-start py-2.5 sm:flex-row"
                    >
                      <div className="flex w-full min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate font-medium">
                          {product.name}
                        </span>
                        <span className="break-all text-xs text-muted-foreground">
                          SKU: {product.sku || "Sin SKU"} · Stock:{" "}
                          {formatQuantity(product.stock)}{" "}
                          {purchaseUnitLabel[product.unit]}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-end sm:gap-1">
                        <span className="font-medium tabular-nums">
                          {formatMoney(product.purchasePrice)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Costo actual
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </>
          ) : null}
        </CommandList>
      </Command>
      <FieldDescription id="purchase-search-help">
        Usa ↑ y ↓ para elegir un producto y Enter para agregarlo.
      </FieldDescription>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>No se pudo buscar productos</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRetry}
            >
              <RotateCw data-icon="inline-start" />
              Reintentar búsqueda
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </Field>
  );
}
