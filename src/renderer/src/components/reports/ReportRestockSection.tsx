import { useCallback, useState } from "react";
import { PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { formatMoney, formatQuantity } from "@/components/sales-history/format";
import {
  ReportEmpty,
  ReportError,
  ReportLoading,
  ReportPagination,
  ReportSearch,
} from "./ReportPrimitives";
import { useDebouncedValue, useReportResource } from "./useReportResource";
import { useAuth } from "@/auth/useAuth";

export default function ReportRestockSection() {
  const { hasPermission } = useAuth();
  const canViewCosts = hasPermission("costs.view");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const searchQuery = useDebouncedValue(search);
  const load = useCallback(
    () => window.api.reports.restock({ search: searchQuery, page }),
    [searchQuery, page],
  );
  const resource = useReportResource(
    load,
    hasPermission("reports.view") && hasPermission("stock.inspect"),
  );
  const result = resource.data;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            Sugerencias de Reabastecimiento Crítico
          </h2>
          <p className="text-sm text-muted-foreground">
            Productos con {result?.threshold ?? 5} o menos unidades de su medida
            registrada.
          </p>
        </div>
        <Badge variant="outline" className="reports-badge-warning">
          <PackageOpen />
          {resource.loading
            ? "CONSULTANDO…"
            : `${result?.totalRecords ?? 0} PRODUCTOS CRÍTICOS`}
        </Badge>
      </header>
      <FieldGroup className="max-w-xl sm:flex-row">
        <ReportSearch
          id="report-restock-search"
          label="Buscar producto crítico"
          placeholder="Nombre o SKU…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </FieldGroup>
      <ReportError error={resource.error} onRetry={resource.refresh} />
      {resource.loading ? (
        <ReportLoading columns={3} />
      ) : result?.rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {result.rows.map((product) => (
            <Card key={product.id} className="min-w-0 gap-3">
              <CardHeader className="gap-1">
                <CardTitle className="truncate" title={product.name}>
                  {product.name}
                </CardTitle>
                <CardDescription className="break-all">
                  SKU: {product.sku || "Sin SKU"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                {canViewCosts ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Costo unitario
                    </span>
                    <strong className="sales-history-success tabular-nums">
                      {product.purchasePrice === null
                        ? "—"
                        : formatMoney(product.purchasePrice)}
                    </strong>
                  </div>
                ) : null}
                <div className="flex flex-col items-end gap-1">
                  <strong className="reports-warning text-3xl tabular-nums">
                    {formatQuantity(product.stock)}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {product.unit === "KG"
                      ? "KILOGRAMOS"
                      : product.unit === "PAQ"
                        ? "PAQUETES"
                        : "PIEZAS"}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Badge
                  variant="outline"
                  className={
                    product.stock <= 0
                      ? "reports-badge-danger"
                      : "reports-badge-warning"
                  }
                >
                  {product.stock <= 0 ? "SIN EXISTENCIA" : "STOCK BAJO"}
                </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : !resource.error ? (
        <ReportEmpty
          title="Sin productos críticos"
          description={
            search
              ? "No hay productos con stock bajo que coincidan con la búsqueda."
              : "Los productos con stock bajo aparecerán aquí para planear su reposición."
          }
        />
      ) : null}
      {!resource.error ? (
        <ReportPagination
          page={result?.page ?? page}
          total={result?.totalRecords ?? 0}
          loading={resource.loading}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}
