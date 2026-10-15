import { useId, useRef, useState } from "react";
import type { KeyboardEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn, formatKg } from "@/lib/utils";
import { roundMoney } from "../../../../shared/money";
import type { Product } from "../../../../shared/ipc";

type WeightUnit = "KG" | "G";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function parseWeight(value: string, unit: WeightUnit): number | null {
  const normalized = value.trim().replace(",", ".");
  const pattern = unit === "KG" ? /^\d+(?:\.\d{1,3})?$/ : /^\d+$/;
  if (!pattern.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const grams = unit === "KG" ? amount * 1000 : amount;
  if (!Number.isSafeInteger(Math.round(grams))) return null;
  return Math.round(grams) / 1000;
}

export function WeightQuantityDialog({
  product,
  inCart,
  onClose,
  onAdd,
}: {
  product: Product;
  inCart: number;
  onClose: () => void;
  onAdd: (quantityKg: number) => boolean;
}) {
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<WeightUnit>("KG");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const remaining = Math.max(
    0,
    Math.round((product.stock - inCart) * 1000) / 1000,
  );
  const quantityKg = parseWeight(amount, unit);
  const estimatedPrice =
    quantityKg === null ? null : roundMoney(product.salePrice * quantityKg);

  const selectUnit = (next: WeightUnit) => {
    if (next === unit) return;
    const currentKg = parseWeight(amount, unit);
    if (currentKg !== null) {
      setAmount(
        next === "KG"
          ? String(currentKg)
          : String(Math.round(currentKg * 1000)),
      );
    }
    setUnit(next);
    setError("");
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "g" || key === "k") {
      event.preventDefault();
      selectUnit(key === "g" ? "G" : "KG");
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (quantityKg === null) {
      setError(
        unit === "KG"
          ? "Ingresa un peso en kg mayor que cero, con máximo tres decimales."
          : "Ingresa una cantidad entera de gramos mayor que cero.",
      );
      inputRef.current?.focus();
      return;
    }
    if (quantityKg > remaining + 1e-7) {
      setError(
        `Solo quedan ${formatKg(remaining)} kg disponibles para agregar.`,
      );
      inputRef.current?.focus();
      return;
    }
    if (onAdd(quantityKg)) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={handleKeys}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Agregar producto por peso</DialogTitle>
          <DialogDescription>
            {product.name} · {mxn.format(product.salePrice)} por kg
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={inputId}>
                Peso en {unit === "KG" ? "kilogramos" : "gramos"}
              </FieldLabel>
              <Input
                ref={inputRef}
                id={inputId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError("");
                }}
                placeholder={unit === "KG" ? "Ej. 0,750" : "Ej. 750"}
                aria-invalid={Boolean(error)}
                className="h-12 font-mono text-lg tabular-nums"
              />
              <FieldDescription>
                Disponible para agregar: {formatKg(remaining)} kg
                {inCart > 0 ? ` · Ya en carrito: ${formatKg(inCart)} kg` : ""}
              </FieldDescription>
              {error && <FieldError>{error}</FieldError>}
            </Field>

            <FieldSet className="gap-0">
              <FieldLegend variant="label">Unidad de entrada</FieldLegend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "KG", label: "Kilogramos", shortcut: "K" },
                    { value: "G", label: "Gramos", shortcut: "G" },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm font-medium focus-within:ring-[3px] focus-within:ring-ring/50",
                      unit === option.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name="weight-unit"
                      value={option.value}
                      checked={unit === option.value}
                      onChange={() => selectUnit(option.value)}
                      className="sr-only"
                    />
                    <span>{option.label}</span>
                    <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {option.shortcut}
                    </kbd>
                  </label>
                ))}
              </div>
              <FieldDescription className="mt-2">
                Pulsa G o K para cambiar la unidad, Enter para agregar o Esc
                para cancelar.
              </FieldDescription>
            </FieldSet>
          </FieldGroup>

          {quantityKg !== null && (
            <p
              className="rounded-md bg-muted px-3 py-2 text-sm"
              aria-live="polite"
            >
              Se agregarán <strong>{formatKg(quantityKg)} kg</strong>
              {estimatedPrice !== null
                ? ` · ${mxn.format(estimatedPrice)}`
                : ""}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Agregar al carrito</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
