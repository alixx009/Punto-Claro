import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CustomerFormData, CustomerFormErrors } from "./constants";

interface CustomerFormDialogProps {
  open: boolean;
  mode: "crear" | "editar";
  data: CustomerFormData;
  errors: CustomerFormErrors;
  submitError: string | null;
  saving: boolean;
  onChange: (data: CustomerFormData) => void;
  onClearError: (field: keyof CustomerFormData) => void;
  onSave: () => void;
  onClose: () => void;
}

export const CustomerFormDialog = ({
  open,
  mode,
  data,
  errors,
  submitError,
  saving,
  onChange,
  onClearError,
  onSave,
  onClose,
}: CustomerFormDialogProps) => {
  const isEditing = mode === "editar";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "EDITAR FICHA : CLIENTE" : "ALTA DE NUEVO CLIENTE"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos principales de la ficha."
              : "Registra un cliente nuevo en el padrón."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>NOMBRE COMPLETO *</Label>
            <Input
              value={data.name}
              onChange={(e) => {
                onChange({ ...data, name: e.target.value });
                onClearError("name");
              }}
              placeholder="Nombre y apellido"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>TELÉFONO DE CONTACTO</Label>
            <Input
              value={data.phone}
              onChange={(e) => onChange({ ...data, phone: e.target.value })}
              placeholder="+52 55 0000 0000"
            />
          </div>
          <div className="space-y-2">
            <Label>CORREO ELECTRÓNICO</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={data.email}
                onChange={(e) => {
                  onChange({ ...data, email: e.target.value });
                  onClearError("email");
                }}
                placeholder="cliente@correo.com"
                className={cn(
                  "pl-10",
                  errors.email ? "border-destructive" : "",
                )}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="hover:cursor-pointer"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="hover:cursor-pointer"
            onClick={onSave}
            disabled={saving}
          >
            {saving
              ? "Guardando..."
              : isEditing
                ? "Actualizar Ficha"
                : "Dar de Alta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
