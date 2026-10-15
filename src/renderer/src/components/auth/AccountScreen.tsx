import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { changePassword, useAuth } from "@/auth/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SectionHelp } from "@/components/help/SectionHelp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AccountScreen() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSuccess(false);
    if (newPassword !== confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPending(false);
    }
  }

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas p-4 sm:p-6">
      <div className="mx-auto flex min-w-0 max-w-2xl flex-col gap-6">
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
            <SectionHelp topic="account" />
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {user?.displayName} · Usuario: {user?.username}
            {user?.email ? ` · ${user.email}` : ""}
          </p>
        </header>
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5" /> Cambiar contraseña
            </CardTitle>
            <CardDescription>
              La contraseña nueva se aplicará al siguiente inicio de sesión. Las
              otras sesiones de tu cuenta se cerrarán.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={submit} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="account-current-password">
                    Contraseña actual
                  </FieldLabel>
                  <Input
                    id="account-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                    maxLength={72}
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-new-password">
                    Contraseña nueva
                  </FieldLabel>
                  <Input
                    id="account-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={6}
                    maxLength={72}
                    disabled={pending}
                  />
                  <FieldDescription>
                    Usa al menos 6 caracteres.
                  </FieldDescription>
                </Field>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="account-confirm-password">
                    Confirmar contraseña nueva
                  </FieldLabel>
                  <Input
                    id="account-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    minLength={6}
                    maxLength={72}
                    disabled={pending}
                    aria-invalid={!!error}
                  />
                </Field>
              </FieldGroup>
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se guardó la contraseña</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {success ? (
                <Alert role="status">
                  <AlertTitle>Contraseña actualizada</AlertTitle>
                  <AlertDescription>
                    Tu sesión actual sigue disponible.
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                disabled={pending}
                className="w-full sm:w-auto sm:self-start"
              >
                {pending ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
