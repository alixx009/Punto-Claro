import { useMemo, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Info,
  LoaderCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_LIMITS,
  type ProductImportRow,
} from "../../../../../../shared/product-import";
import { ImportIssuesTable } from "./ImportIssuesTable";
import { ImportProductsTable } from "./ImportProductsTable";
import type { ProductImportController } from "./useProductImport";

const quantities = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

function volumeSummary(rows: ProductImportRow[]): string {
  const totals = { PIEZA: 0, KG: 0, PAQ: 0 };
  for (const { input } of rows) totals[input.unit] += input.stock;
  const parts: string[] = [];
  if (totals.PIEZA) parts.push(`${quantities.format(totals.PIEZA)} piezas`);
  if (totals.KG) parts.push(`${quantities.format(totals.KG)} kg`);
  if (totals.PAQ) parts.push(`${quantities.format(totals.PAQ)} paquetes`);
  return parts.length ? parts.join(" · ") : "Sin existencias iniciales";
}

function ProductImportReviewDialog({
  controller,
}: {
  controller: ProductImportController;
}) {
  const { preview, pending, operation, error, requiresNewPreview } = controller;
  const title = useRef<HTMLHeadingElement>(null);
  const busy = operation !== null;
  const recovered = Boolean(pending && !preview);
  const alreadyImported = preview?.alreadyImported;
  const canConfirm =
    Boolean(pending) ||
    Boolean(
      preview?.token &&
      !preview.issueCount &&
      preview.rows.length &&
      !alreadyImported &&
      !requiresNewPreview,
    );
  const rows = preview?.rows ?? [];
  const skippedIssues = useMemo(
    () =>
      (preview?.skippedRows ?? []).map(({ sourceRow, sku }) => ({
        row: sourceRow,
        column: sku,
        message: "SKU ya registrado; se conserva el producto actual.",
      })),
    [preview?.skippedRows],
  );
  const fileName = preview?.fileName ?? pending?.fileName;

  return (
    <Dialog open onOpenChange={(open) => !open && controller.closePreview()}>
      <DialogContent
        className="grid max-h-[calc(100dvh-2rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:max-w-6xl sm:p-6"
        showCloseButton={!busy}
        aria-busy={busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          controller.restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1}>
            {recovered
              ? "Verificar importación pendiente"
              : "Revisar importación de productos"}
          </DialogTitle>
          <DialogDescription>
            {recovered
              ? "Comprueba el resultado de la última confirmación para continuar."
              : "Revisa el archivo antes de agregar los productos al catálogo."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-4 sm:-mx-6 sm:gap-5 sm:px-6">
          {fileName ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="outline" className="max-w-full">
                <FileSpreadsheet aria-hidden="true" />
                <span className="truncate">{fileName}</span>
              </Badge>
              <span className="text-sm text-muted-foreground">
                {preview?.totalRows ?? pending?.rowCount ?? 0} filas con datos
              </span>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                No se completó la confirmación
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {pending ? (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                {operation === "commit"
                  ? "Registrando productos"
                  : "Confirmación pendiente"}
              </AlertTitle>
              <AlertDescription>
                {operation === "commit"
                  ? "Espera mientras se descargan las imágenes y se confirma el registro del archivo."
                  : "Verifica esta importación antes de cargar otro archivo. Si ya se guardó, se mostrará el resultado sin volver a agregar los productos."}
              </AlertDescription>
            </Alert>
          ) : alreadyImported ? (
            <Alert>
              <FileCheck2 aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                Este archivo ya fue importado
              </AlertTitle>
              <AlertDescription>
                {alreadyImported.importedCount} productos se registraron
                anteriormente. Consulta el catálogo para verlos.
              </AlertDescription>
            </Alert>
          ) : preview?.issueCount ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                {preview.issueCount}{" "}
                {preview.issueCount === 1
                  ? "dato por corregir"
                  : "datos por corregir"}
              </AlertTitle>
              <AlertDescription>
                Corrige el archivo y vuelve a seleccionarlo. Todos los productos
                nuevos deben ser válidos para confirmar la importación.
              </AlertDescription>
            </Alert>
          ) : requiresNewPreview ? (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                Selecciona de nuevo el archivo
              </AlertTitle>
              <AlertDescription>
                Revisaremos nuevamente el archivo antes de registrar los
                productos.
              </AlertDescription>
            </Alert>
          ) : rows.length ? (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                {rows.length}{" "}
                {rows.length === 1
                  ? "producto listo para importar"
                  : "productos listos para importar"}
              </AlertTitle>
              <AlertDescription>
                <p>Existencias iniciales: {volumeSummary(rows)}.</p>
                <p>
                  Al confirmar se agregarán estos productos y se registrarán sus
                  existencias iniciales en Kardex.
                </p>
                <p>
                  Las imágenes de las URL se descargarán y guardarán en esta
                  computadora para mostrarse sin internet.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {!alreadyImported && skippedIssues.length ? (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                {skippedIssues.length}{" "}
                {skippedIssues.length === 1 ? "fila omitida" : "filas omitidas"}
              </AlertTitle>
              <AlertDescription>
                Estos SKU ya están registrados. Sus datos, precios, imágenes y
                existencias se conservarán; solo se agregarán los productos
                nuevos.
              </AlertDescription>
            </Alert>
          ) : null}
          {!alreadyImported && preview?.issues.length ? (
            <ImportIssuesTable
              issues={preview.issues}
              total={preview.issueCount}
            />
          ) : null}
          {!alreadyImported && rows.length ? (
            <ImportProductsTable rows={rows} />
          ) : null}
          {!alreadyImported && skippedIssues.length ? (
            <ImportIssuesTable
              variant="skipped"
              issues={skippedIssues}
              total={skippedIssues.length}
            />
          ) : null}
          {!alreadyImported &&
          !requiresNewPreview &&
          !error &&
          !rows.length &&
          !preview?.issueCount &&
          !recovered ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileSpreadsheet />
                </EmptyMedia>
                <EmptyTitle>
                  {skippedIssues.length
                    ? "Todos los SKU ya están registrados"
                    : "No hay productos para importar"}
                </EmptyTitle>
                <EmptyDescription>
                  {skippedIssues.length
                    ? "Este archivo no contiene productos nuevos para agregar al catálogo."
                    : "Llena al menos una fila en la hoja Productos y vuelve a seleccionar el archivo."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {!pending ? (
            <p className="text-xs text-muted-foreground">
              Archivos .xlsx · Máximo 25 MB y{" "}
              {PRODUCT_IMPORT_LIMITS.maxRows.toLocaleString("es-MX")} productos.
              Los SKU ya registrados se omiten. Cada SKU nuevo debe aparecer una
              sola vez en el archivo.
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-wrap">
          <Button
            variant="outline"
            onClick={controller.closePreview}
            disabled={busy}
          >
            Cerrar
          </Button>
          {!pending ? (
            <Button
              variant="outline"
              onClick={() => void controller.importExcel()}
              disabled={busy}
            >
              <FileSpreadsheet data-icon="inline-start" />
              Elegir otro archivo
            </Button>
          ) : null}
          {canConfirm ? (
            <Button
              variant="info"
              onClick={() => void controller.confirmImport()}
              disabled={busy}
            >
              {operation === "commit" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              {operation === "commit"
                ? "Confirmando..."
                : pending
                  ? "Verificar importación"
                  : `Importar ${rows.length} ${rows.length === 1 ? "producto" : "productos"}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductImportDialogs({
  controller,
}: {
  controller: ProductImportController;
}) {
  const { result, feedback } = controller;
  return (
    <>
      {controller.open ? (
        <ProductImportReviewDialog
          key={
            controller.preview?.token ??
            controller.preview?.fileName ??
            "pending"
          }
          controller={controller}
        />
      ) : null}
      {result ? (
        <Dialog open onOpenChange={(open) => !open && controller.closeResult()}>
          <DialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              controller.restoreFocus();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {result.alreadyImported
                  ? "Importación verificada"
                  : "Importación completada"}
              </DialogTitle>
              <DialogDescription>{result.fileName}</DialogDescription>
            </DialogHeader>
            <Alert role="status">
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle className="line-clamp-none">
                {result.importedCount}{" "}
                {result.importedCount === 1
                  ? "producto registrado"
                  : "productos registrados"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  {result.alreadyImported
                    ? "El archivo ya estaba registrado. La confirmación se recuperó correctamente y el catálogo está actualizado."
                    : "Los productos nuevos y sus existencias iniciales ya se encuentran en el catálogo. Sus imágenes se guardaron localmente para mostrarse sin internet."}
                </p>
                {result.skippedCount > 0 ? (
                  <p>
                    {result.skippedCount}{" "}
                    {result.skippedCount === 1
                      ? "fila omitida"
                      : "filas omitidas"}{" "}
                    por SKU ya registrado. Esos productos conservaron sus datos
                    y existencias.
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
            {controller.cleanupWarning ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle className="line-clamp-none">
                  Confirmación pendiente de actualizar
                </AlertTitle>
                <AlertDescription>{controller.cleanupWarning}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button onClick={controller.closeResult}>Aceptar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {feedback ? (
        <Dialog
          open
          onOpenChange={(open) => !open && controller.closeFeedback()}
        >
          <DialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              controller.restoreFocus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{feedback.title}</DialogTitle>
              <DialogDescription>{feedback.message}</DialogDescription>
            </DialogHeader>
            {feedback.kind === "template" ? (
              <Alert role="status">
                <Download aria-hidden="true" />
                <AlertTitle className="line-clamp-none">
                  Una fila por producto
                </AlertTitle>
                <AlertDescription>
                  <p>
                    Obligatorios:{" "}
                    {PRODUCT_IMPORT_COLUMNS.filter((column) => column.required)
                      .map((column) => column.header.replace(/\s*\*$/, ""))
                      .join(", ")}
                    .
                  </p>
                  <p>
                    Elige la unidad y categoría en las listas de la hoja. Usa
                    cantidades enteras para piezas y paquetes; en kg puedes usar
                    hasta tres decimales.
                  </p>
                  <p>
                    Conserva el SKU como texto para mantener los ceros
                    iniciales. Los precios permiten hasta dos decimales.
                  </p>
                  <p>
                    Los SKU que ya existen en el catálogo se omiten; solo se
                    agregarán los productos nuevos.
                  </p>
                  <p>
                    Puedes agregar la fotografía después de importar, desde
                    Editar producto.
                  </p>
                  <p>
                    Si llenas Imagen (URL), usa un enlace directo a una imagen
                    pública. La app la descargará al confirmar; necesita
                    conexión solo para esa descarga inicial.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button onClick={controller.closeFeedback}>Entendido</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
