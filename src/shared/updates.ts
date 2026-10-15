export const UPDATE_CHANNELS = {
  getState: "updates:get-state",
  check: "updates:check",
  download: "updates:download",
  install: "updates:install",
  stateChanged: "updates:state-changed",
} as const;

export type UpdateStatus =
  | "unsupported"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  percent: number;
  error: string | null;
}

export interface UpdatesApi {
  getState: () => Promise<UpdateState>;
  check: () => Promise<UpdateState>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  onStateChanged: (listener: (state: UpdateState) => void) => () => void;
}
