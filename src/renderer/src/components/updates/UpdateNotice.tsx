import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Download,
  RefreshCw,
  RotateCw,
  X,
} from "lucide-react";
import type { UpdateState } from "../../../../shared/updates";

export function UpdateNotice(): React.JSX.Element | null {
  const [state, setState] = useState<UpdateState | null>(null);
  const [dismissedStatus, setDismissedStatus] = useState<
    UpdateState["status"] | null
  >(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.api.updates.onStateChanged(setState);
    void window.api.updates
      .getState()
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setDismissedStatus(null);
  }, [state?.status]);

  if (
    !state ||
    dismissedStatus === state.status ||
    !["available", "downloading", "downloaded", "error"].includes(
      state.status,
    )
  ) {
    return null;
  }

  const retry = (): void => {
    void window.api.updates.check();
  };
  const download = (): void => {
    void window.api.updates.download();
  };
  const install = (): void => {
    void window.api.updates.install();
  };

  const title =
    state.status === "available"
      ? `Punto Claro ${state.availableVersion ?? ""} está disponible`
      : state.status === "downloading"
        ? "Descargando actualización"
        : state.status === "downloaded"
          ? "La actualización está lista"
          : "No se pudo completar la actualización";
  const Icon =
    state.status === "error"
      ? AlertCircle
      : state.status === "downloaded"
        ? RotateCw
        : state.status === "downloading"
          ? RefreshCw
          : Download;

  return (
    <Alert
      role="status"
      className="flex flex-col gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <AlertTitle className="line-clamp-none min-h-0">{title}</AlertTitle>
          <AlertDescription className="col-auto mt-1">
            {state.status === "available" &&
              "Puedes descargarla mientras sigues trabajando. La instalación requiere reiniciar la app."}
            {state.status === "downloading" &&
              `Descarga en curso: ${Math.round(state.percent)}%. Puedes seguir usando la app.`}
            {state.status === "downloaded" &&
              "Guarda o termina cualquier venta antes de reiniciar para instalarla."}
            {state.status === "error" && state.error}
          </AlertDescription>
          {state.status === "downloading" && (
            <progress
              className="mt-2 h-1.5 w-full accent-primary"
              max={100}
              value={state.percent}
              aria-label="Progreso de descarga"
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 sm:pl-4">
        {state.status === "available" && (
          <Button type="button" size="sm" onClick={download}>
            <Download data-icon="inline-start" />
            Descargar
          </Button>
        )}
        {state.status === "error" && (
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            <RefreshCw data-icon="inline-start" />
            Reintentar
          </Button>
        )}
        {state.status === "downloaded" && (
          <Button type="button" size="sm" onClick={install}>
            <RotateCw data-icon="inline-start" />
            Reiniciar y actualizar
          </Button>
        )}
        {state.status !== "downloading" ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Ocultar aviso de actualización"
            onClick={() => setDismissedStatus(state.status)}
          >
            <X />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDismissedStatus(state.status)}
          >
            Ocultar
          </Button>
        )}
      </div>
    </Alert>
  );
}
