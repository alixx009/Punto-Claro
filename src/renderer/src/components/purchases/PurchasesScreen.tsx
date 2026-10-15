import {
  AlertCircle,
  CheckCircle2,
  Plus,
  RotateCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { PURCHASE_LIMITS } from "../../../../shared/purchases";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHelp } from "@/components/help/SectionHelp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ManualPurchaseDialog } from "./ManualPurchaseDialog";
import { PurchaseDetailDialog } from "./PurchaseDetailDialog";
import { PurchasesHistory } from "./PurchasesHistory";
import { PurchasesSummary } from "./PurchasesSummary";
import { usePurchasesController } from "./usePurchasesController";

export default function PurchasesScreen() {
  const purchases = usePurchasesController();
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto bg-canvas p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Compras y Abasto
            </h1>
            <SectionHelp topic="purchases" />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Registra entradas de mercancía y consulta el historial de compras de
            tus proveedores.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            variant="outline"
            className="min-w-0 whitespace-normal"
            disabled={Boolean(purchases.recoveryError)}
            onClick={purchases.openManual}
          >
            <Plus data-icon="inline-start" />
            {purchases.pending ? "Retomar compra pendiente" : "Compra manual"}
          </Button>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="info"
              className="min-w-0 whitespace-normal"
              disabled
              title="La carga de facturas CFDI estará disponible más adelante."
            >
              <Upload data-icon="inline-start" />
              Cargar factura CFDI (XML)
            </Button>
            <Badge variant="secondary" className="w-fit">
              Próximamente
            </Badge>
          </div>
        </div>
      </header>
      {purchases.notice ? (
        <Alert role="status">
          <CheckCircle2 />
          <AlertTitle>Compra registrada</AlertTitle>
          <AlertDescription>
            <div className="flex w-full items-start justify-between gap-3">
              <p>{purchases.notice}</p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={purchases.dismissNotice}
                aria-label="Cerrar confirmación de compra"
              >
                <X data-icon="inline-start" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {purchases.recoveryError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>No se pudo recuperar la compra pendiente</AlertTitle>
          <AlertDescription>{purchases.recoveryError}</AlertDescription>
        </Alert>
      ) : purchases.pending && !purchases.manual?.open ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Tienes una compra pendiente de confirmar</AlertTitle>
          <AlertDescription>
            Reintenta la compra guardada antes de registrar una nueva.
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={purchases.openManual}
            >
              <RotateCw data-icon="inline-start" />
              Retomar compra pendiente
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <PurchasesSummary
        summary={
          purchases.loadError ? null : (purchases.result?.summary ?? null)
        }
        loading={purchases.loading}
      />
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Historial de compras</CardTitle>
          <CardDescription>
            Las métricas muestran el historial completo. Usa la búsqueda para
            encontrar una compra.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <InputGroup className="min-w-0 sm:min-w-64 sm:flex-1 sm:basis-64 sm:max-w-xl">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                id="purchases-search"
                aria-label="Buscar compra por folio o proveedor"
                placeholder="Buscar compra por folio o proveedor..."
                value={purchases.search}
                onChange={(event) => purchases.setSearch(event.target.value)}
                maxLength={PURCHASE_LIMITS.searchLength}
              />
              {purchases.search ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => purchases.setSearch("")}
                    aria-label="Limpiar búsqueda"
                  >
                    <X data-icon="inline-start" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <p
              className="text-sm text-muted-foreground sm:ml-auto"
              aria-live="polite"
            >
              {purchases.loading || purchases.searchPending
                ? "Buscando compras..."
                : purchases.loadError
                  ? "Historial no disponible"
                  : `Mostrando ${purchases.result?.rows.length ?? 0} de ${purchases.result?.total ?? 0} registros`}
            </p>
            <Button
              variant="outline"
              size="icon"
              disabled={purchases.loading}
              onClick={purchases.reload}
              aria-label="Actualizar historial de compras"
            >
              <RotateCw data-icon="inline-start" />
            </Button>
          </div>
          {purchases.loadError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>No se pudo cargar el historial</AlertTitle>
              <AlertDescription>
                {purchases.loadError}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={purchases.reload}
                >
                  <RotateCw data-icon="inline-start" />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <PurchasesHistory
              result={purchases.result}
              loading={purchases.loading}
              search={purchases.search}
              searchPending={purchases.searchPending}
              onClear={() => purchases.setSearch("")}
              onNew={purchases.openManual}
              onDetail={purchases.openDetail}
              onPage={purchases.setPage}
            />
          )}
        </CardContent>
      </Card>
      {purchases.manual ? (
        <ManualPurchaseDialog
          key={purchases.manual.key}
          open={purchases.manual.open}
          userId={purchases.userId}
          recovered={purchases.manual.recovered}
          onClose={purchases.closeManual}
          onRegistered={purchases.onRegistered}
          onPendingChange={purchases.setPending}
          restoreFocus={purchases.restoreFocus}
        />
      ) : null}
      {purchases.detailId !== null ? (
        <PurchaseDetailDialog
          purchase={purchases.detail}
          loading={purchases.detailLoading}
          error={purchases.detailError}
          onClose={purchases.closeDetail}
          onRetry={purchases.reloadDetail}
          restoreFocus={purchases.restoreFocus}
        />
      ) : null}
    </main>
  );
}
