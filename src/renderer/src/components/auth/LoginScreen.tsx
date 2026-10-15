import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/useAuth";
import { PlainDocument } from "./PlainDocument";

export function LoginScreen() {
  const { status, error: sessionError, login, refresh } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await login({ identifier: identifier.trim(), password });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setPassword("");
      setPending(false);
    }
  }

  return (
    <PlainDocument>
      <main>
        <h1>Punto de venta</h1>
        <h2>Iniciar sesión</h2>
        {status === "loading" ? (
          <p role="status">Comprobando sesión…</p>
        ) : (
          <>
            <p>
              Ingresa tu nombre de usuario o correo y tu contraseña para
              continuar.
            </p>
            {sessionError ? (
              <p role="alert">
                {sessionError}{" "}
                <button
                  type="button"
                  onClick={() => {
                    void refresh();
                  }}
                >
                  Reintentar conexión
                </button>
              </p>
            ) : null}
            <form onSubmit={submit}>
              <p>
                <label htmlFor="login-identifier">
                  Nombre de usuario o correo
                </label>
                <br />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  maxLength={254}
                  disabled={pending}
                  autoFocus
                />
              </p>
              <p>
                <label htmlFor="login-password">Contraseña</label>
                <br />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  maxLength={72}
                  disabled={pending}
                />
              </p>
              {error ? <p role="alert">{error}</p> : null}
              <button type="submit" disabled={pending}>
                {pending ? "Ingresando…" : "Entrar"}
              </button>
            </form>
          </>
        )}
      </main>
    </PlainDocument>
  );
}
