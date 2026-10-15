import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { getSettings } from "@/config/settings";
import { applyPendingBackupSettings } from "@/config/backup";
import { suspendAuthRefresh } from "@/auth/useAuth";
import type { BackupPreview } from "../../../../shared/backup";

type Feedback = { title: string; text: string; restored?: boolean };
const SUMMARY_TABLES = [
  ["products", "Productos"],
  ["customers", "Clientes"],
  ["sales", "Ventas"],
  ["suppliers", "Proveedores"],
  ["purchases", "Compras"],
  ["auth_users", "Usuarios"],
] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      )
    : "No se pudo completar la operación. Vuelve a intentarlo.";
}

export function BackupSettingsCard() {
  const [operation, setOperation] = useState<
    "export" | "verify" | "restore" | null
  >(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const token = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (token.current)
        void window.api.backup.discardPreview(token.current).catch(() => {});
    };
  }, []);

  async function exportExcel() {
    if (busy.current) return;
    busy.current = true;
    setOperation("export");
    try {
      const saved = await window.api.backup.exportExcel({
        settings: getSettings(),
      });
      if (mounted.current && saved.saved)
        setFeedback({
          title: "Respaldo creado",
          text: `${saved.fileName ?? "El respaldo"} se guardó correctamente. Conserva este archivo en un lugar seguro: contiene datos del negocio y cuentas de usuario. No edites sus hojas antes de restaurarlo.`,
        });
    } catch (error) {
      if (mounted.current)
        setFeedback({
          title: "No se pudo crear el respaldo",
          text: errorMessage(error),
        });
    } finally {
      busy.current = false;
      if (mounted.current) setOperation(null);
    }
  }

  async function verifyFile() {
    if (busy.current) return;
    busy.current = true;
    setOperation("verify");
    try {
      const result = await window.api.backup.preview();
      if (!result) return;
      if (!mounted.current) {
        await window.api.backup.discardPreview(result.token);
        return;
      }
      token.current = result.token;
      setPreview(result);
      setConfirmed(false);
    } catch (error) {
      if (mounted.current)
        setFeedback({
          title: "El respaldo no se pudo verificar",
          text: `${errorMessage(error)} Los datos actuales se conservan.`,
        });
    } finally {
      busy.current = false;
      if (mounted.current) setOperation(null);
    }
  }

  function cancelPreview() {
    if (busy.current) return;
    if (token.current)
      void window.api.backup.discardPreview(token.current).catch(() => {});
    token.current = null;
    setPreview(null);
    setConfirmed(false);
  }

  async function restore() {
    if (busy.current || !preview || !confirmed) return;
    busy.current = true;
    setOperation("restore");
    suspendAuthRefresh(true);
    let restored = false;
    try {
      const result = await window.api.backup.restore({
        token: preview.token,
        currentSettings: getSettings(),
      });
      restored = true;
      token.current = null;
      let settingsWarning = "";
      try {
        await applyPendingBackupSettings();
      } catch {
        settingsWarning =
          " Al volver a entrar se reintentará aplicar la configuración del respaldo.";
      }
      if (!mounted.current) {
        window.location.reload();
        return;
      }
      setPreview(null);
      setFeedback({
        restored: true,
        title: "Base de datos importada y reemplazada",
        text: `El respaldo se restauró correctamente. Inicia sesión con una cuenta del archivo importado. Se guardó una copia de recuperación de tus datos anteriores en: ${result.recoveryPath}.${settingsWarning}`,
      });
    } catch (error) {
      if (mounted.current) {
        setPreview(null);
        setFeedback({
          title: "No se pudo restaurar el respaldo",
          text: `${errorMessage(error)} La restauración no se completó y los datos anteriores se conservan.`,
        });
      }
    } finally {
      if (!restored) suspendAuthRefresh(false);
      busy.current = false;
      if (mounted.current) setOperation(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Respaldo integral</CardTitle>
          <CardDescription>
            Guarda los datos de tu negocio en un archivo Excel y restáuralos en
            esta instalación cuando lo necesites. Disponible para
            administradores.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Incluye ventas, clientes, productos, compras, proveedores, caja,
            devoluciones, movimientos, usuarios, permisos, consecutivos y
            ajustes. Las imágenes y los logotipos locales no se incluyen.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => void exportExcel()}
              disabled={operation !== null}
            >
              {operation === "export" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {operation === "export"
                ? "Creando respaldo…"
                : "Descargar respaldo Excel"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void verifyFile()}
              disabled={operation !== null}
            >
              {operation === "verify" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              {operation === "verify"
                ? "Verificando archivo…"
                : "Importar y reemplazar datos"}
            </Button>
          </div>
          <Alert>
            <ShieldCheck />
            <AlertTitle className="line-clamp-none">
              Verificación antes de restaurar
            </AlertTitle>
            <AlertDescription>
              Solo se admiten respaldos integrales generados por esta versión
              compatible de la app. Se verifican el archivo, su contenido, las
              relaciones entre registros y el acceso del administrador antes de
              pedir confirmación. La importación reemplaza todos los datos
              actuales.
            </AlertDescription>
          </Alert>
          <p className="text-xs text-muted-foreground">
            Archivos .xlsx de hasta 64 MB; base de datos de hasta 64 MB.
          </p>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && cancelPreview()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Reemplazar la base de datos actual?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El archivo {preview?.fileName} fue verificado. Esta acción
              reemplazará los datos y usuarios de esta instalación por los del
              respaldo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preview && (
            <>
              <p className="text-sm text-muted-foreground">
                Creado: {new Date(preview.createdAt).toLocaleString("es-MX")}
              </p>
              <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
                {SUMMARY_TABLES.map(([table, label]) => (
                  <div key={table}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">
                      {(
                        preview.tables.find((entry) => entry.name === table)
                          ?.rows ?? 0
                      ).toLocaleString("es-MX")}
                    </dd>
                  </div>
                ))}
              </dl>
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle className="line-clamp-none">
                  Necesitarás el acceso del respaldo
                </AlertTitle>
                <AlertDescription>
                  Asegúrate de conocer un usuario administrador y su contraseña
                  del archivo importado. Se cerrará la sesión actual. Primero se
                  guardará una copia de recuperación de los datos que tienes
                  ahora. Las ventas en espera y revisiones locales pendientes se
                  descartarán.
                </AlertDescription>
              </Alert>
              <Field orientation="horizontal">
                <Checkbox
                  id="backup-confirm-replace"
                  checked={confirmed}
                  disabled={operation === "restore"}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                />
                <FieldLabel htmlFor="backup-confirm-replace">
                  Confirmo que quiero reemplazar todos los datos y conozco las
                  credenciales de una cuenta del respaldo.
                </FieldLabel>
              </Field>
            </>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={cancelPreview}
              disabled={operation === "restore"}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void restore()}
              disabled={!confirmed || operation === "restore"}
            >
              {operation === "restore" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : null}
              {operation === "restore" ? "Restaurando…" : "Reemplazar datos"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(feedback)}
        onOpenChange={(open) => {
          if (open) return;
          if (feedback?.restored) window.location.reload();
          else setFeedback(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{feedback?.title}</DialogTitle>
            <DialogDescription className="break-words">
              {feedback?.text}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                if (feedback?.restored) window.location.reload();
                else setFeedback(null);
              }}
            >
              {feedback?.restored ? "Ir al inicio de sesión" : "Entendido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
