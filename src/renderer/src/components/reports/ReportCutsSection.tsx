import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatMoney,
  formatSaleDate,
  formatSaleTime,
  toDateKey,
} from "@/components/sales-history/format";
import {
  ReportDatePicker,
  ReportEmpty,
  ReportLoading,
  ReportPagination,
  ReportSearch,
  ReportTableShell,
} from "./ReportPrimitives";
import { useDebouncedValue, useReportResource } from "./useReportResource";
import { useAuth } from "@/auth/useAuth";

export default function ReportCutsSection() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<Date>();
  const [page, setPage] = useState(1);
  const searchQuery = useDebouncedValue(search);
  const dateKey = date ? toDateKey(date) : null;
  const load = useCallback(
    () =>
      window.api.reports.cuts({
        search: searchQuery,
        dateFrom: dateKey,
        dateTo: dateKey,
        page,
      }),
    [searchQuery, dateKey, page],
  );
  const resource = useReportResource(load, hasPermission("reports.view"));
  const result = resource.data;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FieldGroup className="min-w-0 gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <ReportSearch
          id="report-cuts-search"
          label="Buscar corte"
          placeholder="Buscar por cajero o caja…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <ReportDatePicker
          id="report-cuts-date"
          label="Fecha de apertura"
          value={date}
          onChange={(value) => {
            setDate(value);
            setPage(1);
          }}
        />
      </FieldGroup>
      <ReportTableShell
        title="Historial de cortes"
        description="Sesiones de caja cerradas"
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
                <TableHead>FECHA Y HORA DE APERTURA</TableHead>
                <TableHead>CAJA / TERMINAL</TableHead>
                <TableHead>CAJERO</TableHead>
                <TableHead className="text-right">FONDO APERTURA</TableHead>
                <TableHead className="text-right">INGRESOS EFECTIVO</TableHead>
                <TableHead className="text-right">MONTO DECLARADO</TableHead>
                <TableHead className="text-right">
                  CUADRE / DIFERENCIA
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((cut) => (
                <TableRow key={cut.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatSaleDate(cut.openedAt)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatSaleTime(cut.openedAt)} · Corte #{cut.id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Cierre: {formatSaleDate(cut.closedAt)}{" "}
                        {formatSaleTime(cut.closedAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{cut.terminal}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {cut.cashierName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(cut.openingAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(cut.cashIncome)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(cut.closingAmount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        variant="outline"
                        className={
                          Math.abs(cut.difference) < 0.005
                            ? "reports-badge-success"
                            : cut.difference < 0
                              ? "reports-badge-danger"
                              : "reports-badge-info"
                        }
                      >
                        {Math.abs(cut.difference) < 0.005
                          ? "CUADRE EXACTO"
                          : cut.difference < 0
                            ? "FALTANTE"
                            : "SOBRANTE"}
                      </Badge>
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(cut.difference)}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        title="Incluye el fondo de apertura y los movimientos de efectivo"
                      >
                        Esperado: {formatMoney(cut.expectedAmount)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ReportEmpty
            title="No se encontraron cortes"
            description="Los cierres de caja aparecerán aquí. Puedes cambiar la fecha o la búsqueda."
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
    </div>
  );
}
