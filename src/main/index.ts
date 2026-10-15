import { app, shell, BrowserWindow } from "electron";
import { mkdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { initDatabase, closeDatabase } from "./db/database";
import { registerIpcHandlers } from "./ipc-handlers";
import { trustAppWindow } from "./ipc-security";
import { initializeUpdates } from "./updates";

// Keep using the data folder from the existing pos-app installation even
// though the installer now displays the stable product name "Punto Claro".
const userDataPath = join(app.getPath("appData"), "pos-app");
mkdirSync(userDataPath, { recursive: true });
app.setPath("userData", userDataPath);

function detectTimezone(): string {
  if (process.env.POS_TZ) return process.env.POS_TZ;
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return !detected || detected === "UTC" ? "America/Mexico_City" : detected;
  } catch {
    return "America/Mexico_City";
  }
}
process.env.TZ = detectTimezone();

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 360,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url))
      void shell.openExternal(url);
    return { action: "deny" };
  });
  const rendererFile = join(__dirname, "../renderer/index.html");
  const rendererUrl =
    is.dev && process.env.ELECTRON_RENDERER_URL
      ? process.env.ELECTRON_RENDERER_URL
      : pathToFileURL(rendererFile).href;
  trustAppWindow(mainWindow.webContents, rendererUrl);
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(rendererFile);
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.alixx009.puntoclaro");
  initDatabase();
  registerIpcHandlers();
  initializeUpdates();
  app.on("browser-window-created", (_, window) =>
    optimizer.watchWindowShortcuts(window),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("will-quit", () => closeDatabase());
