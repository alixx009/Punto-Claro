import { useMemo, useState } from "react";
import { Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CustomerWithBalance } from "../../../../shared/ipc";
const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function CustomerPickerDialog({
  open,
  onOpenChange,
  customers,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customers: CustomerWithBalance[];
  selectedId: number | null;
  onSelect: (c: CustomerWithBalance | null) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term),
    );
  }, [customers, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Seleccionar Cliente en Padrón</DialogTitle>
          <DialogDescription>
            Busca por nombre comercial o teléfono directo para registrar deudas
            y abonos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Escribe el nombre del cliente o su móvil..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="max-h-[40dvh] min-w-0 overflow-y-auto overscroll-contain pr-2">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={cn(
                "flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:cursor-pointer",
                selectedId === null
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">Público / Mostrador</p>
                  <p className="text-xs text-muted-foreground">
                    Venta sin cliente asignado; admite efectivo, tarjeta o
                    transferencia
                  </p>
                </div>
              </div>
              <Badge variant="outline">Por defecto</Badge>
            </button>

            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={cn(
                  "flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:cursor-pointer",
                  selectedId === c.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <div className="flex min-w-0 basis-36 flex-1 items-center gap-3">
                  <User className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.phone ? c.phone : "Sin número telefónico"}
                    </p>
                  </div>
                </div>
                {c.balance > 0 ? (
                  <Badge className="bg-red-500/10 text-red-500">
                    Deuda: {mxn.format(c.balance)}
                  </Badge>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                    Sin deuda
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No se encontraron clientes.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            className="w-full hover:cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
