import {
  ArchiveX,
  Box,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { SalesHistoryResult } from "../../../../shared/ipc";
import {
  customerInitials,
  formatMoney,
  formatSaleDate,
  formatSaleTime,
} from "./format";
import type { DocumentFormat } from "./useSaleDocuments";

interface Props {
  result: SalesHistoryResult | null;
  loading: boolean;
  filtered: boolean;
  loadingId: number | null;
  onOpen: (saleId: number, format: DocumentFormat) => void;
  onPage: (page: number) => void;
  onReset: () => void;
  onReturn: (row: SalesHistoryResult["rows"][number]) => void;
  returnLoading: boolean;
}

export function SalesHistoryTable({
  result,
  loading,
  filtered,
  loadingId,
  onOpen,
  onPage,
  onReset,
  onReturn,
  returnLoading,
}: Props) {
  if (loading)
    return (
      <div
        className="flex flex-col gap-4 p-5"
        aria-label="Cargando ventas"
        aria-busy="true"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  if (!result?.rows.length)
    return (
      <Empty className="min-w-0 px-4 py-12 sm:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArchiveX />
          </EmptyMedia>
          <EmptyTitle>No se encontraron ventas</EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Prueba con otro folio, cliente o fecha, o quita los filtros para ver el registro completo."
              : "Las ventas que registres aparecerán aquí para consultar sus datos y volver a imprimir sus comprobantes."}
          </EmptyDescription>
        </EmptyHeader>
        {filtered && (
          <EmptyContent>
            <Button variant="outline" onClick={onReset}>
              Limpiar filtros
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  const pages = Math.max(1, Math.ceil(result.totalRecords / result.pageSize));
  const start = (result.page - 1) * result.pageSize + 1;
  return (
    <>
      <Table className="min-w-240">
        <TableCaption className="sr-only">
          Ventas registradas, ordenadas de la más reciente a la más antigua.
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="pl-5">FOLIO ID</TableHead>
            <TableHead>FECHA Y HORA</TableHead>
            <TableHead>CLIENTE</TableHead>
            <TableHead className="text-right">MONTO TOTAL</TableHead>
            <TableHead className="pr-5">COMPROBANTES / DEVOLUCIONES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="py-5 pl-5">
                <div className="flex flex-col items-start gap-2">
                  <Badge variant="secondary" className="font-mono tabular-nums">
                    {row.folio}
                  </Badge>
                  {row.returnState !== "NONE" && (
                    <Badge
                      variant="outline"
                      className={
                        row.returnState === "FULL"
                          ? "reports-badge-danger"
                          : "reports-badge-warning"
                      }
                    >
                      {row.returnState === "FULL"
                        ? "Devuelta"
                        : "Devolución parcial"}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1 tabular-nums">
                  <span>{formatSaleDate(row.createdAt)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSaleTime(row.createdAt)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      {customerInitials(row.customerName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-52 truncate" title={row.customerName}>
                    {row.customerName}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(row.total)}
              </TableCell>
              <TableCell className="pr-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId !== null || returnLoading}
                    onClick={() => onOpen(row.id, "ticket")}
                    aria-label={`Ver ticket térmico de ${row.folio}`}
                  >
                    {loadingId === row.id ? (
                      <Loader2
                        className="animate-spin motion-reduce:animate-none"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ReceiptText data-icon="inline-start" />
                    )}
                    Ticket Térmico
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="sales-history-note-action"
                    disabled={loadingId !== null || returnLoading}
                    onClick={() => onOpen(row.id, "note")}
                    aria-label={`Ver nota de venta de ${row.folio}`}
                  >
                    <FileText data-icon="inline-start" />
                    Nota de Venta (A4)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReturn(row)}
                    disabled={
                      loadingId !== null ||
                      returnLoading ||
                      row.returnState === "FULL" ||
                      row.itemCount === 0
                    }
                    title={
                      row.returnState === "FULL"
                        ? "Todos los productos ya fueron devueltos"
                        : row.itemCount === 0
                          ? "Esta venta no tiene artículos registrados"
                          : "Gestionar devolución de productos"
                    }
                    aria-label={`Devolver productos de ${row.folio}`}
                  >
                    <Box data-icon="inline-start" />
                    Devolución
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {start.toLocaleString("es-MX")}–
          {Math.min(
            start + result.rows.length - 1,
            result.totalRecords,
          ).toLocaleString("es-MX")}{" "}
          de {result.totalRecords.toLocaleString("es-MX")}
        </p>
        <nav
          aria-label="Páginas del historial"
          className="flex items-center gap-2"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label="Página anterior"
            disabled={result.page <= 1}
            onClick={() => onPage(result.page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm tabular-nums">
            {result.page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Página siguiente"
            disabled={result.page >= pages}
            onClick={() => onPage(result.page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      </div>
    </>
  );
}
