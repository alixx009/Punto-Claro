import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { compare, hash, hashSync } from "bcryptjs";
import {
  PERMISSIONS,
  USERNAME_RULES,
  INITIAL_ADMIN_PASSWORD_MIN_LENGTH,
  type AuthSession,
  type AuthUser,
  type ChangePasswordInput,
  type CreateUserInput,
  type LoginInput,
  type InitialAdminInput,
  type PermissionKey,
  type UpdateUserInput,
  type UserRole,
} from "../../shared/auth";
import { migrateAuth } from "../db/auth-migration";
import { loginAttemptKey } from "./login-attempts";
import { assertDataAvailable } from "../backup/state";

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = hashSync(randomUUID(), BCRYPT_COST);
const SESSION_DURATION_MS = 12 * 60 * 60 * 1_000;
const LOCK_DURATION_MS = 5 * 60 * 1_000;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_PARALLEL_LOGINS = 4;
const INVALID_LOGIN =
  "No se pudo iniciar sesión. Revisa tus datos o intenta de nuevo en unos minutos.";
const PERMISSION_KEYS = PERMISSIONS.map(({ key }) => key);

type BoundSession = {
  id: string;
  userId: string;
  expiresAt: string;
  lastSeenMs: number;
};
type UserRow = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  display_name: string;
  is_active: number;
  is_owner: number;
  role_key: UserRole;
  must_change_password: number;
};
type CredentialRow = { password_hash: string; must_change_password: number };
type AttemptRow = { failed_attempts: number; locked_until: string | null };

let authDatabase: Database.Database | null = null;
const sessions = new Map<number, BoundSession>();
const pendingLogins = new Map<number, symbol>();
const accountsInFlight = new Set<string>();
let setupInProgress = false;

function db(): Database.Database {
  if (!authDatabase)
    throw new Error("La autenticación todavía no está disponible.");
  return authDatabase;
}

function now(): string {
  return new Date().toISOString();
}

function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Los datos del usuario no son válidos.");
  }
  return value as Record<string, unknown>;
}

function validateEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Introduce un correo válido.");
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\u0000-\u001f\u007f]/.test(email)
  ) {
    throw new Error("Introduce un correo válido.");
  }
  return email;
}

function validateOptionalEmail(value: unknown): string | null {
  if (value == null || (typeof value === "string" && !value.trim()))
    return null;
  return validateEmail(value);
}

function validateUsername(value: unknown): string {
  const invalid = () =>
    new Error(
      "El nombre de usuario debe tener entre 3 y 30 caracteres, empezar con una letra o número y usar solo letras sin acentos, números, puntos, guiones o guion bajo.",
    );
  if (typeof value !== "string") throw invalid();
  const username = value.trim().toLowerCase();
  if (
    username.length < USERNAME_RULES.minLength ||
    username.length > USERNAME_RULES.maxLength ||
    !new RegExp(`^${USERNAME_RULES.pattern}$`, "u").test(username)
  ) {
    throw invalid();
  }
  return username;
}

function validateLoginIdentifier(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Introduce tu nombre de usuario o correo.");
  return value.includes("@") ? validateEmail(value) : validateUsername(value);
}

function findLoginUser(identifier: string): { id: string } | undefined {
  return db()
    .prepare(
      identifier.includes("@")
        ? "SELECT id FROM auth_users WHERE email = ? COLLATE NOCASE"
        : "SELECT id FROM auth_users WHERE username = ? COLLATE NOCASE",
    )
    .get(identifier) as { id: string } | undefined;
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 6 || value.includes("\0")) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  if (Buffer.byteLength(value, "utf8") > 72) {
    throw new Error("La contraseña excede el máximo de 72 bytes UTF-8.");
  }
  return value;
}

function validateName(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Introduce el nombre del usuario.");
  const name = value.trim();
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error("El nombre debe tener entre 1 y 120 caracteres.");
  }
  return name;
}

function validatePhone(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("El teléfono no es válido.");
  const phone = value.trim();
  if (!phone) return null;
  if (phone.length > 40 || !/^[+0-9\s().-]+$/.test(phone)) {
    throw new Error(
      "El teléfono debe tener un máximo de 40 caracteres y contener números.",
    );
  }
  return phone;
}

function validateRole(value: unknown): UserRole {
  if (value !== "admin" && value !== "cashier")
    throw new Error("El tipo de cuenta no es válido.");
  return value;
}

function validatePermissions(value: unknown): PermissionKey[] {
  if (
    !Array.isArray(value) ||
    value.length > PERMISSION_KEYS.length ||
    value.some(
      (key) =>
        typeof key !== "string" ||
        !PERMISSION_KEYS.includes(key as PermissionKey),
    )
  )
    throw new Error("La selección de permisos no es válida.");
  return [...new Set(value)] as PermissionKey[];
}

function validateBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} no es válido.`);
  return value;
}

function validateId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("El identificador de usuario no es válido.");
  }
  return value;
}

function getUser(id: string): AuthUser | null {
  const row = db()
    .prepare(
      `
    SELECT u.*, p.display_name, p.is_active, p.is_owner, r.role_key, c.must_change_password
    FROM auth_users u
    JOIN profiles p ON p.user_id = u.id
    JOIN user_roles r ON r.user_id = u.id
    JOIN auth_credentials c ON c.user_id = u.id
    WHERE u.id = ?
  `,
    )
    .get(id) as UserRow | undefined;
  if (!row) return null;
  const permissionRows = db()
    .prepare(
      `
    SELECT p.key FROM permissions p
    LEFT JOIN role_permissions rp ON rp.permission_key = p.key AND rp.role_key = ?
    LEFT JOIN user_permissions up ON up.permission_key = p.key AND up.user_id = ?
    WHERE COALESCE(up.is_allowed, CASE WHEN rp.permission_key IS NULL THEN 0 ELSE 1 END) = 1
  `,
    )
    .all(row.role_key, id) as { key: PermissionKey }[];
  const granted = new Set(permissionRows.map(({ key }) => key));
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSignInAt: row.last_sign_in_at,
    isActive: Boolean(row.is_active),
    isOwner: Boolean(row.is_owner),
    role: row.role_key,
    permissions:
      row.role_key === "admin"
        ? [...PERMISSION_KEYS]
        : PERMISSION_KEYS.filter((key) => granted.has(key)),
    mustChangePassword:
      row.role_key === "admin" && Boolean(row.must_change_password),
  };
}

function credentials(id: string): CredentialRow | undefined {
  return db()
    .prepare(
      "SELECT password_hash, must_change_password FROM auth_credentials WHERE user_id = ?",
    )
    .get(id) as CredentialRow | undefined;
}

function saveRoleAndPermissions(
  id: string,
  role: UserRole,
  keys: PermissionKey[],
): void {
  db()
    .prepare(
      `
    INSERT INTO user_roles (user_id, role_key) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET role_key = excluded.role_key
  `,
    )
    .run(id, role);
  const allowed = new Set(role === "admin" ? PERMISSION_KEYS : keys);
  const permission = db().prepare(`
    INSERT INTO user_permissions (user_id, permission_key, is_allowed) VALUES (?, ?, ?)
    ON CONFLICT(user_id, permission_key) DO UPDATE SET is_allowed = excluded.is_allowed
  `);
  for (const key of PERMISSION_KEYS)
    permission.run(id, key, Number(allowed.has(key)));
}

function assertEmailAvailable(email: string | null, exceptId?: string): void {
  if (email === null) return;
  const row = db()
    .prepare("SELECT id FROM auth_users WHERE email = ? COLLATE NOCASE")
    .get(email) as { id: string } | undefined;
  if (row && row.id !== exceptId)
    throw new Error("Ya existe un usuario con ese correo.");
}

function assertUsernameAvailable(username: string, exceptId?: string): void {
  const row = db()
    .prepare("SELECT id FROM auth_users WHERE username = ? COLLATE NOCASE")
    .get(username) as { id: string } | undefined;
  if (row && row.id !== exceptId)
    throw new Error("Ya existe un usuario con ese nombre de usuario.");
}

function assertActorIsAdmin(actorId: string): AuthUser {
  const actor = getUser(validateId(actorId));
  if (!actor?.isActive || actor.role !== "admin" || actor.mustChangePassword) {
    throw new Error(
      "AUTH_FORBIDDEN: Solo un administrador activo puede gestionar usuarios.",
    );
  }
  return actor;
}

function revokeUserSessions(id: string, exceptSessionId?: string): void {
  const timestamp = now();
  db()
    .prepare(
      `
    UPDATE auth_sessions SET revoked_at = ?
    WHERE user_id = ? AND revoked_at IS NULL AND (? IS NULL OR id != ?)
  `,
    )
    .run(timestamp, id, exceptSessionId ?? null, exceptSessionId ?? null);
}

export function isInitialSetupRequired(): boolean {
  return Boolean(
    db()
      .prepare(
        `
    SELECT 1 FROM auth_installation
    WHERE id = 1 AND setup_completed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM auth_users)
  `,
      )
      .get(),
  );
}

function assertInitialSetupRequired(): void {
  if (!isInitialSetupRequired())
    throw new Error(
      "La configuración inicial ya está completada. Inicia sesión con una cuenta existente.",
    );
}

/** Persist inside the caller's transaction; bind to the window only after commit. */
function persistSession(senderId: number, userId: string): AuthSession {
  const timestamp = now();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const previous = sessions.get(senderId);
  if (previous)
    db()
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?")
      .run(timestamp, previous.id);
  db()
    .prepare(
      "INSERT INTO auth_sessions (id, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, userId, timestamp, timestamp, expiresAt);
  db()
    .prepare(
      "UPDATE auth_users SET last_sign_in_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(timestamp, timestamp, userId);
  const user = getUser(userId);
  if (!user) throw new Error("No se pudo crear la sesión del usuario.");
  return { id, user, expiresAt };
}

function bindSession(senderId: number, session: AuthSession): void {
  sessions.set(senderId, {
    id: session.id,
    userId: session.user.id,
    expiresAt: session.expiresAt,
    lastSeenMs: Date.now(),
  });
}

export async function setupInitialAdmin(
  senderId: number,
  input: InitialAdminInput,
  assertAllowed: () => void,
): Promise<AuthSession> {
  assertAllowed();
  assertInitialSetupRequired();
  if (setupInProgress)
    throw new Error(
      "La configuración inicial está en proceso. Espera a que termine.",
    );
  const values = objectInput(input);
  const displayName = validateName(values.displayName);
  const username = validateUsername(values.username);
  const email = validateOptionalEmail(values.email);
  const password = validatePassword(values.password);
  if (password.length < INITIAL_ADMIN_PASSWORD_MIN_LENGTH)
    throw new Error(
      `La contraseña del administrador debe tener al menos ${INITIAL_ADMIN_PASSWORD_MIN_LENGTH} caracteres.`,
    );
  if (password !== values.passwordConfirmation)
    throw new Error("Las contraseñas no coinciden.");
  if (values.credentialsAcknowledged !== true)
    throw new Error(
      "Confirma que guardaste tus credenciales antes de continuar.",
    );
  setupInProgress = true;
  try {
    const passwordHash = await hash(password, BCRYPT_COST);
    const session = db()
      .transaction(() => {
        assertAllowed();
        assertInitialSetupRequired();
        const id = randomUUID();
        const timestamp = now();
        db()
          .prepare(
            "INSERT INTO auth_users (id, username, email, phone, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)",
          )
          .run(id, username, email, timestamp, timestamp);
        db()
          .prepare(
            "INSERT INTO profiles (user_id, display_name, is_active, is_owner) VALUES (?, ?, 1, 1)",
          )
          .run(id, displayName);
        db()
          .prepare(
            "INSERT INTO auth_credentials (user_id, password_hash, password_changed_at, must_change_password) VALUES (?, ?, ?, 0)",
          )
          .run(id, passwordHash, timestamp);
        saveRoleAndPermissions(id, "admin", [...PERMISSION_KEYS]);
        db()
          .prepare(
            "UPDATE auth_installation SET setup_completed_at = ? WHERE id = 1",
          )
          .run(timestamp);
        return persistSession(senderId, id);
      })
      .immediate();
    bindSession(senderId, session);
    return session;
  } finally {
    setupInProgress = false;
  }
}

/** Called once after opening the POS database, before registering its IPC handlers. */
export function initializeAuth(database: Database.Database): void {
  migrateAuth(database);
  authDatabase = database;
  sessions.clear();
  pendingLogins.clear();
  accountsInFlight.clear();
  database
    .transaction(() => {
      const insertRole = database.prepare(
        "INSERT INTO roles (key, display_name) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
      );
      insertRole.run("admin", "Administrador global");
      insertRole.run("cashier", "Cajero principal");
      const insertPermission = database.prepare(
        "INSERT INTO permissions (key, display_name) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET display_name = excluded.display_name",
      );
      const grantRole = database.prepare(
        "INSERT INTO role_permissions (role_key, permission_key) VALUES (?, ?) ON CONFLICT DO NOTHING",
      );
      for (const permission of PERMISSIONS) {
        insertPermission.run(permission.key, permission.label);
        grantRole.run("admin", permission.key);
      }
      // Main-process memory is the authority: persisted sessions are never restored after a restart.
      database
        .prepare(
          "UPDATE auth_sessions SET revoked_at = ? WHERE revoked_at IS NULL",
        )
        .run(now());
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1_000,
      ).toISOString();
      database
        .prepare("DELETE FROM auth_sessions WHERE expires_at < ?")
        .run(thirtyDaysAgo);
      const oldAttempts = new Date(
        Date.now() - 24 * 60 * 60 * 1_000,
      ).toISOString();
      database
        .prepare("DELETE FROM auth_login_attempts WHERE last_attempt_at < ?")
        .run(oldAttempts);
    })
    .immediate();
}

export function getCurrentAuthSession(senderId: number): AuthSession | null {
  const bound = sessions.get(senderId);
  if (!bound) return null;
  const record = db()
    .prepare(
      "SELECT revoked_at, expires_at FROM auth_sessions WHERE id = ? AND user_id = ?",
    )
    .get(bound.id, bound.userId) as
    { revoked_at: string | null; expires_at: string } | undefined;
  const user = getUser(bound.userId);
  const expiresMs = record ? Date.parse(record.expires_at) : NaN;
  if (
    !record ||
    record.revoked_at ||
    !Number.isFinite(expiresMs) ||
    expiresMs <= Date.now() ||
    !user?.isActive
  ) {
    logout(senderId);
    return null;
  }
  if (Date.now() - bound.lastSeenMs > 60_000) {
    db()
      .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?")
      .run(now(), bound.id);
    bound.lastSeenMs = Date.now();
  }
  return { id: bound.id, user, expiresAt: record.expires_at };
}

/** Restore invalidates every window, including async authentication operations. */
export function clearAuthAfterRestore(): void {
  sessions.clear();
  pendingLogins.clear();
  accountsInFlight.clear();
}

export function requireUser(senderId: number): AuthUser {
  const session = getCurrentAuthSession(senderId);
  if (!session) throw new Error("AUTH_REQUIRED: Inicia sesión para continuar.");
  if (session.user.mustChangePassword)
    throw new Error(
      "PASSWORD_CHANGE_REQUIRED: Cambia tu contraseña para continuar.",
    );
  return session.user;
}

export function requireAdmin(senderId: number): AuthUser {
  const user = requireUser(senderId);
  if (user.role !== "admin")
    throw new Error(
      "AUTH_FORBIDDEN: Esta operación requiere una cuenta de administrador.",
    );
  return user;
}

export function requirePermission(
  senderId: number,
  key: PermissionKey,
): AuthUser {
  const user = requireUser(senderId);
  if (!PERMISSION_KEYS.includes(key) || !user.permissions.includes(key)) {
    throw new Error(
      "AUTH_FORBIDDEN: Tu cuenta no tiene permiso para esta operación.",
    );
  }
  return user;
}

export function logout(senderId: number): void {
  pendingLogins.delete(senderId);
  const session = sessions.get(senderId);
  if (session) {
    db()
      .prepare(
        "UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?",
      )
      .run(now(), session.id);
    sessions.delete(senderId);
  }
}

function recordFailedAttempt(identifierKey: string): void {
  db()
    .transaction(() => {
      const previous = db()
        .prepare(
          "SELECT failed_attempts, locked_until FROM auth_login_attempts WHERE identifier_key = ?",
        )
        .get(identifierKey) as AttemptRow | undefined;
      const reset =
        previous?.locked_until &&
        Date.parse(previous.locked_until) <= Date.now();
      const count = Math.min(
        MAX_FAILED_ATTEMPTS,
        (reset ? 0 : (previous?.failed_attempts ?? 0)) + 1,
      );
      const lockedUntil =
        count === MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
          : null;
      db()
        .prepare(
          `
      INSERT INTO auth_login_attempts (identifier_key, failed_attempts, last_attempt_at, locked_until) VALUES (?, ?, ?, ?)
      ON CONFLICT(identifier_key) DO UPDATE SET failed_attempts = excluded.failed_attempts,
        last_attempt_at = excluded.last_attempt_at, locked_until = excluded.locked_until
    `,
        )
        .run(identifierKey, count, now(), lockedUntil);
    })
    .immediate();
}

export async function login(
  senderId: number,
  input: LoginInput,
): Promise<AuthSession> {
  const values = objectInput(input);
  const identifier = validateLoginIdentifier(values.identifier);
  const password = validatePassword(values.password);
  const existing = findLoginUser(identifier);
  const identifierKey = loginAttemptKey(identifier, existing?.id);
  if (
    pendingLogins.has(senderId) ||
    accountsInFlight.has(identifierKey) ||
    accountsInFlight.size >= MAX_PARALLEL_LOGINS
  ) {
    throw new Error(INVALID_LOGIN);
  }
  const token = Symbol("login");
  pendingLogins.set(senderId, token);
  accountsInFlight.add(identifierKey);
  try {
    const attempts = db()
      .prepare(
        "SELECT failed_attempts, locked_until FROM auth_login_attempts WHERE identifier_key = ?",
      )
      .get(identifierKey) as AttemptRow | undefined;
    const locked = Boolean(
      attempts?.locked_until && Date.parse(attempts.locked_until) > Date.now(),
    );
    const user = existing ? getUser(existing.id) : null;
    const credential = existing ? credentials(existing.id) : undefined;
    const matches = await compare(
      password,
      !locked && user?.isActive && credential
        ? credential.password_hash
        : DUMMY_PASSWORD_HASH,
    );
    if (pendingLogins.get(senderId) !== token)
      throw new Error("El inicio de sesión fue cancelado.");
    assertDataAvailable();
    if (locked) throw new Error(INVALID_LOGIN);
    const freshUser = existing ? getUser(existing.id) : null;
    const freshCredential = existing ? credentials(existing.id) : undefined;
    if (
      !matches ||
      !freshUser?.isActive ||
      findLoginUser(identifier)?.id !== freshUser.id ||
      !credential ||
      freshCredential?.password_hash !== credential.password_hash
    ) {
      recordFailedAttempt(identifierKey);
      throw new Error(INVALID_LOGIN);
    }
    const session = db()
      .transaction(() => {
        const created = persistSession(senderId, freshUser.id);
        db()
          .prepare("DELETE FROM auth_login_attempts WHERE identifier_key = ?")
          .run(identifierKey);
        return created;
      })
      .immediate();
    bindSession(senderId, session);
    return session;
  } finally {
    if (pendingLogins.get(senderId) === token) pendingLogins.delete(senderId);
    accountsInFlight.delete(identifierKey);
  }
}

export function listUsers(): AuthUser[] {
  const rows = db()
    .prepare(
      `
    SELECT u.id FROM auth_users u JOIN profiles p ON p.user_id = u.id
    ORDER BY p.is_owner DESC, p.is_active DESC, p.display_name COLLATE NOCASE, u.id
  `,
    )
    .all() as { id: string }[];
  return rows
    .map(({ id }) => getUser(id))
    .filter((user): user is AuthUser => user !== null);
}

export async function createUser(
  input: CreateUserInput,
  actorId?: string,
  authorizeSession?: () => void,
): Promise<AuthUser> {
  const values = objectInput(input);
  const displayName = validateName(values.displayName);
  const username = validateUsername(values.username);
  const email = validateOptionalEmail(values.email);
  const phone = validatePhone(values.phone);
  const password = validatePassword(values.password);
  const role = validateRole(values.role);
  const permissions = validatePermissions(values.permissions);
  const mustChangePassword = validateBoolean(
    values.mustChangePassword,
    "La opción de cambio de contraseña",
  );
  if (actorId) assertActorIsAdmin(actorId);
  assertUsernameAvailable(username);
  assertEmailAvailable(email);
  const passwordHash = await hash(password, BCRYPT_COST);
  assertDataAvailable();
  return db()
    .transaction(() => {
      authorizeSession?.();
      if (actorId) assertActorIsAdmin(actorId);
      assertUsernameAvailable(username);
      assertEmailAvailable(email);
      const id = randomUUID();
      const timestamp = now();
      db()
        .prepare(
          "INSERT INTO auth_users (id, username, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(id, username, email, phone, timestamp, timestamp);
      db()
        .prepare("INSERT INTO profiles (user_id, display_name) VALUES (?, ?)")
        .run(id, displayName);
      db()
        .prepare(
          "INSERT INTO auth_credentials (user_id, password_hash, password_changed_at, must_change_password) VALUES (?, ?, ?, ?)",
        )
        .run(
          id,
          passwordHash,
          timestamp,
          Number(role === "admin" && mustChangePassword),
        );
      saveRoleAndPermissions(id, role, permissions);
      return getUser(id)!;
    })
    .immediate();
}

export async function updateUser(
  actorId: string,
  id: string,
  input: UpdateUserInput,
  authorizeSession?: () => void,
): Promise<AuthUser> {
  assertActorIsAdmin(actorId);
  validateId(id);
  const values = objectInput(input);
  const displayName = validateName(values.displayName);
  const username = validateUsername(values.username);
  const email = validateOptionalEmail(values.email);
  const phone = validatePhone(values.phone);
  const role = validateRole(values.role);
  const permissions = validatePermissions(values.permissions);
  const isActive = validateBoolean(values.isActive, "El estado de la cuenta");
  const password =
    values.password === undefined
      ? undefined
      : validatePassword(values.password);
  const mustChangePassword =
    values.mustChangePassword === undefined
      ? undefined
      : validateBoolean(
          values.mustChangePassword,
          "La opción de cambio de contraseña",
        );
  assertUsernameAvailable(username, id);
  assertEmailAvailable(email, id);
  const passwordHash =
    password === undefined ? undefined : await hash(password, BCRYPT_COST);
  assertDataAvailable();
  const updated = db()
    .transaction(() => {
      authorizeSession?.();
      assertActorIsAdmin(actorId);
      const current = getUser(id);
      if (!current) throw new Error("El usuario ya no existe.");
      if (current.isOwner && actorId !== id)
        throw new Error(
          "Solo el administrador principal puede modificar su propia cuenta.",
        );
      if (current.isOwner && (role !== "admin" || !isActive))
        throw new Error(
          "El administrador principal debe permanecer activo y conservar su rol.",
        );
      if (actorId === id && !isActive)
        throw new Error(
          "No puedes desactivar la cuenta con la que tienes la sesión iniciada.",
        );
      if (
        current.isActive &&
        current.role === "admin" &&
        (!isActive || role !== "admin")
      ) {
        const activeAdmins = db()
          .prepare(
            `
        SELECT COUNT(*) AS count FROM user_roles r JOIN profiles p ON p.user_id = r.user_id
        WHERE r.role_key = 'admin' AND p.is_active = 1
      `,
          )
          .get() as { count: number };
        if (activeAdmins.count <= 1)
          throw new Error("Debe permanecer al menos un administrador activo.");
      }
      assertUsernameAvailable(username, id);
      assertEmailAvailable(email, id);
      const timestamp = now();
      db()
        .prepare(
          "UPDATE auth_users SET username = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?",
        )
        .run(username, email, phone, timestamp, id);
      db()
        .prepare(
          "UPDATE profiles SET display_name = ?, is_active = ? WHERE user_id = ?",
        )
        .run(displayName, Number(isActive), id);
      saveRoleAndPermissions(id, role, permissions);
      if (passwordHash !== undefined) {
        db()
          .prepare(
            "UPDATE auth_credentials SET password_hash = ?, password_changed_at = ?, must_change_password = ? WHERE user_id = ?",
          )
          .run(
            passwordHash,
            timestamp,
            Number(role === "admin" && (mustChangePassword ?? true)),
            id,
          );
        db()
          .prepare("DELETE FROM auth_login_attempts WHERE identifier_key = ?")
          .run(loginAttemptKey(username, id));
      } else if (role === "cashier" || mustChangePassword !== undefined) {
        db()
          .prepare(
            "UPDATE auth_credentials SET must_change_password = ? WHERE user_id = ?",
          )
          .run(Number(role === "admin" && mustChangePassword), id);
      }
      if (!isActive || passwordHash !== undefined) {
        db()
          .prepare(
            "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
          )
          .run(timestamp, id);
      }
      return getUser(id)!;
    })
    .immediate();
  if (!updated.isActive || passwordHash !== undefined) {
    for (const [senderId, session] of sessions)
      if (session.userId === id) sessions.delete(senderId);
  }
  return updated;
}

export async function changePassword(
  senderId: number,
  input: ChangePasswordInput,
): Promise<AuthSession> {
  const session = getCurrentAuthSession(senderId);
  if (!session)
    throw new Error("AUTH_REQUIRED: Inicia sesión para cambiar tu contraseña.");
  if (session.user.role !== "admin")
    throw new Error(
      "AUTH_FORBIDDEN: Solo un administrador puede cambiar tu contraseña. Solicita el cambio en Personal y roles.",
    );
  const values = objectInput(input);
  const currentPassword = validatePassword(values.currentPassword);
  const newPassword = validatePassword(values.newPassword);
  if (currentPassword === newPassword)
    throw new Error("Elige una contraseña diferente de la actual.");
  const previous = credentials(session.user.id);
  if (!previous || !(await compare(currentPassword, previous.password_hash)))
    throw new Error("La contraseña actual no es correcta.");
  const passwordHash = await hash(newPassword, BCRYPT_COST);
  assertDataAvailable();
  const updated = db()
    .transaction(() => {
      const fresh = getCurrentAuthSession(senderId);
      if (!fresh || fresh.id !== session.id)
        throw new Error(
          "AUTH_REQUIRED: La sesión cambió. Inicia sesión de nuevo.",
        );
      if (fresh.user.role !== "admin")
        throw new Error(
          "AUTH_FORBIDDEN: Solo los administradores pueden cambiar contraseñas.",
        );
      if (
        credentials(session.user.id)?.password_hash !== previous.password_hash
      )
        throw new Error(
          "La contraseña cambió durante la operación. Inténtalo de nuevo.",
        );
      const timestamp = now();
      db()
        .prepare(
          "UPDATE auth_credentials SET password_hash = ?, password_changed_at = ?, must_change_password = 0 WHERE user_id = ?",
        )
        .run(passwordHash, timestamp, session.user.id);
      db()
        .prepare("UPDATE auth_users SET updated_at = ? WHERE id = ?")
        .run(timestamp, session.user.id);
      revokeUserSessions(session.user.id, session.id);
      return { ...fresh, user: getUser(session.user.id)! };
    })
    .immediate();
  for (const [otherSenderId, bound] of sessions) {
    if (bound.userId === session.user.id && bound.id !== session.id)
      sessions.delete(otherSenderId);
  }
  return updated;
}
