import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import type { Supplier } from "../../../../../shared/suppliers";
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

interface DeleteSupplierDialogProps {
  supplier: Supplier;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  restoreFocus: () => void;
}

export function DeleteSupplierDialog({
  supplier,
  pending,
  error,
  onCancel,
  onConfirm,
  restoreFocus,
}: DeleteSupplierDialogProps) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar proveedor</AlertDialogTitle>
          <AlertDialogDescription>
            Se quitará <strong>{supplier.name}</strong> del catálogo de
            proveedores.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>No se pudo eliminar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {pending ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            ) : (
              <Trash2 data-icon="inline-start" aria-hidden />
            )}
            {pending ? "Eliminando…" : "Eliminar proveedor"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
