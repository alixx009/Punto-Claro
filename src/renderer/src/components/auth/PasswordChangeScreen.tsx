import { useState, type FormEvent } from "react";
import { changePassword, useAuth } from "@/auth/useAuth";
import { PlainDocument } from "./PlainDocument";

export function PasswordChangeScreen() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (newPassword !== confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await changePassword({ currentPassword, newPassword });
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
    <PlainDocument>
      <main>
        <h1>Cambiar contraseña</h1>
        <p>
          {user?.displayName}, establece tu contraseña personal para continuar.
        </p>
        <form onSubmit={submit}>
          <p>
            <label htmlFor="required-current-password">Contraseña actual</label>
            <br />
            <input
              id="required-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              maxLength={72}
              disabled={pending}
              autoFocus
            />
          </p>
          <p>
            <label htmlFor="required-new-password">Contraseña nueva</label>
            <br />
            <input
              id="required-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={6}
              maxLength={72}
              disabled={pending}
            />
          </p>
          <p>
            <label htmlFor="required-confirm-password">
              Confirmar contraseña nueva
            </label>
            <br />
            <input
              id="required-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              minLength={6}
              maxLength={72}
              disabled={pending}
            />
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar contraseña"}
          </button>{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void logout().catch((failure) => setError(failure.message));
            }}
          >
            Cerrar sesión
          </button>
        </form>
      </main>
    </PlainDocument>
  );
}
