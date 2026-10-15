import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyboardKey } from "./SalesCatalog";

const SHORTCUTS: Array<{ keys: string[]; description: string; group: string }> =
  [
    {
      group: "Navegación",
      keys: ["F1"],
      description: "Enfocar la barra de búsqueda de productos",
    },
    {
      group: "Navegación",
      keys: ["F2"],
      description: "Abrir el selector de cliente",
    },
    {
      group: "Venta",
      keys: ["F6"],
      description: "Abrir el cobro / registrar pago",
    },
    {
      group: "Cobro",
      keys: ["F1"],
      description: "Seleccionar efectivo en el diálogo de cobro",
    },
    {
      group: "Cobro",
      keys: ["F2"],
      description: "Seleccionar pago con tarjeta",
    },
    { group: "Cobro", keys: ["F4"], description: "Seleccionar transferencia" },
    {
      group: "Cobro",
      keys: ["F5"],
      description: "Asignar el saldo a fiado cuando esté disponible",
    },
    {
      group: "Ticket",
      keys: ["F7"],
      description: "Imprimir el ticket abierto",
    },
    { group: "Venta", keys: ["F8"], description: "Vaciar el carrito de venta" },
    {
      group: "Catálogo",
      keys: ["Enter"],
      description: "Agregar un SKU exacto o el único resultado de búsqueda",
    },
    {
      group: "Peso",
      keys: ["G", "K"],
      description: "Elegir gramos o kilogramos al agregar un producto por peso",
    },
    {
      group: "Peso",
      keys: ["Enter"],
      description: "Confirmar el peso e incorporar el producto al carrito",
    },
    { group: "General", keys: ["F9"], description: "Ver este panel de atajos" },
    {
      group: "General",
      keys: ["Esc"],
      description: "Cerrar cualquier ventana / diálogo abierto",
    },
  ];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" /> Atajos de teclado
          </DialogTitle>
          <DialogDescription>
            Accesos rápidos para operar la pantalla de ventas sin usar el ratón.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <div className="flex flex-col gap-1">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="text-xs">{s.description}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k) => (
                        <KeyboardKey key={k}>{k}</KeyboardKey>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="shrink-0">
          <Button
            className="hover:cursor-pointer"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
