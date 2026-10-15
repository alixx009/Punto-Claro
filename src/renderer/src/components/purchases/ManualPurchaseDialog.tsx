import { useState } from "react";
import { AlertCircle, Check, Info, Loader2, RotateCw } from "lucide-react";
import type { CreatePurchaseResult } from "../../../../shared/purchases";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatQuantity } from "@/components/sales-history/format";
import { PurchaseConceptsTable } from "./PurchaseConceptsTable";
import { PurchaseProductSearch } from "./PurchaseProductSearch";
import {
  purchaseUnitLabel,
  type PendingPurchaseAttempt,
} from "./purchaseUtils";
import { useManualPurchase } from "./useManualPurchase";

export function ManualPurchaseDialog({
  open,
  userId,
  recovered,
  onClose,
  onRegistered,
  onPendingChange,
  restoreFocus,
}: {
  open: boolean;
  userId: string;
  recovered: PendingPurchaseAttempt | null;
  onClose: (retainDraft: boolean) => void;
  onRegistered: (result: CreatePurchaseResult) => void;
  onPendingChange: (pending: boolean) => void;
  restoreFocus: () => void;
}) {
  const purchase = useManualPurchase({
    userId,
    recovered,
    onRegistered,
    onPendingChange,
  });
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => {
    if (purchase.saving) return;
    if (purchase.dirty || purchase.uncertain) setConfirmClose(true);
    else onClose(false);
  };
  const selectedMissing = Boolean(
    purchase.supplierId &&
    !purchase.suppliers.some(
      (supplier) => String(supplier.id) === purchase.supplierId,
    ),
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
          showCloseButton={!purchase.saving && !purchase.uncertain}
          onEscapeKeyDown={(event) => {
            if (purchase.saving) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (purchase.saving) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() =>
              document
                .getElementById(
                  purchase.uncertain
                    ? "purchase-process"
                    : "purchase-product-search",
                )
                ?.focus(),
            );
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
        >
          <DialogHeader className="shrink-0 p-4 pr-12 sm:p-6 sm:pr-12">
            <DialogTitle>Registrar inventario manualmente</DialogTitle>
            <DialogDescription>
              Registra compras de proveedores locales o entradas de mercancía
              sin CFDI.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <form
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void purchase.submit();
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                event.target instanceof HTMLElement &&
                !event.target.closest("button")
              )
                event.preventDefault();
            }}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
              {purchase.uncertain ? (
                <Alert>
                  <AlertCircle />
                  <AlertTitle>Compra pendiente de confirmar</AlertTitle>
                  <AlertDescription>
                    La compra pudo haberse registrado. Reintenta para recuperar
                    su resultado antes de modificar los productos o iniciar otra
                    compra.
                  </AlertDescription>
                </Alert>
              ) : null}
              <FieldGroup className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
                <Field
                  data-invalid={purchase.supplierInvalid}
                  data-disabled={purchase.locked || purchase.suppliersLoading}
                >
                  <FieldLabel htmlFor="purchase-supplier">
                    Socio comercial / proveedor{" "}
                    <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Select
                    value={purchase.supplierId}
                    onValueChange={purchase.selectSupplier}
                    disabled={
                      purchase.locked ||
                      purchase.suppliersLoading ||
                      Boolean(purchase.supplierError) ||
                      !purchase.suppliers.length
                    }
                  >
                    <SelectTrigger
                      id="purchase-supplier"
                      className="w-full"
                      aria-required="true"
                      aria-invalid={purchase.supplierInvalid}
                      aria-describedby={
                        purchase.supplierInvalid
                          ? "purchase-supplier-error"
                          : "purchase-supplier-help"
                      }
                    >
                      <SelectValue
                        placeholder={
                          purchase.suppliersLoading
                            ? "Cargando proveedores..."
                            : "Seleccionar proveedor"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {selectedMissing ? (
                          <SelectItem value={purchase.supplierId} disabled>
                            {purchase.supplierName ?? "Proveedor no disponible"}
                          </SelectItem>
                        ) : null}
                        {purchase.suppliers.map((supplier) => (
                          <SelectItem
                            key={supplier.id}
                            value={String(supplier.id)}
                          >
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription id="purchase-supplier-help">
                    {!purchase.suppliersLoading &&
                    !purchase.suppliers.length &&
                    !purchase.supplierError
                      ? "Primero registra un proveedor en Catálogos > Proveedores."
                      : "Selecciona al proveedor que surtió esta mercancía."}
                  </FieldDescription>
                  {purchase.supplierInvalid ? (
                    <FieldError id="purchase-supplier-error">
                      Selecciona un proveedor.
                    </FieldError>
                  ) : null}
                  {purchase.supplierError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertTitle>
                        No se pudieron cargar los proveedores
                      </AlertTitle>
                      <AlertDescription>
                        {purchase.supplierError}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={purchase.suppliersLoading || purchase.locked}
                    onClick={() => void purchase.loadSuppliers()}
                  >
                    <RotateCw data-icon="inline-start" />
                    Actualizar proveedores
                  </Button>
                </Field>
                <PurchaseProductSearch
                  search={purchase.search}
                  onSearch={purchase.setSearch}
                  products={purchase.matches}
                  loading={purchase.searchLoading}
                  error={purchase.searchError}
                  disabled={purchase.locked}
                  onSelect={purchase.addProduct}
                  onRetry={purchase.retrySearch}
                />
              </FieldGroup>
              <Separator />
              <section
                aria-label="Conceptos de la compra"
                className="flex min-w-0 shrink-0 flex-col gap-3 [&>[data-slot=table-container]]:shrink-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">Productos a ingresar</h3>
                  <p className="text-sm text-muted-foreground">
                    {purchase.lines.length} conceptos
                  </p>
                </div>
                <PurchaseConceptsTable
                  lines={purchase.lines}
                  locked={purchase.locked}
                  onEdit={purchase.editLine}
                  onRemove={purchase.removeLine}
                />
              </section>
              <Alert>
                <Info />
                <AlertTitle>Actualización del inventario</AlertTitle>
                <AlertDescription>
                  Al procesar la compra, se sumarán las cantidades al stock y se
                  guardará el costo unitario de esta compra en cada producto. El
                  precio público y el efectivo en caja se conservan.
                </AlertDescription>
              </Alert>
              {purchase.error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>
                    {purchase.uncertain
                      ? "No se pudo confirmar el resultado"
                      : "Revisa la compra"}
                  </AlertTitle>
                  <AlertDescription>{purchase.error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    Mercancía a ingresar
                  </p>
                  <p className="font-medium tabular-nums">
                    {purchase.totalsByUnit.length
                      ? purchase.totalsByUnit
                          .map(
                            (entry) =>
                              `${formatQuantity(entry.quantity)} ${purchaseUnitLabel[entry.unit]}`,
                          )
                          .join(" · ")
                      : "Sin productos"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Inversión total
                  </p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatMoney(purchase.total)}
                  </p>
                </div>
              </div>
              <p className="sr-only" aria-live="polite">
                {purchase.announcement}
              </p>
            </div>
            <Separator />
            <DialogFooter className="shrink-0 p-4 sm:p-6">
              <Button
                type="button"
                variant="outline"
                disabled={purchase.saving}
                onClick={requestClose}
              >
                {purchase.uncertain ? "Cerrar por ahora" : "Revertir"}
              </Button>
              <Button
                id="purchase-process"
                className="min-w-0 whitespace-normal"
                type="submit"
                variant="info"
                disabled={
                  purchase.saving ||
                  (!purchase.uncertain &&
                    (purchase.suppliersLoading ||
                      Boolean(purchase.supplierError) ||
                      !purchase.suppliers.length))
                }
              >
                {purchase.saving ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : purchase.uncertain ? (
                  <RotateCw data-icon="inline-start" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                {purchase.saving
                  ? "Procesando compra..."
                  : purchase.uncertain
                    ? "Reintentar compra pendiente"
                    : "Procesar compra manual"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {purchase.uncertain
                ? "Conservar la compra pendiente"
                : "Descartar esta compra"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {purchase.uncertain
                ? "Se conservará este intento en el equipo. Al volver a Compra manual podrás reintentarlo con los mismos productos; resuélvelo antes de crear otra compra."
                : "Se perderán los productos y cantidades que agregaste. No se ha actualizado el inventario."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir revisando</AlertDialogCancel>
            <AlertDialogAction
              variant={purchase.uncertain ? "default" : "destructive"}
              onClick={() => onClose(purchase.uncertain)}
            >
              {purchase.uncertain ? "Conservar y cerrar" : "Descartar compra"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
