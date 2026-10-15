import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CustomerWithBalance } from "../../../../../shared/ipc";

interface DeleteCustomerDialogProps {
  target: CustomerWithBalance | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteCustomerDialog = ({
  target,
  onCancel,
  onConfirm,
}: DeleteCustomerDialogProps) => (
  <AlertDialog
    open={target !== null}
    onOpenChange={(open) => {
      if (!open) onCancel();
    }}
  >
    <AlertDialogContent className="text-center">
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-red-500/10 text-red-500">
          <Trash2 />
        </AlertDialogMedia>
        <AlertDialogTitle>¿Desea eliminar este cliente?</AlertDialogTitle>
        <AlertDialogDescription>
          {target
            ? `"${target.name}" será removido del padrón. Solo se permite eliminar clientes al corriente (sin saldo pendiente). El historial de ventas y pagos se conserva.`
            : "Solo se permite eliminar clientes al corriente (sin saldo pendiente). El historial de ventas y pagos se conserva."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="justify-center">
        <AlertDialogCancel className="hover:cursor-pointer">
          Cancelar
        </AlertDialogCancel>
        <AlertDialogAction
          className="bg-destructive text-white hover:bg-destructive/90 hover:cursor-pointer"
          onClick={onConfirm}
        >
          Confirmar y Eliminar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
