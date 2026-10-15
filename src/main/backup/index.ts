import { app, BrowserWindow, dialog, type WebContents } from "electron";
import { basename, extname, join } from "node:path";
import { open, writeFile, mkdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import {
  getCurrentAuthSession,
  requireAdmin,
  clearAuthAfterRestore,
} from "../auth";
import { getDb, nowInAppTz } from "../db/database";
import {
  captureDatabaseSnapshot,
  validateDatabaseSnapshot,
  replaceDatabaseFromSnapshot,
} from "../db/backup-core";
import type { BackupPreview } from "../../shared/backup";
import {
  buildBackupWorkbook,
  parseBackupWorkbook,
  BACKUP_WORKBOOK_LIMITS,
} from "./workbook";
import { backupSettingsJson, validateSettingsJson } from "./settings";
import { setDataReplacementInProgress } from "./state";

type RestorePreview = BackupPreview & {
  senderId: number;
  sessionId: string;
  userId: string;
  expiresAt: number;
  snapshot: Buffer;
  settingsJson: string;
};
let preview: RestorePreview | null = null;
let busy = false;
const PREVIEW_DURATION_MS = 15 * 60 * 1000;
const tracked = new Set<number>();
const cleanup = setInterval(() => {
  if (preview && preview.expiresAt <= Date.now()) preview = null;
}, 60_000);
cleanup.unref();

function context(contents: WebContents) {
  const user = requireAdmin(contents.id);
  const session = getCurrentAuthSession(contents.id);
  const owner = BrowserWindow.fromWebContents(contents);
  if (!session || !owner || owner.isDestroyed() || contents.isDestroyed())
    throw new Error("AUTH_REQUIRED: Inicia sesión para continuar.");
  if (!tracked.has(contents.id)) {
    tracked.add(contents.id);
    contents.once("destroyed", () => {
      if (preview?.senderId === contents.id) preview = null;
      tracked.delete(contents.id);
    });
  }
  const assertAllowed = () => {
    if (contents.isDestroyed() || owner.isDestroyed())
      throw new Error("La ventana se cerró durante el respaldo.");
    const current = getCurrentAuthSession(contents.id);
    if (!current || current.id !== session.id || current.user.id !== user.id)
      throw new Error(
        "AUTH_REQUIRED: La sesión cambió. Inicia sesión de nuevo.",
      );
    requireAdmin(contents.id);
  };
  return { owner, sessionId: session.id, userId: user.id, assertAllowed };
}

async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  if (busy)
    throw new Error("Hay un respaldo en proceso. Espera a que termine.");
  busy = true;
  try {
    return await operation();
  } finally {
    busy = false;
  }
}

export async function exportDatabaseExcel(
  contents: WebContents,
  input: { settings: unknown },
) {
  const { owner, assertAllowed } = context(contents);
  const settingsJson = backupSettingsJson(input?.settings);
  return exclusive(async () => {
    const selection = await dialog.showSaveDialog(owner, {
      title: "Guardar respaldo integral",
      defaultPath: join(
        app.getPath("documents"),
        `Respaldo-POS-${nowInAppTz().slice(0, 10)}.xlsx`,
      ),
      filters: [{ name: "Respaldo Excel (.xlsx)", extensions: ["xlsx"] }],
    });
    assertAllowed();
    if (selection.canceled || !selection.filePath) return { saved: false };
    const path = /\.xlsx$/i.test(selection.filePath)
      ? selection.filePath
      : `${selection.filePath}.xlsx`;
    const snapshot = captureDatabaseSnapshot();
    const buffer = await buildBackupWorkbook(snapshot, settingsJson);
    assertAllowed();
    try {
      await writeFile(path, buffer);
    } catch {
      throw new Error(
        "No se pudo guardar el respaldo. Revisa el espacio disponible y que el archivo no esté abierto.",
      );
    }
    return { saved: true, fileName: basename(path) };
  });
}

async function readSelectedFile(path: string): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > BACKUP_WORKBOOK_LIMITS.maxFileBytes)
      throw new Error(
        "El respaldo no es un archivo válido o supera el tamaño permitido.",
      );
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const result = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset !== stat.size)
      throw new Error(
        "El archivo cambió mientras se leía. Ciérralo y vuelve a intentarlo.",
      );
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

export async function previewDatabaseRestore(
  contents: WebContents,
): Promise<BackupPreview | null> {
  const { owner, assertAllowed, sessionId, userId } = context(contents);
  return exclusive(async () => {
    preview = null;
    const selected = await dialog.showOpenDialog(owner, {
      title: "Seleccionar respaldo integral para restaurar",
      properties: ["openFile"],
      filters: [{ name: "Respaldo Excel (.xlsx)", extensions: ["xlsx"] }],
    });
    assertAllowed();
    if (selected.canceled || !selected.filePaths[0]) return null;
    const path = selected.filePaths[0];
    if (extname(path).toLowerCase() !== ".xlsx")
      throw new Error(
        "Selecciona un respaldo integral .xlsx generado por esta aplicación.",
      );
    const buffer = await readSelectedFile(path);
    const parsed = await parseBackupWorkbook(buffer);
    assertAllowed();
    const settingsJson = validateSettingsJson(parsed.settingsJson);
    const summary = validateDatabaseSnapshot(parsed.snapshot);
    assertAllowed();
    const publicPreview: BackupPreview = {
      token: randomUUID(),
      fileName: basename(path),
      createdAt: parsed.createdAt,
      totalRows: summary.totalRows,
      tables: summary.tables,
    };
    preview = {
      ...publicPreview,
      senderId: contents.id,
      sessionId,
      userId,
      snapshot: parsed.snapshot,
      settingsJson,
      expiresAt: Date.now() + PREVIEW_DURATION_MS,
    };
    return publicPreview;
  });
}

export function discardDatabasePreview(
  contents: WebContents,
  token: string,
): void {
  if (preview?.senderId === contents.id && preview.token === token)
    preview = null;
}

export async function restoreDatabaseExcel(
  contents: WebContents,
  input: { token: string; currentSettings: unknown },
) {
  const { assertAllowed, sessionId, userId } = context(contents);
  if (!input || typeof input.token !== "string")
    throw new Error("Selecciona y verifica un respaldo antes de restaurarlo.");
  const previousSettingsJson = backupSettingsJson(input.currentSettings);
  return exclusive(async () => {
    const saved = preview;
    if (
      !saved ||
      saved.token !== input.token ||
      saved.senderId !== contents.id ||
      saved.sessionId !== sessionId ||
      saved.userId !== userId ||
      saved.expiresAt <= Date.now()
    )
      throw new Error(
        "La revisión del respaldo venció o la sesión cambió. Selecciona el archivo otra vez.",
      );
    assertAllowed();
    setDataReplacementInProgress(true);
    try {
      const currentSnapshot = captureDatabaseSnapshot();
      const recovery = await buildBackupWorkbook(
        currentSnapshot,
        previousSettingsJson,
      );
      assertAllowed();
      const directory = join(app.getPath("userData"), "backups");
      const stamp = nowInAppTz()
        .replace(/[^0-9]/g, "")
        .slice(0, 14);
      const recoveryPath = join(
        directory,
        `Recuperacion-${stamp}-${randomUUID().slice(0, 8)}.xlsx`,
      );
      await mkdir(directory, { recursive: true });
      await writeFile(recoveryPath, recovery, { flag: "wx" });
      assertAllowed();
      replaceDatabaseFromSnapshot(saved.snapshot, saved.settingsJson);
      clearAuthAfterRestore();
      preview = null;
      return { recoveryPath };
    } finally {
      setDataReplacementInProgress(false);
    }
  });
}

export function pendingBackupSettings(): {
  settingsJson: string;
  token: string;
} | null {
  const row = getDb()
    .prepare(
      "SELECT settings_json FROM app_backup_preferences WHERE id = 1 AND restore_pending = 1",
    )
    .get() as { settings_json: string } | undefined;
  if (!row) return null;
  const settingsJson = validateSettingsJson(row.settings_json);
  return {
    settingsJson,
    token: createHash("sha256").update(settingsJson).digest("hex"),
  };
}

export function acknowledgeBackupSettings(token: string): void {
  const pending = pendingBackupSettings();
  if (!pending || pending.token !== token)
    throw new Error("Los ajustes restaurados cambiaron. Vuelve a cargarlos.");
  getDb()
    .prepare(
      "UPDATE app_backup_preferences SET restore_pending = 0 WHERE id = 1",
    )
    .run();
}
