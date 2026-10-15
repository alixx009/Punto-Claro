import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { CircleAlert, LoaderCircle, Save } from "lucide-react";
import {
  SUPPLIER_LIMITS,
  type Supplier,
  type SupplierInput,
} from "../../../../../shared/suppliers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supplierErrorMessage } from "./supplierUtils";

interface SupplierFormValues {
  name: string;
  rfc: string;
  phone: string;
  contactName: string;
  email: string;
  address: string;
}

interface SupplierFormDialogProps {
  supplier: Supplier | null;
  onSave: (input: SupplierInput) => Promise<void>;
  onClose: () => void;
  restoreFocus: () => void;
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const optionalValue = (value: string) => value.trim() || null;

export function SupplierFormDialog({
  supplier,
  onSave,
  onClose,
  restoreFocus,
}: SupplierFormDialogProps) {
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    defaultValues: {
      name: supplier?.name ?? "",
      rfc: supplier?.rfc ?? "",
      phone: supplier?.phone ?? "",
      contactName: supplier?.contactName ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const submitting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    clearErrors("root");
    try {
      await onSave({
        name: values.name.trim(),
        rfc: optionalValue(values.rfc)?.toLocaleUpperCase("es-MX") ?? null,
        phone: optionalValue(values.phone),
        contactName: optionalValue(values.contactName),
        email: optionalValue(values.email),
        address: optionalValue(values.address),
      });
    } catch (error) {
      if (mounted.current)
        setError("root", { message: supplierErrorMessage(error) });
    } finally {
      submitting.current = false;
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={(event) => {
          if (submitting.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submitting.current) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Editar proveedor" : "Registro de nuevo proveedor"}
          </DialogTitle>
          <DialogDescription>
            Solo la empresa o razón social es obligatoria. Puedes completar los
            demás datos después.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-6"
          onChange={() => {
            if (errors.root) clearErrors("root");
          }}
          aria-busy={isSubmitting}
        >
          <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              className="sm:col-span-2"
              data-invalid={!!errors.name}
              data-disabled={isSubmitting}
            >
              <FieldLabel htmlFor="supplier-name">
                Empresa / Razón social *
              </FieldLabel>
              <Input
                id="supplier-name"
                {...register("name", {
                  required: "Escribe el nombre de la empresa o razón social.",
                  validate: (value) =>
                    !!value.trim() ||
                    "Escribe el nombre de la empresa o razón social.",
                  maxLength: {
                    value: SUPPLIER_LIMITS.name,
                    message: `Usa hasta ${SUPPLIER_LIMITS.name} caracteres.`,
                  },
                })}
                required
                maxLength={SUPPLIER_LIMITS.name}
                autoComplete="organization"
                disabled={isSubmitting}
                placeholder="Nombre comercial o razón social"
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name ? "supplier-name-error" : undefined
                }
              />
              <FieldError id="supplier-name-error" errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.rfc} data-disabled={isSubmitting}>
              <FieldLabel htmlFor="supplier-rfc">RFC (opcional)</FieldLabel>
              <Input
                id="supplier-rfc"
                {...register("rfc", {
                  maxLength: {
                    value: SUPPLIER_LIMITS.rfc,
                    message: `Usa hasta ${SUPPLIER_LIMITS.rfc} caracteres.`,
                  },
                })}
                maxLength={SUPPLIER_LIMITS.rfc}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={isSubmitting}
                placeholder="RFC del proveedor"
                aria-invalid={!!errors.rfc}
                aria-describedby={errors.rfc ? "supplier-rfc-error" : undefined}
              />
              <FieldError id="supplier-rfc-error" errors={[errors.rfc]} />
            </Field>
            <Field data-invalid={!!errors.phone} data-disabled={isSubmitting}>
              <FieldLabel htmlFor="supplier-phone">
                Teléfono de enlace
              </FieldLabel>
              <Input
                id="supplier-phone"
                {...register("phone", {
                  maxLength: {
                    value: SUPPLIER_LIMITS.phone,
                    message: `Usa hasta ${SUPPLIER_LIMITS.phone} caracteres.`,
                  },
                })}
                type="tel"
                maxLength={SUPPLIER_LIMITS.phone}
                autoComplete="tel"
                disabled={isSubmitting}
                placeholder="Teléfono o extensión"
                aria-invalid={!!errors.phone}
                aria-describedby={
                  errors.phone ? "supplier-phone-error" : undefined
                }
              />
              <FieldError id="supplier-phone-error" errors={[errors.phone]} />
            </Field>
            <Field
              className="sm:col-span-2"
              data-invalid={!!errors.contactName}
              data-disabled={isSubmitting}
            >
              <FieldLabel htmlFor="supplier-contact">
                Nombre de contacto (atención / ventas)
              </FieldLabel>
              <Input
                id="supplier-contact"
                {...register("contactName", {
                  maxLength: {
                    value: SUPPLIER_LIMITS.contactName,
                    message: `Usa hasta ${SUPPLIER_LIMITS.contactName} caracteres.`,
                  },
                })}
                maxLength={SUPPLIER_LIMITS.contactName}
                autoComplete="name"
                disabled={isSubmitting}
                placeholder="Nombre del agente o vendedor"
                aria-invalid={!!errors.contactName}
                aria-describedby={
                  errors.contactName ? "supplier-contact-error" : undefined
                }
              />
              <FieldError
                id="supplier-contact-error"
                errors={[errors.contactName]}
              />
            </Field>
            <Field
              className="sm:col-span-2"
              data-invalid={!!errors.email}
              data-disabled={isSubmitting}
            >
              <FieldLabel htmlFor="supplier-email">Email de ventas</FieldLabel>
              <Input
                id="supplier-email"
                {...register("email", {
                  maxLength: {
                    value: SUPPLIER_LIMITS.email,
                    message: `Usa hasta ${SUPPLIER_LIMITS.email} caracteres.`,
                  },
                  validate: (value) =>
                    !value.trim() ||
                    EMAIL_FORMAT.test(value.trim()) ||
                    "Escribe un correo válido o deja el campo vacío.",
                })}
                type="email"
                maxLength={SUPPLIER_LIMITS.email}
                autoComplete="email"
                disabled={isSubmitting}
                placeholder="Correo del área de ventas"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? "supplier-email-error" : undefined
                }
              />
              <FieldError id="supplier-email-error" errors={[errors.email]} />
            </Field>
            <Field
              className="sm:col-span-2"
              data-invalid={!!errors.address}
              data-disabled={isSubmitting}
            >
              <FieldLabel htmlFor="supplier-address">
                Dirección física / Almacén
              </FieldLabel>
              <Textarea
                id="supplier-address"
                {...register("address", {
                  maxLength: {
                    value: SUPPLIER_LIMITS.address,
                    message: `Usa hasta ${SUPPLIER_LIMITS.address} caracteres.`,
                  },
                })}
                maxLength={SUPPLIER_LIMITS.address}
                rows={3}
                autoComplete="street-address"
                disabled={isSubmitting}
                placeholder="Calle, número, colonia y ciudad"
                aria-invalid={!!errors.address}
                aria-describedby={
                  errors.address ? "supplier-address-error" : undefined
                }
              />
              <FieldError
                id="supplier-address-error"
                errors={[errors.address]}
              />
            </Field>
          </FieldGroup>
          {errors.root?.message ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>No se pudo guardar el proveedor</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="info" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden
                />
              ) : (
                <Save data-icon="inline-start" aria-hidden />
              )}
              {isSubmitting
                ? "Guardando…"
                : supplier
                  ? "Guardar cambios"
                  : "Registrar proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
