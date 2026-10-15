import { Eye, Files, Plus } from "lucide-react";
import type { PurchasesResult } from "../../../../shared/purchases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatMoney,
  formatSaleDate,
  formatSaleTime,
} from "@/components/sales-history/format";

export function PurchasesHistory({
  result,
  loading,
  search,
  searchPending,
  onClear,
  onNew,
  onDetail,
  onPage,
}: {
  result: PurchasesResult | null;
  loading: boolean;
  search: string;
  searchPending: boolean;
  onClear: () => void;
  onNew: () => void;
  onDetail: (id: number) => void;
  onPage: (page: number) => void;
}) {
  if (loading || !result)
    return (
      <div
        className="flex flex-col gap-4"
        role="status"
        aria-label="Cargando historial de compras"
      >
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    );
  if (!result.rows.length)
    return (
      <Empty className="min-h-72 min-w-0 px-4 py-8 sm:p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Files />
          </EmptyMedia>
          <EmptyTitle>No se encontraron compras en el historial</EmptyTitle>
          <EmptyDescription>
            {search.trim()
              ? "Prueba otro folio o proveedor, o limpia la búsqueda para ver todas las compras."
              : "Registra una compra manual para ingresar mercancía de tus proveedores. La carga de facturas XML estará disponible más adelante."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {search.trim() ? (
            <Button variant="outline" onClick={onClear}>
              Limpiar búsqueda
            </Button>
          ) : (
            <Button variant="info" onClick={onNew}>
              <Plus data-icon="inline-start" />
              Compra manual
            </Button>
          )}
        </EmptyContent>
      </Empty>
    );
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Table className="min-w-190">
        <TableCaption className="sr-only">
          Compras registradas con su proveedor e importe.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Conceptos</TableHead>
            <TableHead className="text-right">Inversión</TableHead>
            <TableHead className="text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell>
                <div className="flex flex-col items-start gap-2">
                  <Badge variant="secondary">{purchase.folio}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Compra manual
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span>{formatSaleDate(purchase.createdAt)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSaleTime(purchase.createdAt)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <p
                  className="max-w-80 truncate font-medium"
                  title={purchase.supplierName}
                >
                  {purchase.supplierName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registró: {purchase.performedByName}
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {purchase.itemCount}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(purchase.total)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDetail(purchase.id)}
                  aria-label={`Ver detalle de ${purchase.folio}`}
                >
                  <Eye data-icon="inline-start" />
                  Ver detalle
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Página {result.page} de {pages}. Hasta {result.pageSize} compras por
          página.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={result.page <= 1 || searchPending}
            onClick={() => onPage(result.page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= pages || searchPending}
            onClick={() => onPage(result.page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
