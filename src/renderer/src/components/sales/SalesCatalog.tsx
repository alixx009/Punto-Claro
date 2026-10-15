import type React from "react";
import { Keyboard, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHelp } from "@/components/help/SectionHelp";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/ui/product-image";
import { cn, formatKg } from "@/lib/utils";
import type { Product } from "../../../../shared/ipc";
const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function SearchToolbar({
  search,
  setSearch,
  total,
  onKeyDown,
  inputRef,
  onOpenHelp,
}: {
  search: string;
  setSearch: (v: string) => void;
  total: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpenHelp: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background/45 px-3 py-3 sm:gap-4 sm:px-4">
      <div className="relative min-w-0 basis-[calc(100%-3.25rem)] flex-1 sm:basis-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          aria-label="Buscar productos"
          placeholder="Buscar por nombre o SKU / código de barras..."
          className="h-10 bg-background pl-10 pr-14"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          <KeyboardKey>F1</KeyboardKey>
        </span>
      </div>

      <SectionHelp topic="sales" compact className="hidden xl:inline-flex" />
      <Button
        variant="ghost"
        size="icon"
        className="size-9 hover:cursor-pointer"
        onClick={onOpenHelp}
        title="Atajos de teclado (F9)"
        aria-label="Ver atajos de teclado"
      >
        <Keyboard className="size-4" />
      </Button>

      <span className="w-full text-[10px] font-semibold uppercase text-muted-foreground sm:w-auto">
        {search.trim() && total === 1
          ? "1 resultado · Enter para agregar"
          : `${total} items`}
      </span>
    </div>
  );
}

export function KeyboardKey({
  children,
  emphasis = false,
}: {
  children: string;
  emphasis?: boolean;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center rounded border px-1.5 font-mono text-[10px] font-semibold",
        emphasis
          ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </kbd>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0;
  const lowStock = product.stock < 5;
  return (
    <Card
      className={cn(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-border/80 bg-card shadow-sm transition-colors sm:min-h-64",
        soldOut
          ? "opacity-65"
          : "cursor-pointer hover:border-primary/60 hover:bg-accent/35",
      )}
    >
      <Badge
        variant="secondary"
        className="absolute right-2 top-2 z-10 bg-background/90 text-[10px] shadow-sm backdrop-blur-sm"
      >
        {product.unit}
      </Badge>
      {soldOut && (
        <Badge variant="destructive" className="absolute left-2 top-2">
          Agotado
        </Badge>
      )}
      <CardContent className="flex flex-1 flex-col p-3 pb-2">
        <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-md bg-muted/45 sm:h-32">
          <ProductImage
            source={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>
        <p className="mb-1 truncate text-[10px] font-semibold uppercase text-muted-foreground">
          {product.category}
        </p>
        <h2 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-card-foreground">
          {product.name}
        </h2>
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/70 px-3 py-2.5">
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            lowStock ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {soldOut
            ? "Sin existencias"
            : `Stock: ${product.unit === "KG" ? formatKg(product.stock) : product.stock}`}
        </span>
        <span className="font-mono text-base font-bold tabular-nums text-foreground">
          {mxn.format(product.salePrice)}
        </span>
      </div>
    </Card>
  );
}
