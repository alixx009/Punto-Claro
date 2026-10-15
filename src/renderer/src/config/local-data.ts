import { defaultSettings, saveSettings } from "./settings";

/** These drafts contain IDs that are only valid in their original database. */
export function clearDatabaseDrafts(): void {
  const obsoleteKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (
      key &&
      (key === "pos.sales.heldOrders.v1" ||
        key.startsWith("pos.sales.heldOrders.v1:") ||
        key.startsWith("suma-pos:product-import:pending:v1:") ||
        key.startsWith("pos.pending-purchase.v1."))
    ) {
      obsoleteKeys.push(key);
    }
  }
  for (const key of obsoleteKeys) localStorage.removeItem(key);
}

/** Run before rendering initial setup, including when only pos.db was deleted. */
export function resetLocalDataForInitialSetup(): void {
  clearDatabaseDrafts();
  saveSettings(structuredClone(defaultSettings));
}
