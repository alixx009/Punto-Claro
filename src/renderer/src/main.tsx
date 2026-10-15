import "./assets/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeTheme } from "./config/theme";
import { applyPendingBackupSettings } from "./config/backup";
import { resetLocalDataForInitialSetup } from "./config/local-data";
import { Button } from "./components/ui/button";

const root = createRoot(document.getElementById("root")!);
async function startApplication(): Promise<void> {
  try {
    // Deleting SQLite does not delete Chromium's localStorage. Reset it before
    // the first administrator is created, so a new database starts clean.
    if (await window.api.auth.setupRequired()) {
      resetLocalDataForInitialSetup();
    } else {
      await applyPendingBackupSettings();
    }
    initializeTheme();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch {
    root.render(
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">
          No se pudo preparar la configuración
        </h1>
        <p>
          Los datos permanecen guardados. Reintenta para completar la
          configuración y abrir la aplicación.
        </p>
        <Button type="button" onClick={() => void startApplication()}>
          Reintentar
        </Button>
      </main>,
    );
  }
}
void startApplication();
