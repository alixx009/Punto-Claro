import { Boxes, CircleDollarSign, FileText } from "lucide-react";
import type { PurchasesResult } from "../../../../shared/purchases";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatQuantity } from "@/components/sales-history/format";
import { purchaseUnitLabel } from "./purchaseUtils";

export function PurchasesSummary({
  summary,
  loading,
}: {
  summary: PurchasesResult["summary"] | null;
  loading: boolean;
}) {
  const placeholder = loading ? (
    <Skeleton className="ml-auto h-7 w-full max-w-28 sm:ml-0 sm:h-9" />
  ) : (
    <p className="text-xl font-semibold sm:text-3xl">—</p>
  );
  return (
    <section
      className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-3"
      aria-label="Resumen global de compras"
    >
      <Card className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 py-3 sm:flex sm:items-stretch sm:gap-6 sm:py-6">
        <CardHeader className="min-w-0 gap-1 px-4 pr-0 sm:gap-2 sm:px-6">
          <CardTitle>Compras registradas</CardTitle>
          <CardDescription className="hidden sm:block">
            Entradas guardadas en el historial
          </CardDescription>
          <CardAction className="hidden sm:block">
            <FileText
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0 px-4 pl-0 text-right sm:px-6 sm:text-left">
          {summary ? (
            <p className="break-words text-xl font-semibold tabular-nums sm:text-3xl">
              {formatQuantity(summary.purchaseCount)}
            </p>
          ) : (
            placeholder
          )}
        </CardContent>
        <CardFooter className="col-span-2 flex-wrap px-4 text-xs text-muted-foreground sm:hidden">
          Entradas guardadas en el historial
        </CardFooter>
      </Card>
      <Card className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 py-3 sm:flex sm:items-stretch sm:gap-6 sm:py-6">
        <CardHeader className="min-w-0 gap-1 px-4 pr-0 sm:gap-2 sm:px-6">
          <CardTitle>Unidades surtidas</CardTitle>
          <CardDescription className="hidden sm:block">
            Mercancía ingresada por unidad de medida
          </CardDescription>
          <CardAction className="hidden sm:block">
            <Boxes
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0 px-4 pl-0 text-right sm:px-6 sm:text-left">
          {summary ? (
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-2">
              {(summary.quantitiesByUnit.length
                ? summary.quantitiesByUnit
                : [{ unit: "PIEZA" as const, quantity: 0 }]
              ).map((entry) => (
                <p
                  key={entry.unit}
                  className="flex min-w-0 flex-wrap items-baseline justify-end gap-1 sm:justify-start sm:gap-2"
                >
                  <span className="break-words text-xl font-semibold tabular-nums sm:text-3xl">
                    {formatQuantity(entry.quantity)}
                  </span>
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    {purchaseUnitLabel[entry.unit]}
                  </span>
                </p>
              ))}
            </div>
          ) : (
            placeholder
          )}
        </CardContent>
        <CardFooter className="col-span-2 flex-wrap px-4 text-xs text-muted-foreground sm:hidden">
          Mercancía ingresada por unidad de medida
        </CardFooter>
      </Card>
      <Card className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 py-3 sm:flex sm:items-stretch sm:gap-6 sm:py-6">
        <CardHeader className="min-w-0 gap-1 px-4 pr-0 sm:gap-2 sm:px-6">
          <CardTitle>Inversión registrada</CardTitle>
          <CardDescription className="hidden sm:block">
            Costo total de las compras guardadas
          </CardDescription>
          <CardAction className="hidden sm:block">
            <CircleDollarSign
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0 px-4 pl-0 text-right sm:px-6 sm:text-left">
          {summary ? (
            <p className="sales-history-success break-words text-xl font-semibold tabular-nums sm:text-3xl">
              {formatMoney(summary.totalInvestment)}
            </p>
          ) : (
            placeholder
          )}
        </CardContent>
        <CardFooter className="col-span-2 flex-wrap px-4 text-xs text-muted-foreground sm:hidden">
          Costo total de las compras guardadas
        </CardFooter>
      </Card>
    </section>
  );
}
