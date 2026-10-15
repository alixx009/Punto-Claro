import { saveSettings, type AppSettings } from "./settings";
import { clearDatabaseDrafts } from "./local-data";

/** Preferences remain pending in SQLite until browser storage confirms the write. */
export async function applyPendingBackupSettings(): Promise<void> {
  const pending = await window.api.backup.pendingSettings();
  if (!pending) return;
  clearDatabaseDrafts();
  saveSettings(JSON.parse(pending.settingsJson) as AppSettings);
  await window.api.backup.acknowledgeSettings(pending.token);
}
