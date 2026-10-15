import { useCallback, useState } from "react";
import { Eye, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TicketDialog } from "@/components/sales/TicketDialog";
import { useSaleDocuments } from "@/components/sales-history/useSaleDocuments";
import {
  formatQuantity,
  formatSaleDate,
  formatSaleTime,
  toDateKey,
} from "@/components/sales-history/format";
import { getSettings } from "@/config/settings";
import type {
  ProductMovementKind,
  ReportMovementRow,
} from "../../../../shared/ipc";
import {
  ReportDatePicker,
  ReportEmpty,
  ReportError,
  ReportLoading,
  ReportPagination,
  ReportSearch,
  ReportTableShell,
} from "./ReportPrimitives";
import { useDebouncedValue, useReportResource } from "./useReportResource";
import { useAuth } from "@/auth/useAuth";

const movementLabels: Record<ProductMovementKind, string> = {
  INITIAL: "Existencia inicial",
  CREATE: "Alta de producto",
  SALE: "Salida por venta",
  RETURN: "Entrada por devolución",
  ADJUSTMENT: "Ajuste de stock",
  DELETE: "Baja de producto",
  PURCHASE: "Entrada por compra",
};
const signedQuantity = (quantity: number) =>
  `${quantity > 0 ? "+" : ""}${formatQuantity(quantity)}`;

function MovementDetailDialog({
  movement,
  onClose,
}: {
  movement: ReportMovementRow | null;
  onClose: () => void;
}) {
  const business = getSettings().business;
  return (
    <Dialog
      open={movement !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>Comprobante de movimiento</DialogTitle>
          <DialogDescription>
            Detalle registrado de inventario. Este movimiento no tiene una venta
            asociada.
          </DialogDescription>
        </DialogHeader>
        {movement ? (
          <div className="sales-note-paper mx-auto flex w-full max-w-72 flex-col gap-3 border p-5 font-mono text-xs">
            <div className="flex flex-col gap-1 text-center">
              <strong className="text-sm uppercase">{business.name}</strong>
              <span>MOVIMIENTO DE INVENTARIO</span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <span>FOLIO:</span>
                <strong className="break-all text-right">
                  {movement.folio}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{formatSaleDate(movement.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>HORA:</span>
                <span>{formatSaleTime(movement.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>TIPO:</span>
                <span className="text-right">
                  {movementLabels[movement.kind]}
                </span>
              </div>
            </div>
            <Separator />
            <strong className="break-words text-center">
              {movement.productName}
            </strong>
            <span>SKU: {movement.sku || "Sin SKU"}</span>
            <div className="flex justify-between gap-2">
              <span>VARIACIÓN:</span>
              <strong>
                {signedQuantity(movement.quantity)} {movement.unit}
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span>ANTES:</span>
              <span>
                {movement.stockBefore === null
                  ? "No registrado"
                  : `${formatQuantity(movement.stockBefore)} ${movement.unit}`}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>DESPUÉS:</span>
              <span>
                {movement.stockAfter === null
                  ? "No registrado"
                  : `${formatQuantity(movement.stockAfter)} ${movement.unit}`}
              </span>
            </div>
            <Separator />
            <p className="whitespace-pre-wrap break-words">{movement.reason}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar comprobante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportMovementsSection() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<Date>();
  const [page, setPage] = useState(1);
  const [movement, setMovement] = useState<ReportMovementRow | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const searchQuery = useDebouncedValue(search);
  const dateKey = date ? toDateKey(date) : null;
  const load = useCallback(
    () =>
      window.api.reports.movements({
        search: searchQuery,
        dateFrom: dateKey,
        dateTo: dateKey,
        page,
      }),
    [searchQuery, dateKey, page],
  );
  const resource = useReportResource(
    load,
    hasPermission("reports.view") && hasPermission("stock.inspect"),
  );
  const result = resource.data;
  const documents = useSaleDocuments();
  function openDocument(saleId: number) {
    setDocumentId(saleId);
    void documents.open(saleId, "ticket");
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">
          Movimientos de Inventario (Kardex)
        </h2>
        <p className="text-sm text-muted-foreground">
          Entradas, salidas y ajustes de cada producto con su folio de
          referencia.
        </p>
      </header>
      <FieldGroup className="min-w-0 gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <ReportSearch
          id="report-movements-search"
          label="Buscar movimiento"
          placeholder="Producto, SKU, folio o motivo…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <ReportDatePicker
          id="report-movements-date"
          label="Fecha de movimiento"
          value={date}
          onChange={(value) => {
            setDate(value);
            setPage(1);
          }}
        />
      </FieldGroup>
      {result?.trackingStartedAt ? (
        <Alert>
          <Info />
          <AlertTitle>
            Registro de existencias desde{" "}
            {formatSaleDate(result.trackingStartedAt)}
          </AlertTitle>
          <AlertDescription>
            Las ventas antiguas con artículos guardados se incluyen como
            salidas. Sus saldos anteriores y posteriores aparecen como no
            registrados; los movimientos nuevos conservan ambos valores.
          </AlertDescription>
        </Alert>
      ) : null}
      <ReportTableShell
        title="Historial de movimientos"
        description="25 movimientos por página"
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.refresh}
      >
        {resource.loading ? (
          <ReportLoading columns={7} />
        ) : result?.rows.length ? (
          <Table className="min-w-240">
            <TableHeader>
              <TableRow>
                <TableHead>FECHA Y HORA</TableHead>
                <TableHead>PRODUCTO</TableHead>
                <TableHead>MOVIMIENTO</TableHead>
                <TableHead className="text-right">CANTIDAD</TableHead>
                <TableHead className="text-right">
                  SALDO ANTES / DESPUÉS
                </TableHead>
                <TableHead>FOLIO / MOTIVO</TableHead>
                <TableHead className="text-right">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatSaleDate(entry.createdAt)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatSaleTime(entry.createdAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span
                        className="max-w-64 truncate font-medium"
                        title={entry.productName}
                      >
                        {entry.productName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        SKU: {entry.sku || "Sin SKU"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {movementLabels[entry.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <span
                      className={
                        entry.kind === "INITIAL"
                          ? undefined
                          : entry.quantity < 0
                            ? "text-destructive"
                            : "sales-history-success"
                      }
                    >
                      {signedQuantity(entry.quantity)} {entry.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="flex flex-col gap-1">
                      <span>
                        {entry.stockBefore === null
                          ? "No registrado"
                          : formatQuantity(entry.stockBefore)}{" "}
                        →{" "}
                        {entry.stockAfter === null
                          ? "No registrado"
                          : formatQuantity(entry.stockAfter)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.unit}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs">{entry.folio}</span>
                      <span
                        className="max-w-64 truncate text-xs text-muted-foreground"
                        title={entry.reason}
                      >
                        {entry.reason}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title={
                        entry.saleId === null
                          ? "Ver comprobante del movimiento"
                          : "Ver ticket de la venta"
                      }
                      aria-label={`Ver comprobante de ${entry.folio}`}
                      disabled={documents.loadingId !== null}
                      onClick={() => {
                        if (entry.saleId !== null) openDocument(entry.saleId);
                        else setMovement(entry);
                      }}
                    >
                      <Eye />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ReportEmpty
            title="No se encontraron movimientos"
            description="Las compras, ventas, altas y ajustes de existencias se registrarán aquí. Prueba con otra búsqueda o fecha."
          />
        )}
        {!resource.error ? (
          <ReportPagination
            page={result?.page ?? page}
            total={result?.totalRecords ?? 0}
            loading={resource.loading}
            onPage={setPage}
          />
        ) : null}
      </ReportTableShell>
      {documents.error ? (
        <ReportError
          error={documents.error}
          title="No se pudo abrir el comprobante"
          onRetry={() => {
            if (documentId !== null) openDocument(documentId);
          }}
        />
      ) : null}
      <TicketDialog
        open={documents.format === "ticket"}
        onOpenChange={(open) => {
          if (!open) documents.close();
        }}
        payload={documents.payload}
        onPrint={() => void documents.print()}
        printing={documents.printing}
        printDisabled={
          documents.payload?.items.length === 0 && !documents.payload.returns
        }
        printFeedback={
          documents.payload?.items.length === 0 && !documents.payload.returns
            ? {
                kind: "error",
                text: "Esta venta histórica no tiene artículos guardados. No se puede imprimir un comprobante incompleto.",
              }
            : documents.feedback
        }
      />
      <MovementDetailDialog
        movement={movement}
        onClose={() => setMovement(null)}
      />
    </div>
  );
}
