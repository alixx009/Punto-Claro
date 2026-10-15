import { useRef, useState } from "react";
import { Box, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adjustProductStock } from "@/data/productStore";
import { cn, formatKg } from "@/lib/utils";
import type { Product } from "../../../../../shared/ipc";

export function StockAdjustDialog({
  product,
  onClose,
  onResult,
}: {
  product: Product;
  onClose: () => void;
  onResult: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const parsed = Number(amount);
  const valid =
    amount.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    (product.unit === "KG"
      ? Math.abs(parsed * 1000 - Math.round(parsed * 1000)) < 1e-7
      : Number.isInteger(parsed));

  const close = () => {
    if (!savingRef.current) onClose();
  };

  const apply = async (sign: 1 | -1) => {
    if (!valid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const delta = sign * parsed;
      const updated = await adjustProductStock({
        productId: product.id,
        delta,
      });
      onResult(
        `Stock de ${updated.name}: ${delta >= 0 ? "+" : ""}${formatKg(delta)} → ${formatKg(updated.stock)}`,
      );
      setAmount("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo ajustar el stock.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="size-5" /> Ajustar existencias
          </DialogTitle>
          <DialogDescription>
            Agrega o retira inventario del producto. Este ajuste no se registra
            como venta ni como gasto.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Producto
          </p>
          <p className="break-words text-base font-semibold">{product.name}</p>
          <p className="break-all text-xs text-muted-foreground">
            SKU {product.sku}
          </p>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Stock actual
            </p>
            <p className="min-w-0 break-words text-2xl font-bold tabular-nums">
              {product.unit === "KG" ? formatKg(product.stock) : product.stock}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {product.unit}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] font-semibold uppercase tracking-wide">
            Cantidad a ajustar
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              ±
            </span>
            <Input
              autoFocus
              type="number"
              step={product.unit === "KG" ? "0.001" : "1"}
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) {
                  e.preventDefault();
                  apply(1);
                }
              }}
              placeholder="0"
              className="h-12 pl-8 font-mono text-lg tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
              {product.unit}
            </span>
          </div>
          {valid && (
            <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-background/45 p-2 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Quitar
                </p>
                <p
                  className={cn(
                    "min-w-0 break-all text-sm font-bold tabular-nums",
                    product.stock - parsed < 0
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {formatKg(product.stock - parsed)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Actual
                </p>
                <p className="min-w-0 break-all text-sm font-bold tabular-nums text-foreground">
                  {formatKg(product.stock)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Agregar
                </p>
                <p className="min-w-0 break-all text-sm font-bold tabular-nums text-foreground">
                  {formatKg(product.stock + parsed)}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="hover:cursor-pointer"
            onClick={close}
            disabled={saving}
          >
            Cerrar
          </Button>
          <Button
            variant="destructive"
            className="hover:cursor-pointer"
            onClick={() => apply(-1)}
            disabled={!valid || saving || parsed > product.stock}
          >
            <Minus className="size-4" /> Retirar
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:cursor-pointer hover:bg-emerald-700"
            onClick={() => apply(1)}
            disabled={!valid || saving}
          >
            <Plus className="size-4" /> Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
