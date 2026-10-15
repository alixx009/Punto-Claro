import { useMemo, useState } from "react";
import { Eye, History, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Operacion = "AJUSTE" | "VENTA" | "COMPRA";

interface Movimiento {
  id: string;
  fecha: string;
  producto: string;
  operacion: Operacion;
  cantidad: number;
  existencia: number;
  nota: string;
}

const kardexMock: Movimiento[] = [
  {
    id: "MOV-001",
    fecha: "15/09/2026 09:12",
    producto: "Coca Cola Regular 600ml",
    operacion: "VENTA",
    cantidad: -2,
    existencia: 46,
    nota: "Venta en mostrador",
  },
  {
    id: "MOV-002",
    fecha: "15/09/2026 08:40",
    producto: "Leche Entera Lala 1L",
    operacion: "COMPRA",
    cantidad: 24,
    existencia: 24,
    nota: "Recepción de pedido Lala",
  },
  {
    id: "MOV-003",
    fecha: "14/09/2026 18:05",
    producto: "Jitomate Saladet",
    operacion: "AJUSTE",
    cantidad: -3,
    existencia: 9.5,
    nota: "Merma por caducidad",
  },
  {
    id: "MOV-004",
    fecha: "14/09/2026 16:22",
    producto: "Sabritas Original Sal 170g",
    operacion: "VENTA",
    cantidad: -1,
    existencia: 17,
    nota: "Venta en mostrador",
  },
  {
    id: "MOV-005",
    fecha: "14/09/2026 11:00",
    producto: "Atún Tuny en Agua 140g",
    operacion: "AJUSTE",
    cantidad: 5,
    existencia: 55,
    nota: "Conteo físico, sobrante",
  },
];

const operacionStyles: Record<Operacion, string> = {
  AJUSTE: "bg-muted text-muted-foreground",
  VENTA: "bg-red-500/10 text-red-500",
  COMPRA: "bg-green-500/10 text-green-500",
};

export function KardexDialog() {
  const [kardexOpen, setKardexOpen] = useState(false);
  const [kardexSearch, setKardexSearch] = useState("");
  const filteredKardex = useMemo(() => {
    const term = kardexSearch.trim().toLowerCase();
    if (!term) return kardexMock;
    return kardexMock.filter((movement) =>
      movement.producto.toLowerCase().includes(term),
    );
  }, [kardexSearch]);

  return (
    <Dialog open={kardexOpen} onOpenChange={setKardexOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="hover:cursor-pointer">
          <History />
          Kardex Global
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historial de Movimientos (Kardex)</DialogTitle>
          <DialogDescription>
            Monitorea entradas, salidas y ajustes manuales en tiempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtre los movimientos por nombre o código..."
            className="h-10 pl-10"
            value={kardexSearch}
            onChange={(e) => setKardexSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[50dvh] min-w-0 overflow-auto overscroll-contain">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead>Existencia</TableHead>
                <TableHead>Nota de registro</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKardex.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell className="text-muted-foreground">
                    {mov.fecha}
                  </TableCell>
                  <TableCell className="font-medium">{mov.producto}</TableCell>
                  <TableCell>
                    <Badge className={operacionStyles[mov.operacion]}>
                      {mov.operacion}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={
                      mov.cantidad > 0
                        ? "font-semibold text-green-500"
                        : "font-semibold text-red-500"
                    }
                  >
                    {mov.cantidad > 0 ? `+${mov.cantidad}` : `${mov.cantidad}`}
                  </TableCell>
                  <TableCell>{mov.existencia}</TableCell>
                  <TableCell className="italic text-muted-foreground">
                    {mov.nota}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalle"
                      className="hover:cursor-pointer"
                    >
                      <Eye />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
