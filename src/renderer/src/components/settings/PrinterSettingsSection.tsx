import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, FileText, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettings, saveSettings } from "@/config/settings";
import {
  DEFAULT_PRINTER_MARGINS,
  isValidPrinterMargins,
  MAX_PRINTER_SIDE_MARGIN_MM,
  MAX_PRINTER_VERTICAL_MARGIN_MM,
  type PrinterMargins,
  type SystemPrinter,
} from "../../../../shared/ipc";

const marginFields: Array<{
  key: keyof PrinterMargins;
  id: string;
  label: string;
  maximum: number;
}> = [
  {
    key: "leftMm",
    id: "left",
    label: "Margen izquierdo",
    maximum: MAX_PRINTER_SIDE_MARGIN_MM,
  },
  {
    key: "rightMm",
    id: "right",
    label: "Margen derecho",
    maximum: MAX_PRINTER_SIDE_MARGIN_MM,
  },
  {
    key: "topMm",
    id: "top",
    label: "Margen superior",
    maximum: MAX_PRINTER_VERTICAL_MARGIN_MM,
  },
  {
    key: "bottomMm",
    id: "bottom",
    label: "Margen inferior",
    maximum: MAX_PRINTER_VERTICAL_MARGIN_MM,
  },
];

export function PrinterSettingsSection({
  selectedName,
  onSelectedNameChange,
}: {
  selectedName: string;
  onSelectedNameChange: Dispatch<SetStateAction<string>>;
}) {
  const [printers, setPrinters] = useState<SystemPrinter[]>([]);
  const [savedName, setSavedName] = useState(() => getSettings().printerName);
  const [marginValues, setMarginValues] = useState(() => {
    const saved = getSettings().printerMargins;
    return {
      leftMm: String(saved.leftMm),
      rightMm: String(saved.rightMm),
      topMm: String(saved.topMm),
      bottomMm: String(saved.bottomMm),
    };
  });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoaded(false);
    setError("");
    setFeedback("");
    try {
      const available = await window.api.printers.list();
      setPrinters(available);
      setLoaded(true);
    } catch (cause) {
      setPrinters([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo consultar la lista de impresoras de Windows.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedAvailable = printers.some(
    (printer) => printer.name === selectedName,
  );
  const savedMissing =
    loaded &&
    !!savedName &&
    !printers.some((printer) => printer.name === savedName);
  const activePrinter = printers.find(
    (printer) => printer.name === selectedName,
  );
  const margins = {
    leftMm: Number(marginValues.leftMm),
    rightMm: Number(marginValues.rightMm),
    topMm: Number(marginValues.topMm),
    bottomMm: Number(marginValues.bottomMm),
  };
  const marginsValid =
    marginFields.every(({ key }) => marginValues[key].trim() !== "") &&
    isValidPrinterMargins(margins);

  const save = () => {
    if (!selectedAvailable) return;
    if (!marginsValid) {
      setError(
        `Usa márgenes laterales de 0 a ${MAX_PRINTER_SIDE_MARGIN_MM} mm y superior e inferior de 0 a ${MAX_PRINTER_VERTICAL_MARGIN_MM} mm.`,
      );
      return;
    }
    try {
      saveSettings({
        ...getSettings(),
        printerName: selectedName,
        printerMargins: margins,
      });
      setSavedName(selectedName);
      setError("");
      setFeedback("Impresora y márgenes guardados en este equipo.");
    } catch {
      setError("No se pudo guardar la impresora seleccionada.");
    }
  };

  const printTest = async () => {
    if (!selectedAvailable || printing) return;
    if (!marginsValid) {
      setError(
        `Usa márgenes laterales de 0 a ${MAX_PRINTER_SIDE_MARGIN_MM} mm y superior e inferior de 0 a ${MAX_PRINTER_VERTICAL_MARGIN_MM} mm.`,
      );
      return;
    }
    setPrinting(true);
    setError("");
    setFeedback("");
    try {
      await window.api.printers.printTest({
        printerName: selectedName,
        paperWidth: getSettings().ticket.paperWidth,
        margins,
      });
      setFeedback("Ticket de prueba enviado con los márgenes mostrados.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo enviar el ticket de prueba.",
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Configuración de impresora
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige una impresora instalada en Windows para los tickets.
        </p>
      </div>
      <Card>
        <CardHeader className="grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] px-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Printer className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Impresora de tickets principal</CardTitle>
              <CardDescription className="mt-1">
                La lista se obtiene de la cola de impresión del sistema.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => void refresh()}
            aria-label="Actualizar impresoras"
          >
            <RefreshCw
              data-icon="inline-start"
              className={loading ? "animate-spin" : ""}
            />{" "}
            Actualizar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-4 sm:px-6">
          <Field>
            <FieldLabel htmlFor="active-printer">Impresora activa</FieldLabel>
            <Select
              value={selectedAvailable ? selectedName : ""}
              onValueChange={(next) => {
                onSelectedNameChange(next);
                setFeedback("");
                setError("");
              }}
              disabled={loading || printers.length === 0}
            >
              <SelectTrigger id="active-printer" className="w-full max-w-xl">
                <SelectValue
                  placeholder={
                    loading
                      ? "Buscando impresoras…"
                      : "Selecciona una impresora"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {printers.map((printer) => (
                    <SelectItem key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {!loading && printers.length === 0
                ? "Windows no devolvió impresoras instaladas. Comprueba la conexión y vuelve a actualizar."
                : "Se muestra el nombre visible; la app guarda el identificador del sistema."}
            </FieldDescription>
          </Field>
          {activePrinter && (
            <div className="break-words rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <span className="font-medium">Detectada por Windows:</span>{" "}
              {activePrinter.displayName || activePrinter.name}
              {activePrinter.description && (
                <span className="ml-2 text-muted-foreground">
                  · {activePrinter.description}
                </span>
              )}
            </div>
          )}
          {savedMissing && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Atención: La impresora guardada no se encuentra disponible.
                Verifique la conexión USB o seleccione otra de la lista.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Prueba y márgenes</CardTitle>
              <CardDescription className="mt-1">
                El ancho de papel, 58 mm u 80 mm, se define en Diseño de ticket.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Aumenta los márgenes si el texto sale cortado en los bordes. La
            prueba usa los valores mostrados; guárdalos para aplicarlos a las
            ventas.
          </p>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {marginFields.map(({ key, id, label, maximum }) => {
              const invalid =
                marginValues[key].trim() === "" ||
                !Number.isFinite(margins[key]) ||
                margins[key] < 0 ||
                margins[key] > maximum;
              return (
                <Field key={key} data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor={`printer-${id}-margin`}>
                    {label} (mm)
                  </FieldLabel>
                  <Input
                    id={`printer-${id}-margin`}
                    type="number"
                    min={0}
                    max={maximum}
                    step={0.1}
                    inputMode="decimal"
                    value={marginValues[key]}
                    aria-invalid={invalid || undefined}
                    onChange={(event) => {
                      const next = event.target.value;
                      setMarginValues((previous) => ({
                        ...previous,
                        [key]: next,
                      }));
                      setError("");
                      setFeedback("");
                    }}
                  />
                  <FieldDescription>
                    De 0 a {maximum} mm · predeterminado:{" "}
                    {DEFAULT_PRINTER_MARGINS[key]} mm.
                  </FieldDescription>
                </Field>
              );
            })}
          </FieldGroup>
          <p className="text-xs text-muted-foreground">
            El margen inferior se suma al avance final configurado en el
            controlador de Windows.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center sm:justify-between px-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 whitespace-normal"
            disabled={!selectedAvailable || loading || printing}
            onClick={() => void printTest()}
          >
            <Printer data-icon="inline-start" />{" "}
            {printing ? "Enviando…" : "Imprimir ticket de prueba"}
          </Button>
          <Button
            type="button"
            className="h-auto min-h-9 whitespace-normal"
            disabled={!selectedAvailable || loading}
            onClick={save}
          >
            Guardar configuración de impresora
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
