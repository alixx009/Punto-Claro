export interface BackupPreview {
  token: string;
  fileName: string;
  createdAt: string;
  totalRows: number;
  tables: { name: string; rows: number }[];
}

export interface BackupApi {
  exportExcel: (input: {
    settings: unknown;
  }) => Promise<{ saved: boolean; fileName?: string }>;
  preview: () => Promise<BackupPreview | null>;
  restore: (input: {
    token: string;
    currentSettings: unknown;
  }) => Promise<{ recoveryPath: string }>;
  discardPreview: (token: string) => Promise<void>;
  pendingSettings: () => Promise<{
    settingsJson: string;
    token: string;
  } | null>;
  acknowledgeSettings: (token: string) => Promise<void>;
}

export const BACKUP_CHANNELS = {
  exportExcel: "backup:export-excel",
  preview: "backup:preview",
  restore: "backup:restore",
  discardPreview: "backup:discard-preview",
  pendingSettings: "backup:pending-settings",
  acknowledgeSettings: "backup:acknowledge-settings",
} as const;
