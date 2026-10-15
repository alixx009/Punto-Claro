import { useCallback, useState } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { formatMoney, formatQuantity } from "@/components/sales-history/format";
import {
  ReportEmpty,
  ReportExport,
  ReportLoading,
  ReportMetric,
  ReportPagination,
  ReportSearch,
  ReportTableShell,
} from "./ReportPrimitives";
import { useDebouncedValue, useReportResource } from "./useReportResource";
import { useAuth } from "@/auth/useAuth";

export default function ReportInventorySection() {
  const { hasPermission } = useAuth();
  const canViewCosts = hasPermission("costs.view");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const searchQuery = useDebouncedValue(search);
  const load = useCallback(
    () => window.api.reports.inventory({ search: searchQuery, page }),
    [searchQuery, page],
  );
  const resource = useReportResource(
    load,
    hasPermission("reports.view") && hasPermission("stock.inspect"),
  );
  const result = resource.data;
  const summary = result?.summary;
  const physical =
    summary?.stockByUnit
      .map(
        (entry) =>
          `${formatQuantity(entry.quantity)} ${entry.unit === "KG" ? "kg" : entry.unit === "PAQ" ? "paq." : "pzas."}`,
      )
      .join(" · ") || (summary ? "0" : "—");
  async function exportExcel() {
    if (exporting || search !== searchQuery) return;
    setExporting(true);
    setFeedback(null);
    try {
      const exported = await window.api.reports.exportExcel({
        kind: "inventory",
        query: { search: searchQuery },
      });
      setFeedback({
        error: false,
        text: exported.saved
          ? "Valoración de inventario guardada en Excel."
          : "Exportación cancelada.",
      });
    } catch (cause) {
      setFeedback({
        error: true,
        text:
          cause instanceof Error
            ? cause.message
            : "No se pudo exportar el inventario.",
      });
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            Valoración y Resumen de Inventario
          </h2>
          <p className="text-sm text-muted-foreground">
            Existencias actuales, costo de adquisición y valor a precio público.
          </p>
        </div>
        <FieldGroup className="min-w-0 gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:max-w-lg">
          <ReportSearch
            id="report-inventory-search"
            label="Buscar producto"
            placeholder="Nombre o SKU…"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <div className="self-start sm:self-end">
            <ReportExport
              busy={exporting}
              disabled={
                resource.loading ||
                search !== searchQuery ||
                !result?.totalRecords
              }
              onClick={() => void exportExcel()}
            />
          </div>
        </FieldGroup>
      </header>
      {feedback ? (
        <Alert variant={feedback.error ? "destructive" : "default"}>
          <Info />
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric
          title="TOTAL CATÁLOGO"
          value={summary ? formatQuantity(summary.count) : "—"}
          description="Productos según la búsqueda"
          loading={resource.loading}
        />
        <ReportMetric
          title="EXISTENCIA FÍSICA"
          value={physical}
          description="Stock separado por unidad de medida"
          loading={resource.loading}
        />
        {canViewCosts ? (
          <ReportMetric
            title="COSTO TOTAL STOCK"
            value={
              summary?.cost !== null && summary?.cost !== undefined
                ? formatMoney(summary.cost)
                : "—"
            }
            description="Costo unitario × existencia actual"
            loading={resource.loading}
            accent
          />
        ) : null}
        <ReportMetric
          title="VENTA ESPERADA"
          value={summary ? formatMoney(summary.publicValue) : "—"}
          description="Precio público × existencia actual"
          loading={resource.loading}
        />
      </div>
      <ReportTableShell
        title="Tabla de valoración"
        description="25 productos por página"
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.refresh}
      >
        {resource.loading ? (
          <ReportLoading columns={6} />
        ) : result?.rows.length ? (
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>DESCRIPCIÓN DE PRODUCTO</TableHead>
                <TableHead className="text-right">DISPONIBLE</TableHead>
                {canViewCosts ? (
                  <TableHead className="text-right">COSTO UNIT.</TableHead>
                ) : null}
                <TableHead className="text-right">PRECIO PÚBLICO</TableHead>
                {canViewCosts ? (
                  <TableHead className="text-right">VALUACIÓN COSTO</TableHead>
                ) : null}
                <TableHead className="text-right">VALUACIÓN PÚBLICO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span
                        className="max-w-96 truncate font-medium"
                        title={product.name}
                      >
                        {product.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        SKU: {product.sku || "Sin SKU"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={
                        product.stock <= 5 ? "reports-badge-warning" : undefined
                      }
                    >
                      {formatQuantity(product.stock)} {product.unit}
                    </Badge>
                  </TableCell>
                  {canViewCosts ? (
                    <TableCell className="text-right tabular-nums">
                      {product.purchasePrice === null
                        ? "—"
                        : formatMoney(product.purchasePrice)}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(product.salePrice)}
                  </TableCell>
                  {canViewCosts ? (
                    <TableCell className="text-right tabular-nums">
                      {product.costValue === null
                        ? "—"
                        : formatMoney(product.costValue)}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(product.publicValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ReportEmpty
            title="No se encontraron productos"
            description="Prueba con otro nombre o SKU."
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
