import { useCallback } from "react";
import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/components/sales-history/format";
import { ReportEmpty, ReportError, ReportLoading } from "./ReportPrimitives";
import { useReportResource } from "./useReportResource";
import { useAuth } from "@/auth/useAuth";

export default function ReportAuditSection() {
  const { hasPermission } = useAuth();
  const load = useCallback(() => window.api.reports.audit(), []);
  const resource = useReportResource(load, hasPermission("reports.view"));
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Auditoría de Cajeros</h2>
          <p className="text-sm text-muted-foreground">
            Resumen de diferencias registradas en los cierres de caja.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {resource.loading
            ? "Consultando…"
            : `${resource.data?.length ?? 0} USUARIOS AUDITABLES`}
        </p>
      </header>
      <ReportError error={resource.error} onRetry={resource.refresh} />
      {resource.loading ? (
        <ReportLoading columns={3} />
      ) : resource.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {resource.data.map((operator) => (
            <Card key={operator.cashierName} className="min-w-0">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserRound className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="break-words">
                        {operator.cashierName}
                      </CardTitle>
                      <CardDescription>Cajero asignado</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {operator.shifts}{" "}
                    {operator.shifts === 1
                      ? "TURNO AUDITADO"
                      : "TURNOS AUDITADOS"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      FALTANTE TOTAL
                    </span>
                    <strong className="text-xl tabular-nums text-destructive">
                      {formatMoney(operator.shortage)}
                    </strong>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      SOBRANTE TOTAL
                    </span>
                    <strong className="sales-history-info text-xl tabular-nums">
                      {formatMoney(operator.surplus)}
                    </strong>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-medium">BALANCE DE CUADRE</span>
                  <strong className="text-xl tabular-nums">
                    {formatMoney(operator.balance)}
                  </strong>
                </div>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                Sobrantes menos faltantes de las sesiones cerradas.
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : !resource.error ? (
        <ReportEmpty
          title="Sin turnos para auditar"
          description="Los importes se calcularán al registrar cierres de caja."
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        Las sesiones están asignadas a ADMIN mientras se incorpora el sistema de
        usuarios.
      </p>
    </div>
  );
}
