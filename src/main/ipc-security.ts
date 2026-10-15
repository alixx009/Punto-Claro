import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import type { AuthUser, PermissionKey } from "../shared/auth";
import { requireAdmin, requirePermission, requireUser, logout } from "./auth";
import { getCurrentSession } from "./db/register";
import { assertDataAvailable } from "./backup/state";

const trustedWindows = new Map<number, string>();

function documentUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href;
}

export function trustAppWindow(
  contents: WebContents,
  expectedUrl: string,
): void {
  trustedWindows.set(contents.id, documentUrl(expectedUrl));
  contents.once("destroyed", () => {
    logout(contents.id);
    trustedWindows.delete(contents.id);
  });
  contents.on("will-navigate", (event, url) => {
    if (documentUrl(url) !== documentUrl(expectedUrl)) event.preventDefault();
  });
}

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const expected = trustedWindows.get(event.sender.id);
  const frame = event.senderFrame;
  const mainFrame = event.sender.mainFrame;
  if (
    !expected ||
    !frame ||
    frame.processId !== mainFrame.processId ||
    frame.routingId !== mainFrame.routingId ||
    documentUrl(frame.url) !== expected
  ) {
    throw new Error(
      "AUTH_FORBIDDEN: Esta ventana no puede acceder a los datos de la aplicación.",
    );
  }
}

type Handler = (
  event: IpcMainInvokeEvent,
  user: AuthUser,
  ...args: any[]
) => unknown;

export function authenticatedHandle(
  channel: string,
  handler: Handler,
  requirement?: PermissionKey | "admin" | PermissionKey[],
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    assertDataAvailable();
    const user =
      requirement === "admin"
        ? requireAdmin(event.sender.id)
        : requireUser(event.sender.id);
    if (requirement && requirement !== "admin") {
      for (const permission of Array.isArray(requirement)
        ? requirement
        : [requirement]) {
        requirePermission(event.sender.id, permission);
      }
    }
    return handler(event, user, ...args);
  });
}

export function hasPermission(user: AuthUser, key: PermissionKey): boolean {
  return user.role === "admin" || user.permissions.includes(key);
}

export function assertCanOperateRegister(
  user: AuthUser,
  sessionId?: number,
): void {
  const session = getCurrentSession();
  if (!session || (sessionId !== undefined && sessionId !== session.id)) {
    throw new Error("Abre la caja antes de realizar esta operación.");
  }
  if (user.role !== "admin" && session.cashierId !== user.id) {
    throw new Error(
      "AUTH_FORBIDDEN: Esta caja pertenece a otro cajero o a un turno anterior. Solicita al administrador que cierre el turno.",
    );
  }
}
