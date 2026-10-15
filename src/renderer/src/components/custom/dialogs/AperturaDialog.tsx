import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AperturaDialogProps {
  openingInput: string;
  onOpeningInput: (value: string) => void;
  onConfirm: () => Promise<void>;
}

export function AperturaDialog({
  openingInput,
  onOpeningInput,
  onConfirm,
}: AperturaDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Abrir
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Apertura de caja</DialogTitle>
          <DialogDescription>
            Ingrese el fondo inicial de la caja
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <Label htmlFor="register-opening-amount">
              Fondo de apertura (efectivo)
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="register-opening-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={openingInput}
                onChange={(e) => onOpeningInput(e.target.value)}
                className="pl-8"
              />
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button className="hover:cursor-pointer" variant={"outline"}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            className="hover:cursor-pointer"
            onClick={handleConfirm}
            disabled={submitting}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
