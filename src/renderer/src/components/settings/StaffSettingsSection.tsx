import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Settings2, Users } from "lucide-react";
import {
  PERMISSIONS,
  USERNAME_RULES,
  type AuthUser,
  type PermissionKey,
  type UserRole,
} from "../../../../shared/auth";
import { useAuth } from "@/auth/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      )
    : "No se pudo guardar el usuario.";
}

function dateLabel(value: string | null) {
  if (!value) return "Sin acceso registrado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

interface UserEditorProps {
  user: AuthUser | null;
  onClose: () => void;
  onSaved: (user: AuthUser) => Promise<void>;
}

function UserEditor({ user, onClose, onSaved }: UserEditorProps) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "cashier");
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    user?.permissions ?? ["stock.inspect"],
  );
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [mustChangePassword, setMustChangePassword] = useState(
    user?.mustChangePassword ?? true,
  );
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const admin = role === "admin";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    const common = {
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      role,
      permissions: admin
        ? PERMISSIONS.map((permission) => permission.key)
        : permissions,
    };
    try {
      const saved = user
        ? await window.api.users.update(user.id, {
            ...common,
            isActive,
            ...(password
              ? { password, mustChangePassword: admin && mustChangePassword }
              : {}),
            ...(!admin ? { mustChangePassword: false } : {}),
          })
        : await window.api.users.create({
            ...common,
            password,
            mustChangePassword: admin && mustChangePassword,
          });
      setPassword("");
      await onSaved(saved);
    } catch (failure) {
      setPassword("");
      setError(errorMessage(failure));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          setPassword("");
          onClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {user ? "Editar operador" : "Nuevo operador"}
          </DialogTitle>
          <DialogDescription>
            {user
              ? "Actualiza su cuenta, acceso y permisos. El historial de operaciones se conserva."
              : "Crea una cuenta de cajero o administrador para ingresar al punto de venta."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="staff-name">Nombre completo</FieldLabel>
              <Input
                id="staff-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                maxLength={120}
                autoComplete="off"
                disabled={pending}
                autoFocus
              />
              <FieldDescription>
                Nombre del cajero que se muestra en la aplicación y los tickets.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="staff-username">
                Nombre de usuario
              </FieldLabel>
              <Input
                id="staff-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={USERNAME_RULES.minLength}
                maxLength={USERNAME_RULES.maxLength}
                pattern={USERNAME_RULES.pattern}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={pending}
                aria-describedby="staff-username-help"
              />
              <FieldDescription id="staff-username-help">
                Único, de 3 a 30 caracteres. Empieza con una letra o número;
                admite letras sin acentos, números, puntos, guiones y guion
                bajo. Se guarda en minúsculas.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="staff-email">
                Correo electrónico (opcional)
              </FieldLabel>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="off"
                disabled={pending}
              />
              <FieldDescription>
                Si lo agregas, también permite iniciar sesión.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="staff-phone">Teléfono (opcional)</FieldLabel>
              <Input
                id="staff-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={30}
                autoComplete="off"
                disabled={pending}
              />
            </Field>
            <Field data-disabled={pending || user?.isOwner}>
              <FieldLabel htmlFor="staff-role">Tipo de cuenta</FieldLabel>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as UserRole)}
                disabled={pending || user?.isOwner}
              >
                <SelectTrigger id="staff-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="cashier">Cajero principal</SelectItem>
                    <SelectItem value="admin">Administrador global</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {user?.isOwner ? (
                <FieldDescription>
                  La cuenta principal conserva su rol de administrador.
                </FieldDescription>
              ) : null}
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="staff-password">
                {user
                  ? "Restablecer contraseña (opcional)"
                  : "Contraseña inicial"}
              </FieldLabel>
              <Input
                id="staff-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (user && !password && admin) setMustChangePassword(true);
                }}
                required={!user}
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                disabled={pending}
                placeholder={
                  user
                    ? "Déjala vacía para conservar la actual"
                    : "Mínimo 6 caracteres"
                }
              />
              <FieldDescription>
                {user
                  ? "Al establecer una contraseña nueva, se cerrarán las sesiones de este usuario."
                  : admin
                    ? "El administrador podrá cambiar su contraseña desde Mi cuenta."
                    : "La contraseña del cajero solo puede cambiarla un administrador desde esta sección."}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <FieldSet>
            <FieldLegend>Matriz de permisos</FieldLegend>
            <FieldDescription>
              {admin
                ? "Los administradores tienen todos los permisos habilitados."
                : "Selecciona los permisos específicos para este cajero."}
            </FieldDescription>
            <FieldGroup className="gap-3">
              {PERMISSIONS.map(({ key, label }) => (
                <Field
                  key={key}
                  orientation="horizontal"
                  className="rounded-lg border p-3"
                  data-disabled={pending || admin}
                >
                  <FieldContent className="min-w-0">
                    <FieldLabel htmlFor={`staff-permission-${key}`}>
                      {label}
                    </FieldLabel>
                  </FieldContent>
                  <Switch
                    id={`staff-permission-${key}`}
                    checked={admin || permissions.includes(key)}
                    disabled={pending || admin}
                    onCheckedChange={(checked) =>
                      setPermissions((current) =>
                        checked
                          ? [
                              ...current.filter(
                                (permission) => permission !== key,
                              ),
                              key,
                            ]
                          : current.filter((permission) => permission !== key),
                      )
                    }
                  />
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
          <FieldGroup className="gap-3">
            {admin && (!user || !!password) ? (
              <Field orientation="horizontal">
                <FieldContent className="min-w-0">
                  <FieldLabel htmlFor="staff-change-password">
                    Solicitar cambio de contraseña al ingresar
                  </FieldLabel>
                  <FieldDescription>
                    El operador deberá establecer su contraseña antes de usar la
                    aplicación.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="staff-change-password"
                  checked={mustChangePassword}
                  onCheckedChange={setMustChangePassword}
                  disabled={pending}
                />
              </Field>
            ) : null}
            {user ? (
              <Field
                orientation="horizontal"
                data-disabled={pending || user.isOwner}
              >
                <FieldContent className="min-w-0">
                  <FieldLabel htmlFor="staff-active">Cuenta activa</FieldLabel>
                  <FieldDescription>
                    {user.isOwner
                      ? "La cuenta principal siempre permanece activa."
                      : "Al desactivarla, se bloquea el acceso y se cierran sus sesiones."}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="staff-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={pending || user.isOwner}
                />
              </Field>
            ) : null}
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se guardó el operador</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setPassword("");
                onClose();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Guardando…"
                : user
                  ? "Guardar cambios"
                  : "Crear operador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffSettingsSection() {
  const { refresh, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ user: AuthUser | null } | null>(null);
  const revision = useRef(0);

  async function load() {
    const request = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const data = await window.api.users.list();
      if (request === revision.current) setUsers(data);
    } catch (failure) {
      if (request === revision.current) setError(errorMessage(failure));
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      ++revision.current;
    };
  }, []);

  async function saved(user: AuthUser) {
    setUsers((current) => [
      ...current.filter((item) => item.id !== user.id),
      user,
    ]);
    setFeedback(`La cuenta de ${user.displayName} se guardó correctamente.`);
    setEditor(null);
    await refresh();
  }

  const search = query.trim().toLocaleLowerCase("es-MX");
  const visible = users
    .filter(
      (user) =>
        (filter === "all" ||
          (filter === "active" ? user.isActive : !user.isActive)) &&
        (!search ||
          `${user.displayName} ${user.username} ${user.email ?? ""} ${user.phone ?? ""}`
            .toLocaleLowerCase("es-MX")
            .includes(search)),
    )
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.displayName.localeCompare(b.displayName, "es"),
    );

  const userAction = (user: AuthUser) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={user.isOwner && currentUser?.id !== user.id}
      title={
        user.isOwner && currentUser?.id !== user.id
          ? "Solo el titular puede modificar la cuenta principal."
          : undefined
      }
      onClick={() => {
        if (user.isOwner && currentUser?.id !== user.id) return;
        setFeedback("");
        setEditor({ user });
      }}
      aria-label={`Editar ${user.displayName}`}
    >
      <Settings2 data-icon="inline-start" /> Editar
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Personal y roles
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra las cuentas y los permisos de cada operador.
          </p>
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => {
            setFeedback("");
            setEditor({ user: null });
          }}
        >
          <Plus data-icon="inline-start" /> Nuevo operador
        </Button>
      </header>
      {feedback ? (
        <Alert role="status">
          <AlertTitle>Operador guardado</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" /> Operadores registrados
          </CardTitle>
          <CardDescription>
            {users.length} cuentas ·{" "}
            {users.filter((user) => user.isActive).length} activas. Desactiva
            las cuentas que ya no necesiten acceso para conservar su historial.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 sm:px-6">
          <FieldGroup className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor="staff-search">Buscar operador</FieldLabel>
              <Input
                id="staff-search"
                placeholder="Nombre, usuario, correo o teléfono…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
            <Field className="sm:w-44">
              <FieldLabel htmlFor="staff-filter">Estado</FieldLabel>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger id="staff-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todas las cuentas</SelectItem>
                    <SelectItem value="active">Activas</SelectItem>
                    <SelectItem value="inactive">Inactivas</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                void load();
              }}
            >
              <RefreshCw data-icon="inline-start" /> Actualizar
            </Button>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se cargaron los operadores</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <div
              className="flex flex-col gap-3"
              role="status"
              aria-label="Cargando operadores"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 xl:hidden">
                {visible.length ? (
                  visible.map((user) => (
                    <article
                      key={user.id}
                      className="flex min-w-0 flex-col gap-4 rounded-lg border p-4"
                      aria-label={user.displayName}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words font-medium">
                            {user.displayName}
                            {user.isOwner ? " · Cuenta principal" : ""}
                          </h3>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            Usuario: {user.username}
                          </p>
                        </div>
                        {userAction(user)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {user.role === "admin" ? "ADMIN" : "CAJERO"}
                        </Badge>
                        <Badge
                          variant={user.isActive ? "outline" : "secondary"}
                        >
                          {user.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <dl className="grid min-w-0 gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">Permisos</dt>
                          <dd className="mt-1">
                            {user.role === "admin"
                              ? "Todos los permisos"
                              : `${user.permissions.length} de ${PERMISSIONS.length} permisos`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Correo</dt>
                          <dd className="mt-1 break-words">
                            {user.email || "No registrado"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Teléfono</dt>
                          <dd className="mt-1 break-words">
                            {user.phone || "No registrado"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Creación</dt>
                          <dd className="mt-1">{dateLabel(user.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            Último acceso
                          </dt>
                          <dd className="mt-1">
                            {dateLabel(user.lastSignInAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">UID</dt>
                          <dd className="mt-1 break-all font-mono">
                            {user.id}
                          </dd>
                        </div>
                      </dl>
                      {user.mustChangePassword ? (
                        <p className="text-xs text-muted-foreground">
                          Cambio de contraseña pendiente
                        </p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No se encontraron operadores con estos filtros.
                  </p>
                )}
              </div>
              <div className="hidden min-w-0 xl:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Cuenta / permisos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead>Último acceso</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.length ? (
                      visible.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">
                                {user.displayName}
                                {user.isOwner ? " · Cuenta principal" : ""}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Usuario: {user.username}
                              </span>
                              {user.email ? (
                                <span className="text-xs text-muted-foreground">
                                  {user.email}
                                </span>
                              ) : null}
                              {user.phone ? (
                                <span className="text-xs text-muted-foreground">
                                  {user.phone}
                                </span>
                              ) : null}
                              <span
                                className="font-mono text-[10px] text-muted-foreground"
                                title={user.id}
                              >
                                UID: {user.id}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1.5">
                              <Badge variant="secondary">
                                {user.role === "admin" ? "ADMIN" : "CAJERO"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {user.role === "admin"
                                  ? "Todos los permisos"
                                  : `${user.permissions.length} de ${PERMISSIONS.length} permisos`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1.5">
                              <Badge
                                variant={
                                  user.isActive ? "outline" : "secondary"
                                }
                              >
                                {user.isActive ? "Activa" : "Inactiva"}
                              </Badge>
                              {user.mustChangePassword ? (
                                <span className="text-xs text-muted-foreground">
                                  Cambio de contraseña pendiente
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {dateLabel(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {dateLabel(user.lastSignInAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {userAction(user)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-12 text-center text-muted-foreground"
                        >
                          No se encontraron operadores con estos filtros.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {editor ? (
        <UserEditor
          key={editor.user?.id ?? "new"}
          user={editor.user}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
