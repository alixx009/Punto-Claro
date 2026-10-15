import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/data/productStore";
import type { Product } from "../../../../../shared/ipc";

interface DeleteProductDialogProps {
  product: Product;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProductDialog({
  product,
  onClose,
  onDeleted,
}: DeleteProductDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const close = () => {
    if (!deletingRef.current) onClose();
  };

  const confirm = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setError(null);
    try {
      const deleted = await deleteProduct(product.id);
      if (!deleted) throw new Error("El producto ya no está disponible.");
      onDeleted();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo eliminar el producto.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && close()}>
      <AlertDialogContent className="text-center">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-500/10 text-red-500">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Desea eliminar este producto?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es irreversible. El producto "{product.name}" será removido por
            completo de los listados activos y del punto de venta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter className="justify-center">
          <AlertDialogCancel onClick={close} disabled={deleting}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting ? "Eliminando..." : "Confirmar y Eliminar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
