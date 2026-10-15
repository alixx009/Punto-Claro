import { useCallback, useState } from "react";
import { FileText, Info, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
  formatQuantity,
  formatSaleDate,
  formatSaleTime,
  paymentLabel,
  toDateKey,
} from "@/components/sales-history/format";
import { TicketDialog } from "@/components/sales/TicketDialog";
import { useSaleDocuments } from "@/components/sales-history/useSaleDocuments";
import type {
  ReportSalesQuery,
  SalesHistoryPaymentFilter,
} from "../../../../shared/ipc";
import {
  ReportDatePicker,
  ReportEmpty,
  ReportError,
  ReportExport,
  ReportLoading,
  ReportMetric,
  ReportPagination,
  ReportSearch,
  ReportSelect,
  ReportTableShell,
} from "./ReportPrimitives";
import {
  initialReportRange,
  reportDateBounds,
  ReportTimeRange,
} from "./ReportTimeRange";
import { useDebouncedValue, useReportResource } from "./useReportResource";
import { useAuth } from "@/auth/useAuth";

const paymentOptions = [
  { value: "ALL", label: "Todas las formas" },
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Pago con tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "STORE_CREDIT", label: "Crédito / Fiar" },
];
const stateOptions = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Solo activas" },
  { value: "RETURNED", label: "Solo devueltas" },
];
const trendConfig = {
  accumulated: { label: "Cobros acumulados", color: "var(--history-info)" },
} satisfies ChartConfig;

export default function ReportSalesSection() {
  const { hasPermission } = useAuth();
  const canViewCosts = hasPermission("costs.view");
  const [range, setRange] = useState(initialReportRange);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<SalesHistoryPaymentFilter>("ALL");
  const [state, setState] =
    useState<NonNullable<ReportSalesQuery["state"]>>("ALL");
  const [cashier, setCashier] =
    useState<NonNullable<ReportSalesQuery["cashier"]>>("ALL");
  const [date, setDate] = useState<Date>();
  const [page, setPage] = useState(1);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const searchQuery = useDebouncedValue(search);
  const bounds = reportDateBounds(range);
  const dateKey = date ? toDateKey(date) : null;
  const customInvalid =
    range.period === "CUSTOM" &&
    (!range.from || !range.to || bounds.dateFrom! > bounds.dateTo!);
  const query: ReportSalesQuery = {
    ...bounds,
    search: searchQuery,
    payment,
    state,
    cashier,
    date: dateKey,
    page,
  };
  const load = useCallback(
    () =>
      window.api.reports.sales({
        dateFrom: bounds.dateFrom,
        dateTo: bounds.dateTo,
        search: searchQuery,
        payment,
        state,
        cashier,
        date: dateKey,
        page,
      }),
    [
      bounds.dateFrom,
      bounds.dateTo,
      searchQuery,
      payment,
      state,
      cashier,
      dateKey,
      page,
    ],
  );
  const resource = useReportResource(
    load,
    !customInvalid && hasPermission("reports.view"),
  );
  const result = customInvalid ? null : resource.data;
  const loading = !customInvalid && resource.loading;
  const summary = result?.summary;
  const cashierOptions = [
    { value: "ALL", label: "Todos" },
    ...(result?.availableCashiers ?? ["ADMIN"]).map((name) => ({
      value: name,
      label: name,
    })),
  ];
  const documents = useSaleDocuments();
  const change = <T,>(set: (value: T) => void, value: T) => {
    set(value);
    setPage(1);
  };
  const reset = () => {
    setSearch("");
    setPayment("ALL");
    setState("ALL");
    setCashier("ALL");
    setDate(undefined);
    setRange(initialReportRange());
    setPage(1);
  };
  const volume =
    summary?.volumeByUnit
      .map(
        (entry) =>
          `${formatQuantity(entry.quantity)} ${entry.unit === "KG" ? "kg" : entry.unit === "PAQ" ? "paq." : "pzas."}`,
      )
      .join(" · ") || (summary ? "0" : "—");
  function openDocument(saleId: number) {
    setDocumentId(saleId);
    void documents.open(saleId, "ticket");
  }

  async function exportExcel() {
    if (exporting || customInvalid || search !== searchQuery) return;
    setExporting(true);
    setExportFeedback(null);
    try {
      const exported = await window.api.reports.exportExcel({
        kind: "sales",
        query,
      });
      setExportFeedback({
        error: false,
        text: exported.saved
          ? "Reporte de ventas guardado en Excel."
          : "Exportación cancelada.",
      });
    } catch (cause) {
      setExportFeedback({
        error: true,
        text:
          cause instanceof Error
            ? cause.message
            : "No se pudo exportar el reporte.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section
        className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 lg:p-5"
        aria-label="Filtros del reporte de ventas"
      >
        <div className="flex min-w-0 flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <ReportTimeRange
            value={range}
            years={result?.availableYears ?? []}
            onChange={(value) => change(setRange, value)}
          />
          <div className="self-start">
            <ReportExport
              busy={exporting}
              disabled={
                customInvalid ||
                loading ||
                search !== searchQuery ||
                !result?.totalRecords
              }
              onClick={() => void exportExcel()}
            />
          </div>
        </div>
        <FieldGroup className="gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <ReportSearch
            id="report-sales-search"
            label="Buscar venta"
            placeholder="Buscar folio, cliente, notas…"
            value={search}
            onChange={(value) => change(setSearch, value)}
          />
          <ReportSelect
            id="report-payment"
            label="Pago"
            value={payment}
            options={paymentOptions}
            onChange={(value) =>
              change(setPayment, value as SalesHistoryPaymentFilter)
            }
          />
          <ReportDatePicker
            id="report-sale-date"
            label="Fecha exacta"
            value={date}
            onChange={(value) => change(setDate, value)}
          />
          <ReportSelect
            id="report-sale-state"
            label="Estado"
            value={state}
            options={stateOptions}
            onChange={(value) => change(setState, value as typeof state)}
          />
          <ReportSelect
            id="report-sale-cashier"
            label="Cajero"
            value={cashier}
            options={cashierOptions}
            onChange={(value) => change(setCashier, value as typeof cashier)}
          />
          <Button
            variant="destructive"
            size="icon"
            title="Limpiar filtros y volver a hoy"
            aria-label="Limpiar filtros y volver a hoy"
            onClick={reset}
          >
            <X />
          </Button>
        </FieldGroup>
        <p className="text-xs text-muted-foreground">
          {dateKey
            ? `Fecha exacta: ${formatSaleDate(dateKey)} (dentro del periodo seleccionado).`
            : bounds.dateFrom && bounds.dateTo
              ? `${formatSaleDate(bounds.dateFrom)} al ${formatSaleDate(bounds.dateTo)} · incluye ambos días.`
              : "Todo el registro histórico."}
        </p>
      </section>
      {customInvalid ? (
        <Alert variant="destructive">
          <Info />
          <AlertTitle>Selecciona un rango válido</AlertTitle>
          <AlertDescription>
            La fecha inicial debe ser igual o anterior a la fecha final.
          </AlertDescription>
        </Alert>
      ) : null}
      {exportFeedback ? (
        <Alert variant={exportFeedback.error ? "destructive" : "default"}>
          <Info />
          <AlertDescription>{exportFeedback.text}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric
          title="COBROS TOTALES"
          value={summary ? formatMoney(summary.collected) : "—"}
          description="Cobro neto de ventas tras devoluciones"
          loading={loading}
        />
        {canViewCosts ? (
          <ReportMetric
            title="RENTABILIDAD"
            value={
              !summary
                ? "—"
                : summary.profit === null
                  ? "No disponible"
                  : formatMoney(summary.profit)
            }
            description={
              summary?.missingCostSales
                ? `${summary.missingCostSales} ventas sin costo histórico completo`
                : "Importe de venta menos costo registrado"
            }
            loading={loading}
            accent
          />
        ) : null}
        <ReportMetric
          title="VENTAS PROCESADAS"
          value={summary ? formatQuantity(summary.count) : "—"}
          description="Operaciones según los filtros"
          loading={loading}
        />
        <ReportMetric
          title="VOLUMEN DESPACHADO"
          value={volume}
          description="Cantidades separadas por unidad"
          loading={loading}
        />
      </div>
      {canViewCosts && summary?.missingCostSales ? (
        <Alert>
          <Info />
          <AlertTitle>Rentabilidad sin datos completos</AlertTitle>
          <AlertDescription>
            Algunas ventas antiguas no guardaron el costo de sus artículos. La
            rentabilidad se mostrará cuando todas las ventas consultadas tengan
            ese dato.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Tendencia de ingresos</CardTitle>
          <CardDescription>
            Ventas acumuladas diarias · cobros registrados en el periodo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ReportLoading columns={1} />
          ) : result?.trend.length ? (
            <ChartContainer
              config={trendConfig}
              className="h-56 min-w-0 w-full sm:h-64"
            >
              <AreaChart
                accessibilityLayer
                data={result.trend}
                margin={{ top: 10, left: 10, right: 18, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={35}
                  tickFormatter={(value) =>
                    formatSaleDate(String(value)).slice(0, 5)
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={65}
                  tickFormatter={(value) =>
                    `$${Number(value).toLocaleString("es-MX", { notation: "compact" })}`
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatSaleDate(String(value))}
                      formatter={(value) => (
                        <div className="flex w-full items-center justify-between gap-6">
                          <span>Cobros acumulados</span>
                          <strong className="tabular-nums">
                            {formatMoney(Number(value))}
                          </strong>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  type="linear"
                  dataKey="accumulated"
                  stroke="var(--color-accumulated)"
                  fill="var(--color-accumulated)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={
                    result.trend.length === 1
                      ? {
                          r: 5,
                          fill: "var(--color-accumulated)",
                          strokeWidth: 0,
                        }
                      : false
                  }
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <ReportEmpty
              title={
                customInvalid
                  ? "Selecciona un rango válido"
                  : resource.error
                    ? "Gráfico no disponible"
                    : "Sin ingresos para graficar"
              }
              description={
                resource.error
                  ? "Reintenta la consulta para recuperar los ingresos."
                  : "Las ventas que coincidan con los filtros aparecerán aquí."
              }
            />
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Los cobros posteriores de cuentas por cobrar se consultan en el módulo
          de clientes.
        </CardFooter>
      </Card>
      <ReportTableShell
        title="Ventas y devoluciones"
        description={
          result
            ? `${result.totalRecords.toLocaleString("es-MX")} ventas registradas`
            : undefined
        }
        loading={loading}
        error={customInvalid ? null : resource.error}
        onRetry={resource.refresh}
      >
        {loading ? (
          <ReportLoading columns={6} />
        ) : result?.rows.length ? (
          <Table className="min-w-220">
            <TableHeader>
              <TableRow>
                <TableHead>FOLIO / ID VENTA</TableHead>
                <TableHead>FECHA E HISTORIAL</TableHead>
                <TableHead>OPERADOR CAJA</TableHead>
                <TableHead>FORMAS DE PAGO</TableHead>
                <TableHead className="text-right">MONTO NETO</TableHead>
                <TableHead className="text-right">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      <span className="font-mono font-medium">
                        {sale.folio}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            sale.returnState === "FULL"
                              ? "reports-badge-danger"
                              : sale.returnState === "PARTIAL"
                                ? "reports-badge-warning"
                                : "reports-badge-success"
                          }
                        >
                          {sale.returnState === "FULL"
                            ? "DEVUELTA"
                            : sale.returnState === "PARTIAL"
                              ? "DEVOLUCIÓN PARCIAL"
                              : "ACTIVO"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ID {sale.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatSaleDate(sale.createdAt)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatSaleTime(sale.createdAt)} · {sale.customerName}
                      </span>
                      {sale.notes ? (
                        <span
                          className="max-w-60 truncate text-xs text-muted-foreground"
                          title={sale.notes}
                        >
                          {sale.notes}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{sale.cashierName}</TableCell>
                  <TableCell>
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {[...new Set(sale.paymentMethods.map(paymentLabel))].map(
                        (label) => (
                          <Badge key={label} variant="secondary">
                            {label}
                          </Badge>
                        ),
                      )}
                      {sale.creditAmount > 0 ? (
                        <Badge variant="outline">Crédito / Fiar</Badge>
                      ) : null}
                      {sale.paymentMethods.length === 0 &&
                      sale.creditAmount <= 0 ? (
                        <span className="text-muted-foreground">
                          Sin cobros
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(sale.total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={documents.loadingId !== null}
                        onClick={() => openDocument(sale.id)}
                      >
                        <FileText data-icon="inline-start" />
                        {documents.loadingId === sale.id
                          ? "Cargando…"
                          : "Documento"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ReportEmpty
            title={
              customInvalid
                ? "Selecciona un rango válido"
                : state === "RETURNED"
                  ? "Todavía no hay devoluciones registradas"
                  : "No se encontraron ventas"
            }
            description={
              state === "RETURNED"
                ? "Registra una devolución desde Operaciones > Notas de venta, o cambia los filtros."
                : "Cambia el periodo, la búsqueda o los filtros para consultar otras ventas."
            }
          />
        )}
        {!resource.error && !customInvalid ? (
          <ReportPagination
            page={result?.page ?? page}
            total={result?.totalRecords ?? 0}
            loading={loading}
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
    </div>
  );
}
