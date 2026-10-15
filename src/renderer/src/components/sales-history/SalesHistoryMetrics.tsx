import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesHistoryResult } from "../../../../shared/ipc";
import { formatMoney } from "./format";

export function SalesHistoryMetrics({
  summary,
  loading,
}: {
  summary: SalesHistoryResult["summary"] | undefined;
  loading: boolean;
}) {
  const metrics = [
    {
      title: "TRANSACCIONES REALIZADAS",
      value: summary?.count.toLocaleString("es-MX") ?? "—",
      description: "Ventas registradas",
      badge: "OK",
      tone: "sales-history-info",
    },
    {
      title: "MONTO CONSOLIDADO",
      value: summary ? formatMoney(summary.total) : "—",
      description: "Importe neto tras devoluciones",
      badge: "ACTIVO",
      tone: "sales-history-success",
    },
    {
      title: "TICKET PROMEDIO",
      value: summary ? formatMoney(summary.average) : "—",
      description: "Valor medio x venta",
      badge: "KPI",
      tone: "",
    },
  ];
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3" aria-busy={loading}>
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 py-3 shadow-none sm:flex sm:items-stretch sm:gap-4 sm:py-6"
        >
          <CardHeader className="min-w-0 px-4 pr-0 sm:px-6">
            <CardTitle>
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                {metric.title}
              </span>
            </CardTitle>
            <CardDescription className="sr-only">
              {metric.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-4 pl-0 text-right sm:px-6 sm:text-left">
            {loading ? (
              <Skeleton className="ml-auto h-7 w-full max-w-36 sm:ml-0 sm:h-9" />
            ) : (
              <p className="break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl lg:text-3xl xl:text-4xl">
                {metric.value}
              </p>
            )}
          </CardContent>
          <CardFooter className="col-span-2 flex-wrap justify-between gap-2 px-4 sm:px-6">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {metric.description}
            </p>
            <Badge variant="secondary" className={metric.tone}>
              {metric.badge}
            </Badge>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
