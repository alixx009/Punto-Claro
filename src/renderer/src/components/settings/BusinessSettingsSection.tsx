import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getSettings,
  saveSettings,
  type BusinessSettings,
} from "@/config/settings";

interface Props {
  value: BusinessSettings;
  onChange: Dispatch<SetStateAction<BusinessSettings>>;
  pendingLogo: string | null;
  onPendingLogoChange: Dispatch<SetStateAction<string | null>>;
}

export function BusinessSettingsSection({
  value,
  onChange,
  pendingLogo,
  onPendingLogoChange,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [savedLogo, setSavedLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!value.logoPath) return;
    let current = true;
    void window.api.images.read(value.logoPath).then((image) => {
      if (current) setSavedLogo(image);
    });
    return () => {
      current = false;
    };
  }, [value.logoPath]);

  const setValue = <K extends keyof BusinessSettings>(
    key: K,
    next: BusinessSettings[K],
  ) => {
    onChange((previous) => ({ ...previous, [key]: next }));
    setFeedback("");
    setError("");
  };

  const loadLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Elige una imagen válida de hasta 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPendingLogoChange(reader.result);
        setFeedback("");
        setError("");
      }
    };
    reader.onerror = () => setError("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!value.name.trim()) {
      setError("Escribe el nombre comercial antes de guardar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const logoPath = pendingLogo
        ? await window.api.images.save(pendingLogo)
        : value.logoPath;
      const business = {
        ...value,
        name: value.name.trim(),
        address: value.address.trim(),
        phone: value.phone.trim(),
        logoPath,
      };
      saveSettings({ ...getSettings(), business });
      onChange(business);
      onPendingLogoChange(null);
      setFeedback("Configuración del negocio guardada.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la configuración.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Negocio y caja</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define los datos que identifican a tu negocio en los comprobantes.
        </p>
      </div>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Identidad del negocio</CardTitle>
          <CardDescription>
            El logotipo es opcional. Puedes actualizarlo cuando lo necesites.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-5 sm:flex-row sm:flex-wrap sm:items-center px-4 sm:px-6">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
            {pendingLogo || (value.logoPath && savedLogo) ? (
              <img
                src={pendingLogo || savedLogo || ""}
                alt="Logotipo del negocio"
                className="size-full object-contain"
              />
            ) : (
              <ImagePlus className="size-7" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Logotipo institucional</p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG o WebP, hasta 10 MB.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Seleccionar logotipo"
                onChange={(event) => {
                  loadLogo(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus data-icon="inline-start" /> Cargar imagen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!pendingLogo && !value.logoPath}
                onClick={() => {
                  onPendingLogoChange(null);
                  setSavedLogo(null);
                  setValue("logoPath", "");
                }}
              >
                <Trash2 data-icon="inline-start" /> Remover
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Datos generales</CardTitle>
          <CardDescription>
            Esta información se guarda en este equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="business-name">Nombre comercial</FieldLabel>
              <Input
                id="business-name"
                value={value.name}
                onChange={(e) => setValue("name", e.target.value)}
                placeholder="Nombre de tu tienda"
                maxLength={80}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="business-phone">
                Teléfono de atención
              </FieldLabel>
              <Input
                id="business-phone"
                type="tel"
                value={value.phone}
                onChange={(e) => setValue("phone", e.target.value)}
                placeholder="614 000 0000"
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="business-address">
                Dirección física
              </FieldLabel>
              <Input
                id="business-address"
                value={value.address}
                onChange={(e) => setValue("address", e.target.value)}
                placeholder="Calle, número, colonia y ciudad"
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="business-region">
                País y configuración regional
              </FieldLabel>
              <Select
                value={value.region}
                onValueChange={() => setValue("region", "MX")}
              >
                <SelectTrigger id="business-region" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="MX">
                      México (MXN $, IVA 16%, RFC)
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4 border-t sm:flex-row sm:flex-wrap sm:items-center sm:justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="business-auto-print"
                className="text-sm font-medium"
              >
                Autoimpresión de comprobantes
              </label>
              <p className="text-xs text-muted-foreground">
                Envía el ticket a la impresora principal al registrar una venta.
              </p>
            </div>
            <Switch
              id="business-auto-print"
              checked={value.autoPrint}
              onCheckedChange={(checked) => setValue("autoPrint", checked)}
            />
          </div>
          <Button
            type="button"
            className="h-auto min-h-9 whitespace-normal"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Guardando…" : "Guardar configuración"}
          </Button>
        </CardFooter>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="text-sm text-emerald-700">
          {feedback}
        </p>
      )}
    </div>
  );
}
