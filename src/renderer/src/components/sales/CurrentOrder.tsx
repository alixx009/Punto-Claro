import { useEffect, useState } from "react";
import {
  Banknote,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/components/ui/product-image";
import { formatKg } from "@/lib/utils";
import type { CustomerWithBalance } from "../../../../shared/ipc";
import { roundMoney } from "../../../../shared/money";
import type { CartItem, HeldOrder } from "./heldOrders";
import { KeyboardKey } from "./SalesCatalog";
const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function CurrentOrder({
  cart,
  subtotal,
  total,
  selectedCustomer,
  canCharge,
  heldOrders,
  onClear,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
  onHold,
  onResumeHeld,
  onDiscardHeld,
  onPickCustomer,
  onRemoveCustomer,
  onCharge,
}: {
  cart: CartItem[];
  subtotal: number;
  total: number;
  selectedCustomer: CustomerWithBalance | null;
  canCharge: boolean;
  heldOrders: HeldOrder[];
  onClear: () => void;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onSetQuantity: (productId: number, next: number) => boolean;
  onRemoveItem: (productId: number) => void;
  onHold: () => void;
  onResumeHeld: (id: number) => void;
  onDiscardHeld: (id: number) => void;
  onPickCustomer: () => void;
  onRemoveCustomer: () => void;
  onCharge: () => void;
}) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background/75 xl:border-l xl:border-border">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase text-foreground">
            Orden actual
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="hover:cursor-pointer"
            onClick={onClear}
            disabled={cart.length === 0}
          >
            Limpiar
          </Button>
        </div>

        <div className="flex h-12 items-center justify-between rounded-md border border-border bg-card px-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <User className="size-4 shrink-0 text-muted-foreground" />
            {selectedCustomer ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium">
                  {selectedCustomer.name}
                </span>
                <button
                  type="button"
                  onClick={onRemoveCustomer}
                  className="flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground hover:cursor-pointer"
                  aria-label="Quitar cliente"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <span className="truncate text-sm font-medium text-muted-foreground">
                Al mostrador / Público
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="ml-3 shrink-0 uppercase hover:cursor-pointer"
            onClick={onPickCustomer}
          >
            Cambiar
            <KeyboardKey>F2</KeyboardKey>
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-32 min-w-0 flex-1 xl:min-h-0">
        <div className="flex flex-col gap-2 p-3">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-8 py-10 text-center">
              <div className="mb-2 flex size-14 items-center justify-center rounded-full border border-border bg-muted/35">
                <ShoppingCart
                  className="size-7 text-muted-foreground/45"
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-sm font-bold uppercase text-foreground">
                Carrito de venta vacío
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Escanea un código o selecciona un producto del catálogo (F1).
              </p>
            </div>
          )}
          {cart.map((item) => (
            <CartRow
              key={item.productId}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onSetQuantity={onSetQuantity}
              onRemove={onRemoveItem}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-2 bg-card/45 p-3 sm:p-4">
        <Separator />
        <div className="flex flex-col gap-2 py-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>SUBTOTAL</span>
            <span className="font-mono tabular-nums">
              {mxn.format(subtotal)}
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <span className="text-sm font-bold uppercase text-foreground">
              Total de la nota
            </span>
            <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {mxn.format(total)}
            </span>
          </div>
        </div>

        <Button
          size="lg"
          className="h-14 w-full text-base font-bold uppercase hover:cursor-pointer"
          onClick={onCharge}
          disabled={!canCharge}
        >
          <Banknote className="size-5" />
          Registrar cobro
          <KeyboardKey emphasis>F6</KeyboardKey>
        </Button>

        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full uppercase hover:cursor-pointer"
            onClick={onHold}
            disabled={cart.length === 0}
          >
            En espera
          </Button>
        </div>

        {heldOrders.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Órdenes retenidas ({heldOrders.length})
            </p>
            <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto pr-1">
              {heldOrders.map((held, idx) => {
                const itemsCount = held.items.length;
                return (
                  <div
                    key={held.id}
                    className="group flex w-full items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  >
                    <button
                      type="button"
                      onClick={() => onResumeHeld(held.id)}
                      className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-left text-xs font-medium hover:bg-amber-500/20 hover:cursor-pointer"
                      title={`Retomar orden ${idx + 1}: ${itemsCount} producto(s)`}
                    >
                      Orden {idx + 1} ({itemsCount} art.) ·{" "}
                      {new Date(held.createdAt).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscardHeld(held.id)}
                      className="rounded-r-md px-2.5 py-2 text-amber-700/70 hover:bg-amber-500/25 hover:text-amber-700 hover:cursor-pointer dark:text-amber-200/70 dark:hover:text-amber-100"
                      title="Descartar orden"
                      aria-label={`Descartar orden retenida ${idx + 1}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function CartRow({
  item,
  onUpdateQuantity,
  onSetQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onSetQuantity: (productId: number, next: number) => boolean;
  onRemove: (productId: number) => void;
}) {
  const lineTotal = roundMoney(item.unitPrice * item.quantity);
  const isKg = item.unit === "KG";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-background">
          <ProductImage
            source={item.imageUrl}
            alt={item.name}
            className="size-12 rounded-md object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-all text-[10px] text-muted-foreground">
            SKU: {item.sku}
          </p>
          <p className="truncate text-sm font-medium">{item.name}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {isKg ? (
              <KgQuantityInput
                value={item.quantity}
                productName={item.name}
                onChange={(next) => onSetQuantity(item.productId, next)}
              />
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 hover:cursor-pointer"
                  onClick={() => onUpdateQuantity(item.productId, -1)}
                  aria-label={`Restar una unidad de ${item.name}`}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="min-w-9 text-center font-mono text-sm tabular-nums">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 hover:cursor-pointer"
                  onClick={() => onUpdateQuantity(item.productId, 1)}
                  aria-label={`Sumar una unidad de ${item.name}`}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            )}
            <span className="font-mono text-sm font-bold tabular-nums">
              {mxn.format(lineTotal)}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-destructive hover:cursor-pointer"
          onClick={() => onRemove(item.productId)}
          aria-label={`Quitar ${item.name} de la orden`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function KgQuantityInput({
  value,
  productName,
  onChange,
}: {
  value: number;
  productName: string;
  onChange: (next: number) => boolean;
}) {
  const [draft, setDraft] = useState<string>(formatKg(value));

  useEffect(() => {
    const current = Number(draft);
    if (Number.isFinite(current) && Math.abs(current - value) > 0.0001) {
      setDraft(formatKg(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setDraft(formatKg(value));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(formatKg(value));
      return;
    }
    const rounded = Math.round(parsed * 1000) / 1000;
    const accepted = onChange(rounded);
    setDraft(formatKg(accepted ? rounded : value));
  };

  return (
    <div className="flex w-full min-w-0 max-w-52 items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="size-9 hover:cursor-pointer"
        onClick={() =>
          onChange(Math.max(0.001, Math.round((value - 0.05) * 1000) / 1000))
        }
        aria-label={`Restar 50 gramos de ${productName}`}
      >
        <Minus className="size-3" />
      </Button>
      <div className="relative min-w-0 flex-1">
        <Input
          type="number"
          step="0.001"
          min="0"
          inputMode="decimal"
          aria-label={`Cantidad en kilogramos de ${productName}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-9 w-full min-w-0 px-2 pr-6 text-center font-mono text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
          kg
        </span>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-9 hover:cursor-pointer"
        onClick={() => onChange(Math.round((value + 0.05) * 1000) / 1000)}
        aria-label={`Sumar 50 gramos de ${productName}`}
      >
        <Plus className="size-3" />
      </Button>
    </div>
  );
}
