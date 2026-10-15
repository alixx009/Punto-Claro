export const PERMISSIONS = [
  { key: "stock.inspect", label: "Inspeccionar stock de almacén" },
  { key: "costs.view", label: "Ver precios de costo" },
  { key: "discounts.apply", label: "Aplicar descuentos" },
  { key: "reports.view", label: "Consultar reportes" },
  { key: "cash.adjust", label: "Realizar ajustes de caja" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type UserRole = "admin" | "cashier";

export const USERNAME_RULES = {
  minLength: 3,
  maxLength: 30,
  pattern: "[A-Za-z0-9][A-Za-z0-9._\\x2D]*",
} as const;

export interface OperationActor {
  id: string;
  displayName: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string | null;
  isActive: boolean;
  isOwner: boolean;
  role: UserRole;
  permissions: PermissionKey[];
  mustChangePassword: boolean;
}

export interface AuthSession {
  id: string;
  user: AuthUser;
  expiresAt: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface InitialAdminInput {
  displayName: string;
  username: string;
  email?: string | null;
  password: string;
  passwordConfirmation: string;
  credentialsAcknowledged: boolean;
}

export const INITIAL_ADMIN_PASSWORD_MIN_LENGTH = 8;

export interface CreateUserInput {
  displayName: string;
  username: string;
  email?: string | null;
  phone: string | null;
  password: string;
  role: UserRole;
  permissions: PermissionKey[];
  mustChangePassword: boolean;
}

export interface UpdateUserInput {
  displayName: string;
  username: string;
  email?: string | null;
  phone: string | null;
  role: UserRole;
  permissions: PermissionKey[];
  isActive: boolean;
  password?: string;
  mustChangePassword?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthApi {
  current: () => Promise<AuthSession | null>;
  setupRequired: () => Promise<boolean>;
  setupAdmin: (input: InitialAdminInput) => Promise<AuthSession>;
  login: (input: LoginInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<AuthSession>;
}

export interface UsersApi {
  list: () => Promise<AuthUser[]>;
  create: (input: CreateUserInput) => Promise<AuthUser>;
  update: (id: string, input: UpdateUserInput) => Promise<AuthUser>;
}

export const AUTH_CHANNELS = {
  current: "auth:current",
  setupRequired: "auth:setup-required",
  setupAdmin: "auth:setup-admin",
  login: "auth:login",
  logout: "auth:logout",
  changePassword: "auth:change-password",
  usersList: "users:list",
  usersCreate: "users:create",
  usersUpdate: "users:update",
} as const;
