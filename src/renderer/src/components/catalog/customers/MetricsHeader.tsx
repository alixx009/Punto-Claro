import type { ReactNode } from "react";
import { BookUser, DollarSign, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHelp } from "@/components/help/SectionHelp";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { mxn } from "./constants";

interface MetricsHeaderProps {
  totalCustomers: number;
  debtorCount: number;
  totalDebt: number;
  shift: boolean;
}

export const MetricsHeader = ({
  totalCustomers,
  debtorCount,
  totalDebt,
  shift,
}: MetricsHeaderProps) => (
  <div className="flex min-w-0 shrink-0 flex-col gap-3 border-b border-border px-3 py-4 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
        <SectionHelp topic="customers" />
      </div>
      {!shift && (
        <Badge
          variant="outline"
          className="max-w-full whitespace-normal border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          title="Abre la caja en el menú superior para habilitar abonos"
        >
          <Lock className="mr-1 size-3" />
          Caja cerrada · abonos deshabilitados
        </Badge>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2 [&>*:last-child]:col-span-2 md:grid-cols-3 md:gap-3 md:[&>*:last-child]:col-span-1">
      <MetricCard
        icon={<Users className="size-5" />}
        label="TOTAL CLIENTES"
        value={String(totalCustomers)}
      />
      <MetricCard
        icon={<BookUser className="size-5" />}
        label="CLIENTES CON DEUDA"
        value={String(debtorCount)}
        caption="deudores habituales"
        tone="warning"
      />
      <MetricCard
        icon={<DollarSign className="size-5" />}
        label="CREDI-CARTERA PENDIENTE"
        value={mxn.format(totalDebt)}
        tone="danger"
      />
    </div>
  </div>
);

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "warning" | "danger";
}

const MetricCard = ({
  icon,
  label,
  value,
  caption,
  tone = "default",
}: MetricCardProps) => {
  const toneClass =
    tone === "danger"
      ? "text-red-500"
      : tone === "warning"
        ? "text-amber-500"
        : "text-muted-foreground";
  return (
    <Card className="min-w-0 py-0">
      <CardContent className="flex items-center gap-2 p-3 sm:gap-4 sm:p-5">
        <div className={cn("rounded-md bg-background/45 p-2", toneClass)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "break-words text-xl font-bold tabular-nums sm:text-2xl",
              toneClass,
            )}
          >
            {value}
          </p>
          {caption && (
            <p className="text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
