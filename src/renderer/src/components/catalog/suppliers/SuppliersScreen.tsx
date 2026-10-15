import {
  CheckCircle2,
  CircleAlert,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { DeleteSupplierDialog } from "./DeleteSupplierDialog";
import { SupplierFormDialog } from "./SupplierFormDialog";
import { SuppliersSummary } from "./SuppliersSummary";
import { SuppliersTable } from "./SuppliersTable";
import { useSuppliersController } from "./useSuppliersController";

export function SuppliersScreen() {
  const c = useSuppliersController();

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <div className="flex min-w-0 flex-col gap-5 p-3 sm:gap-6 sm:p-6 lg:p-8">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                Proveedores
              </h1>
              <SectionHelp topic="suppliers" />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Catálogo centralizado de abastecimiento y contactos comerciales.
            </p>
          </div>
          <Button
            variant="info"
            disabled={c.loading || c.busy || !!c.loadError}
            onClick={() => c.openEditor(null)}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Nuevo proveedor
          </Button>
        </header>

        <SuppliersSummary
          metrics={c.metrics}
          loading={c.loading}
          unavailable={!!c.loadError}
        />

        {c.notice ? (
          <Alert role="status" aria-live="polite">
            <CheckCircle2 aria-hidden />
            <AlertTitle>{c.notice}</AlertTitle>
            <AlertDescription>
              <Button variant="ghost" size="sm" onClick={c.dismissNotice}>
                Ocultar mensaje
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="min-w-0 gap-5 overflow-hidden pb-0">
          <CardHeader className="min-w-0 gap-4 px-3 sm:px-5">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Directorio comercial</CardTitle>
              <CardDescription>
                Contactos de venta y datos fiscales de tus proveedores.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <InputGroup className="min-w-0 xl:max-w-lg">
                <InputGroupInput
                  id="suppliers-search"
                  type="search"
                  value={c.search}
                  onChange={(event) => c.setSearch(event.target.value)}
                  placeholder="Buscar proveedor por empresa, RFC o agente..."
                  aria-label="Buscar proveedores por empresa, RFC o agente"
                  disabled={c.loading || !!c.loadError}
                />
                <InputGroupAddon>
                  <Search aria-hidden />
                </InputGroupAddon>
                {c.search ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => c.setSearch("")}
                      aria-label="Limpiar búsqueda"
                    >
                      <X data-icon="inline-start" aria-hidden />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              <div className="flex flex-wrap items-center justify-between gap-3 xl:justify-end">
                <span
                  role="status"
                  aria-live="polite"
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {c.loading
                    ? "Cargando proveedores…"
                    : c.loadError
                      ? "Catálogo no disponible"
                      : `Mostrando ${c.filtered.length.toLocaleString("es-MX")} de ${c.metrics.total.toLocaleString("es-MX")} proveedores`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void c.load();
                  }}
                  disabled={c.loading || c.busy}
                >
                  <RefreshCw data-icon="inline-start" aria-hidden />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 p-0">
            {c.loadError ? (
              <div className="p-5">
                <Alert variant="destructive">
                  <CircleAlert aria-hidden />
                  <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
                  <AlertDescription>
                    {c.loadError}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void c.load();
                      }}
                    >
                      Volver a intentar
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <SuppliersTable
                suppliers={c.filtered}
                loading={c.loading}
                busy={c.busy}
                hasSearch={!!c.search.trim()}
                onCreate={() => c.openEditor(null)}
                onClearSearch={() => c.setSearch("")}
                onEdit={c.openEditor}
                onDelete={c.askDelete}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {c.editor ? (
        <SupplierFormDialog
          key={c.editor.supplier?.id ?? "new"}
          supplier={c.editor.supplier}
          onSave={(input) =>
            c.saveSupplier(c.editor?.supplier?.id ?? null, input)
          }
          onClose={c.closeEditor}
          restoreFocus={c.restoreFocus}
        />
      ) : null}
      {c.deleteTarget ? (
        <DeleteSupplierDialog
          supplier={c.deleteTarget}
          pending={c.deleting}
          error={c.deleteError}
          onCancel={c.cancelDelete}
          onConfirm={c.confirmDelete}
          restoreFocus={c.restoreFocus}
        />
      ) : null}
    </main>
  );
}

export default SuppliersScreen;
