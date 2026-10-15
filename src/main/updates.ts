import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { assertTrustedSender } from "./ipc-security";
import { UPDATE_CHANNELS, type UpdateState } from "../shared/updates";

let state: UpdateState = {
  status: "unsupported",
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: 0,
  error: null,
};
let initialized = false;

function publishState(next: Partial<UpdateState>): void {
  state = { ...state, ...next };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(UPDATE_CHANNELS.stateChanged, state);
    }
  }
}

function registerHandlers(): void {
  ipcMain.handle(UPDATE_CHANNELS.getState, (event) => {
    assertTrustedSender(event);
    return state;
  });
  ipcMain.handle(UPDATE_CHANNELS.check, async (event) => {
    assertTrustedSender(event);
    await checkForUpdates();
    return state;
  });
  ipcMain.handle(UPDATE_CHANNELS.download, (event) => {
    assertTrustedSender(event);
    if (state.status !== "available") {
      throw new Error("No hay una actualización lista para descargar.");
    }
    publishState({ status: "downloading", percent: 0, error: null });
    void autoUpdater.downloadUpdate().catch((error: unknown) => {
      console.error("No se pudo descargar la actualización:", error);
      publishState({
        status: "error",
        error: "No se pudo descargar la actualización. Comprueba tu conexión e inténtalo de nuevo.",
      });
    });
  });
  ipcMain.handle(UPDATE_CHANNELS.install, (event) => {
    assertTrustedSender(event);
    if (state.status !== "downloaded") {
      throw new Error("La actualización todavía no está descargada.");
    }
    autoUpdater.quitAndInstall(false, true);
  });
}

async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged || process.platform !== "win32") {
    publishState({ status: "unsupported" });
    return;
  }
  if (state.status === "checking" || state.status === "downloading") return;

  publishState({ status: "checking", error: null, percent: 0 });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("No se pudo comprobar si hay actualizaciones:", error);
    publishState({
      status: "error",
      error: "No se pudo comprobar si hay actualizaciones. Revisa tu conexión e inténtalo de nuevo.",
    });
  }
}

export function initializeUpdates(): void {
  if (initialized) return;
  initialized = true;
  registerHandlers();

  if (!app.isPackaged || process.platform !== "win32") {
    publishState({ status: "unsupported" });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    publishState({ status: "checking", error: null });
  });
  autoUpdater.on("update-available", (info) => {
    publishState({
      status: "available",
      availableVersion: info.version,
      percent: 0,
      error: null,
    });
  });
  autoUpdater.on("update-not-available", () => {
    publishState({ status: "up-to-date", availableVersion: null, error: null });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishState({ status: "downloading", percent: progress.percent });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishState({
      status: "downloaded",
      availableVersion: info.version,
      percent: 100,
      error: null,
    });
  });
  autoUpdater.on("error", (error) => {
    console.error("Error del actualizador:", error);
    publishState({
      status: "error",
      error: "No se pudo completar la actualización. Revisa tu conexión e inténtalo de nuevo.",
    });
  });

  // Give the main window time to load; the renderer can also request the
  // current state after startup if this check finishes before it subscribes.
  setTimeout(() => void checkForUpdates(), 2500);
}
