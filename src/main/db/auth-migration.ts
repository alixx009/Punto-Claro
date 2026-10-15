import type Database from "better-sqlite3";
import { USERNAME_RULES } from "../../shared/auth";
import { loginAttemptKey } from "../auth/login-attempts";

const AUTH_SCHEMA_V1 = `
  CREATE TABLE auth_users (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
    phone TEXT CHECK (phone IS NULL OR length(phone) <= 40),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_sign_in_at TEXT
  );
  CREATE TABLE profiles (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1))
  );
  CREATE UNIQUE INDEX idx_profiles_owner ON profiles(is_owner) WHERE is_owner = 1;
  CREATE TABLE auth_credentials (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_changed_at TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1))
  );
  CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id, revoked_at);
  CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
  CREATE TABLE roles (
    key TEXT PRIMARY KEY NOT NULL CHECK (key IN ('admin', 'cashier')),
    display_name TEXT NOT NULL
  );
  CREATE TABLE permissions (
    key TEXT PRIMARY KEY NOT NULL CHECK (key IN (
      'stock.inspect', 'costs.view', 'discounts.apply', 'reports.view', 'cash.adjust'
    )),
    display_name TEXT NOT NULL
  );
  CREATE TABLE role_permissions (
    role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    PRIMARY KEY (role_key, permission_key)
  );
  CREATE TABLE user_roles (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE RESTRICT
  );
  CREATE INDEX idx_user_roles_role ON user_roles(role_key, user_id);
  CREATE TABLE user_permissions (
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    is_allowed INTEGER NOT NULL CHECK (is_allowed IN (0, 1)),
    PRIMARY KEY (user_id, permission_key)
  );
  CREATE TABLE auth_login_attempts (
    email_key TEXT PRIMARY KEY NOT NULL,
    failed_attempts INTEGER NOT NULL CHECK (failed_attempts BETWEEN 1 AND 5),
    last_attempt_at TEXT NOT NULL,
    locked_until TEXT
  );
  CREATE INDEX idx_auth_login_attempts_date ON auth_login_attempts(last_attempt_at);
  CREATE TRIGGER profiles_protect_owner_update
    BEFORE UPDATE OF is_owner, is_active ON profiles
    WHEN OLD.is_owner = 1 AND (NEW.is_owner != 1 OR NEW.is_active != 1)
    BEGIN SELECT RAISE(ABORT, 'Cannot disable the primary administrator'); END;
  CREATE TRIGGER profiles_protect_owner_delete
    BEFORE DELETE ON profiles WHEN OLD.is_owner = 1
    BEGIN SELECT RAISE(ABORT, 'Cannot delete the primary administrator'); END;
  CREATE TRIGGER user_roles_protect_owner_update
    BEFORE UPDATE OF role_key ON user_roles
    WHEN NEW.role_key != 'admin' AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = OLD.user_id AND is_owner = 1
    )
    BEGIN SELECT RAISE(ABORT, 'Cannot demote the primary administrator'); END;
  CREATE TRIGGER user_roles_protect_owner_delete
    BEFORE DELETE ON user_roles
    WHEN EXISTS (SELECT 1 FROM profiles WHERE user_id = OLD.user_id AND is_owner = 1)
    BEGIN SELECT RAISE(ABORT, 'Cannot remove the primary administrator role'); END;
`;

type ExistingUser = {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
};

function generatedUsername(user: ExistingUser, used: Set<string>): string {
  const base = [user.display_name ?? "", user.email.split("@")[0], "usuario"]
    .map((name) =>
      name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, USERNAME_RULES.maxLength)
        .replace(/\.+$/g, ""),
    )
    .find((name) => name.length >= USERNAME_RULES.minLength)!;
  let username = base;
  let suffix = 2;
  while (used.has(username)) {
    const ending = `.${suffix++}`;
    username = `${base.slice(0, USERNAME_RULES.maxLength - ending.length).replace(/\.+$/g, "")}${ending}`;
  }
  used.add(username);
  return username;
}

function migrateUsernames(database: Database.Database): void {
  const applied = () =>
    database
      .prepare("SELECT version FROM auth_schema_migrations WHERE version = ?")
      .get(3);
  if (applied()) return;
  if (database.inTransaction) {
    throw new Error(
      "La migración de nombres de usuario requiere una transacción independiente.",
    );
  }
  // Foreign keys must be suspended BEFORE the transaction so rebuilding the
  // parent table cannot cascade-delete credentials, profiles or business records.
  const foreignKeysEnabled = Boolean(
    database.pragma("foreign_keys", { simple: true }),
  );
  database.pragma("foreign_keys = OFF");
  try {
    database
      .transaction(() => {
        if (applied()) return;
        const users = database
          .prepare(
            `
        SELECT u.*, p.display_name FROM auth_users u
        LEFT JOIN profiles p ON p.user_id = u.id
        ORDER BY p.is_owner DESC, u.created_at, u.id
      `,
          )
          .all() as ExistingUser[];
        database.exec(`
        CREATE TABLE auth_users_with_username (
          id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
          username TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (
            length(username) BETWEEN ${USERNAME_RULES.minLength} AND ${USERNAME_RULES.maxLength}
            AND username NOT GLOB '*[^a-z0-9._-]*'
            AND username GLOB '[a-z0-9]*'
          ),
          email TEXT COLLATE NOCASE UNIQUE CHECK (email IS NULL OR length(email) BETWEEN 3 AND 254),
          phone TEXT CHECK (phone IS NULL OR length(phone) <= 40),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_sign_in_at TEXT
        );
        ALTER TABLE auth_login_attempts RENAME COLUMN email_key TO identifier_key;
      `);
        const insert = database.prepare(`
        INSERT INTO auth_users_with_username
          (id, username, email, phone, created_at, updated_at, last_sign_in_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
        const moveAttempts = database.prepare(`
        UPDATE auth_login_attempts SET identifier_key = ? WHERE identifier_key = ?
      `);
        const used = new Set<string>();
        for (const user of users) {
          insert.run(
            user.id,
            generatedUsername(user, used),
            user.email,
            user.phone,
            user.created_at,
            user.updated_at,
            user.last_sign_in_at,
          );
          moveAttempts.run(
            loginAttemptKey(user.email, user.id),
            loginAttemptKey(user.email),
          );
        }
        database.exec(`
        DROP TABLE auth_users;
        ALTER TABLE auth_users_with_username RENAME TO auth_users;
      `);
        if (database.pragma("foreign_key_check").length) {
          throw new Error(
            "No se pudo actualizar los usuarios: referencias inválidas.",
          );
        }
        database
          .prepare(
            `
        INSERT INTO auth_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)
      `,
          )
          .run(
            3,
            "required_username_and_optional_email",
            new Date().toISOString(),
          );
      })
      .immediate();
  } finally {
    database.pragma(`foreign_keys = ${foreignKeysEnabled ? "ON" : "OFF"}`);
  }
}

/** Transactionally versioned migrations; UUIDs and existing POS data are preserved. */
export function migrateAuth(database: Database.Database): void {
  database
    .transaction(() => {
      database.exec(`
      CREATE TABLE IF NOT EXISTS auth_schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
      const applied = database
        .prepare("SELECT version FROM auth_schema_migrations WHERE version = ?")
        .get(1);
      if (!applied) {
        database.exec(AUTH_SCHEMA_V1);
        database
          .prepare(
            "INSERT INTO auth_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
          )
          .run(
            1,
            "local_authentication_and_permissions",
            new Date().toISOString(),
          );
      }
      const passwordPolicyApplied = database
        .prepare("SELECT version FROM auth_schema_migrations WHERE version = ?")
        .get(2);
      if (!passwordPolicyApplied) {
        database
          .prepare(
            `UPDATE auth_credentials SET must_change_password = 0
          WHERE user_id IN (SELECT user_id FROM user_roles WHERE role_key = 'cashier')`,
          )
          .run();
        database
          .prepare(
            "INSERT INTO auth_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
          )
          .run(
            2,
            "cashier_passwords_managed_by_administrators",
            new Date().toISOString(),
          );
      }
      if (database.pragma("foreign_key_check").length) {
        throw new Error(
          "No se pudo completar la migración de usuarios: referencias inválidas.",
        );
      }
    })
    .immediate();
  migrateUsernames(database);
  database
    .transaction(() => {
      if (
        database
          .prepare("SELECT 1 FROM auth_schema_migrations WHERE version = ?")
          .get(4)
      )
        return;
      database.exec(`
      CREATE TABLE auth_installation (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        setup_completed_at TEXT
      );
    `);
      const existing = database
        .prepare("SELECT 1 FROM auth_users LIMIT 1")
        .get();
      const timestamp = new Date().toISOString();
      database
        .prepare(
          "INSERT INTO auth_installation (id, setup_completed_at) VALUES (1, ?)",
        )
        .run(existing ? timestamp : null);
      database
        .prepare(
          "INSERT INTO auth_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        )
        .run(4, "initial_administrator_setup", timestamp);
    })
    .immediate();
}
