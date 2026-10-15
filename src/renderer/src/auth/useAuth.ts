import { useSyncExternalStore } from "react";
import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  InitialAdminInput,
  PermissionKey,
} from "../../../shared/auth";
import { resetSessionData } from "@/data/sessionData";

interface AuthState {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous" | "setup-required";
  error: string | null;
}

let state: AuthState = { user: null, status: "loading", error: null };
let generation = 0;
let initialized = false;
let changingSession = false;
let refreshSuspended = false;
let refreshPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function message(error: unknown): string {
  if (!(error instanceof Error))
    return "No se pudo conectar con la sesión. Vuelve a intentarlo.";
  return error.message.replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    "",
  );
}

function accessKey(user: AuthUser | null): string {
  return user
    ? `${user.id}|${user.role}|${[...user.permissions].sort().join(",")}|${user.mustChangePassword}`
    : "";
}

function publish(
  session: AuthSession | null,
  error: string | null = null,
  setupRequired = false,
): void {
  const user = session?.user ?? null;
  if (accessKey(state.user) !== accessKey(user)) resetSessionData();
  state = {
    user,
    status: user
      ? "authenticated"
      : setupRequired
        ? "setup-required"
        : "anonymous",
    error,
  };
  listeners.forEach((listener) => listener());
}

export function refreshAuth(force = false): Promise<void> {
  if (changingSession || refreshSuspended) return Promise.resolve();
  if (force) {
    ++generation;
    refreshPromise = null;
  }
  if (refreshPromise) return refreshPromise;
  const revision = generation;
  const request = Promise.all([
    window.api.auth.current(),
    window.api.auth.setupRequired(),
  ])
    .then(
      ([session, setupRequired]) => {
        if (revision === generation) publish(session, null, setupRequired);
      },
      (error: unknown) => {
        if (revision === generation) publish(null, message(error));
      },
    )
    .finally(() => {
      if (refreshPromise === request) refreshPromise = null;
    });
  refreshPromise = request;
  return request;
}

const refresh = () => refreshAuth(true);

export function suspendAuthRefresh(value: boolean): void {
  refreshSuspended = value;
  if (value) {
    ++generation;
    refreshPromise = null;
  }
}

function initialize(): void {
  if (initialized) return;
  initialized = true;
  void refreshAuth();
  window.addEventListener("focus", () => {
    void refreshAuth();
  });
  window.setInterval(() => {
    void refreshAuth();
  }, 60_000);
}

async function login(input: LoginInput): Promise<void> {
  const revision = ++generation;
  changingSession = true;
  try {
    const session = await window.api.auth.login(input);
    if (revision === generation) publish(session);
  } catch (error) {
    if (revision === generation) publish(null);
    throw new Error(message(error));
  } finally {
    if (revision === generation) changingSession = false;
  }
}

async function setupAdmin(input: InitialAdminInput): Promise<void> {
  if (changingSession || state.status !== "setup-required")
    throw new Error(
      "La configuración inicial no está disponible. Vuelve a comprobar el acceso.",
    );
  const revision = ++generation;
  changingSession = true;
  try {
    const session = await window.api.auth.setupAdmin(input);
    if (revision === generation) publish(session);
  } catch (error) {
    if (revision === generation) {
      changingSession = false;
      await refreshAuth(true);
    }
    throw new Error(message(error));
  } finally {
    if (revision === generation) changingSession = false;
  }
}

async function logout(): Promise<void> {
  const revision = ++generation;
  changingSession = true;
  publish(null);
  try {
    await window.api.auth.logout();
    if (revision === generation) changingSession = false;
  } catch (error) {
    // Keep the application closed until another successful login.
    if (revision === generation) publish(null, message(error));
    throw new Error(message(error));
  }
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<void> {
  if (state.user?.role !== "admin") {
    throw new Error(
      "Solicita a un administrador que cambie tu contraseña en Personal y roles.",
    );
  }
  const revision = ++generation;
  changingSession = true;
  try {
    const session = await window.api.auth.changePassword(input);
    if (revision === generation) publish(session);
  } catch (error) {
    throw new Error(message(error));
  } finally {
    if (revision === generation) changingSession = false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  initialize();
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth() {
  const current = useSyncExternalStore(subscribe, () => state);
  const isAdmin = current.user?.role === "admin";
  return {
    ...current,
    isAdmin,
    hasPermission: (permission: PermissionKey) =>
      isAdmin || !!current.user?.permissions.includes(permission),
    login,
    setupAdmin,
    logout,
    refresh,
  };
}
