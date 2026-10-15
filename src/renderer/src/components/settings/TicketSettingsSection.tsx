import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Check, ReceiptText } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  getSettings,
  saveSettings,
  type BusinessSettings,
  type TicketSettings,
  type TicketTemplate,
} from "@/config/settings";
import { cn } from "@/lib/utils";
import { TicketDivider } from "@/components/sales/TicketDivider";
import { TicketItems } from "@/components/sales/TicketItems";
import type { TicketLineItem } from "../../../../shared/ipc";

interface Props {
  value: TicketSettings;
  onChange: Dispatch<SetStateAction<TicketSettings>>;
  business: BusinessSettings;
}

const templates: Array<{ value: TicketTemplate; label: string }> = [
  { value: "classic", label: "Clásico" },
  { value: "modern", label: "Moderno" },
  { value: "compact", label: "Compacto" },
  { value: "framed", label: "Enmarcado" },
  { value: "multiline", label: "Descripción multilínea" },
];

const previewItems: TicketLineItem[] = [
  {
    productName: "Café molido 250 g",
    unit: "PIEZA",
    quantity: 1,
    unitPrice: 89,
    lineTotal: 89,
  },
  {
    productName: "Agua 600 ml",
    unit: "PIEZA",
    quantity: 2,
    unitPrice: 15,
    lineTotal: 30,
  },
];

function PreviewSwitch({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-3">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function TicketPreview({
  value,
  business,
  logoSrc,
}: {
  value: TicketSettings;
  business: BusinessSettings;
  logoSrc: string | null;
}) {
  const compact = value.template === "compact";
  const framed = value.template === "framed";
  const modern = value.template === "modern";
  const fontSize = Number.isFinite(value.fontSize)
    ? Math.min(18, Math.max(9, value.fontSize))
    : 11;
  const margins = getSettings().printerMargins;
  const previewWidth = value.paperWidth === 58 ? 250 : 330;
  const pixelsPerMm = previewWidth / value.paperWidth;

  return (
    <div className="flex min-w-0 items-start justify-center overflow-auto rounded-lg bg-muted/70 px-2 py-5 sm:min-h-[32rem] sm:px-3 sm:py-7">
      <div
        className={cn(
          "w-full shrink-0 bg-white text-black shadow-[0_8px_24px_-12px_rgba(0,0,0,0.28)]",
          framed && "border-2 border-black",
        )}
        style={{
          maxWidth: previewWidth,
          padding: `${margins.topMm * pixelsPerMm}px ${margins.rightMm * pixelsPerMm}px ${margins.bottomMm * pixelsPerMm}px ${margins.leftMm * pixelsPerMm}px`,
          fontSize,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          lineHeight: compact ? 1.25 : 1.5,
        }}
      >
        <div className="text-center">
          {value.showLogo &&
            (logoSrc ? (
              <img
                src={logoSrc}
                alt="Logotipo en vista previa"
                className="mx-auto mb-2 max-h-14 max-w-24 object-contain"
              />
            ) : (
              <div className="mx-auto mb-2 flex h-8 w-16 items-center justify-center border border-dashed border-gray-400 text-[9px] text-gray-500">
                LOGO
              </div>
            ))}
          <p
            className={cn(
              "font-bold uppercase",
              modern && "text-lg tracking-tight",
            )}
          >
            {business.name || "TU NEGOCIO"}
          </p>
          {business.address && (
            <p className="break-words">{business.address}</p>
          )}
          {business.phone && <p>Tel. {business.phone}</p>}
        </div>
        <TicketDivider template={value.template} />
        <div className="flex justify-between gap-2">
          <span>Ticket</span>
          <strong>V-000123</strong>
        </div>
        <div className="flex justify-between gap-2">
          <span>Fecha</span>
          <span>29/09/2026 10:30</span>
        </div>
        {value.showCashierName && (
          <div className="flex justify-between gap-2">
            <span>Cajero</span>
            <span>Cajero de ejemplo</span>
          </div>
        )}
        <TicketDivider template={value.template} />
        <TicketItems
          items={previewItems}
          showAmount={value.showAmount}
          compact={compact}
        />
        <TicketDivider template={value.template} />
        <div
          className={cn(
            "flex justify-between gap-2 font-bold",
            modern && "text-[1.15em]",
          )}
        >
          <span>TOTAL</span>
          <span>$119.00</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Efectivo</span>
          <span>$120.00</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cambio</span>
          <span>$1.00</span>
        </div>
        <TicketDivider template={value.template} />
        <div className="flex flex-col gap-1 text-center">
          {value.thanks && (
            <p className="font-semibold break-words">{value.thanks}</p>
          )}
          {value.invoiceMessage && (
            <p className="break-words">{value.invoiceMessage}</p>
          )}
          {value.terms && (
            <p className="break-words text-[0.9em]">{value.terms}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TicketSettingsSection({ value, onChange, business }: Props) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!business.logoPath) {
      setLogoSrc(null);
      return;
    }
    let current = true;
    void window.api.images.read(business.logoPath).then((image) => {
      if (current) setLogoSrc(image);
    });
    return () => {
      current = false;
    };
  }, [business.logoPath]);

  const setValue = <K extends keyof TicketSettings>(
    key: K,
    next: TicketSettings[K],
  ) => {
    onChange((previous) => ({ ...previous, [key]: next }));
    setFeedback("");
    setError("");
  };

  const apply = () => {
    if (
      !Number.isInteger(value.fontSize) ||
      value.fontSize < 9 ||
      value.fontSize > 18
    ) {
      setError("Usa una fuente de 9 a 18 px.");
      return;
    }
    try {
      saveSettings({ ...getSettings(), ticket: value });
      setFeedback("Parámetros del ticket guardados.");
    } catch {
      setError("No se pudieron guardar los parámetros del ticket.");
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Diseño de ticket
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta el formato y observa los cambios al instante.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.8fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Formato del comprobante</CardTitle>
              <CardDescription>
                La vista previa es ilustrativa y usa datos de ejemplo.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="ticket-template">
                    Plantilla del documento
                  </FieldLabel>
                  <Select
                    value={value.template}
                    onValueChange={(next) =>
                      setValue("template", next as TicketTemplate)
                    }
                  >
                    <SelectTrigger id="ticket-template" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {templates.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ticket-width">Ancho de papel</FieldLabel>
                  <Select
                    value={String(value.paperWidth)}
                    onValueChange={(next) =>
                      setValue("paperWidth", Number(next) as 58 | 80)
                    }
                  >
                    <SelectTrigger id="ticket-width" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="58">
                          Rollo de 58 mm (predeterminado)
                        </SelectItem>
                        <SelectItem value="80">Rollo de 80 mm</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ticket-font">
                    Tamaño de fuente base (px)
                  </FieldLabel>
                  <Input
                    id="ticket-font"
                    type="number"
                    min={9}
                    max={18}
                    value={value.fontSize}
                    onChange={(e) =>
                      setValue("fontSize", Number(e.target.value))
                    }
                  />
                </Field>
              </FieldGroup>
              <p className="mt-4 text-xs text-muted-foreground">
                Los cuatro márgenes se ajustan en Configuración de impresora.
              </p>
              <div className="mt-5 grid gap-3">
                <PreviewSwitch
                  id="ticket-logo"
                  label="Logotipo de imagen"
                  checked={value.showLogo}
                  onCheckedChange={(next) => setValue("showLogo", next)}
                />
                <PreviewSwitch
                  id="ticket-cashier"
                  label="Mostrar nombre del cajero"
                  checked={value.showCashierName}
                  onCheckedChange={(next) => setValue("showCashierName", next)}
                />
                <p className="text-xs text-muted-foreground">
                  El nombre del cajero aparecerá cuando la venta tenga un
                  usuario asignado.
                </p>
                <PreviewSwitch
                  id="ticket-amount"
                  label="Mostrar importe"
                  checked={value.showAmount}
                  onCheckedChange={(next) => setValue("showAmount", next)}
                />
                <p className="text-xs text-muted-foreground">
                  Muestra el total de cada producto (cantidad × precio). El
                  precio por unidad siempre aparece.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Textos del pie</CardTitle>
              <CardDescription>
                Los mensajes aparecen al final del comprobante.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="ticket-thanks">
                    Agradecimiento final
                  </FieldLabel>
                  <Input
                    id="ticket-thanks"
                    value={value.thanks}
                    onChange={(e) => setValue("thanks", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ticket-invoice">
                    Mensaje de facturación
                  </FieldLabel>
                  <Input
                    id="ticket-invoice"
                    value={value.invoiceMessage}
                    onChange={(e) => setValue("invoiceMessage", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ticket-terms">
                    Términos y condiciones
                  </FieldLabel>
                  <Textarea
                    id="ticket-terms"
                    rows={3}
                    value={value.terms}
                    onChange={(e) => setValue("terms", e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center sm:justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ReceiptText className="size-4" /> Configuración local del
                ticket
              </div>
              <Button
                type="button"
                className="h-auto min-h-9 whitespace-normal"
                onClick={apply}
              >
                <Check data-icon="inline-start" /> Aplicar parámetros de ticket
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
        <Card className="min-w-0 xl:sticky xl:top-0">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Vista previa</CardTitle>
            <CardDescription>
              {value.paperWidth} mm ·{" "}
              {templates.find((item) => item.value === value.template)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <TicketPreview
              value={value}
              business={business}
              logoSrc={logoSrc}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
