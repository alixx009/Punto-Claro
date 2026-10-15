import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/useAuth";
import {
  INITIAL_ADMIN_PASSWORD_MIN_LENGTH,
  USERNAME_RULES,
} from "../../../../shared/auth";
import { PlainDocument } from "./PlainDocument";

export function InitialSetupScreen() {
  const { setupAdmin } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!acknowledged) {
      setError("Confirma que guardaste tus credenciales antes de continuar.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await setupAdmin({
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim() || null,
        password,
        passwordConfirmation: confirmation,
        credentialsAcknowledged: acknowledged,
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo crear el administrador.",
      );
      setPassword("");
      setConfirmation("");
      setAcknowledged(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <PlainDocument>
      <main>
        <h1>Bienvenido al punto de venta</h1>
        <h2>Crea tu administrador principal</h2>
        <p>
          Configura el acceso para esta instalación. Esta cuenta tendrá todos
          los permisos y podrá administrar el negocio y crear otros usuarios.
        </p>
        <section aria-labelledby="setup-credentials-title">
          <h3 id="setup-credentials-title">Guarda bien tus credenciales</h3>
          <p>
            Guarda tu nombre de usuario y contraseña en un lugar seguro antes de
            continuar. Los necesitarás para volver a entrar a la aplicación.
          </p>
          <p>
            La aplicación no permite consultar tu contraseña ni tiene
            recuperación automática por correo. El correo es opcional y se
            registra como dato de contacto.
          </p>
        </section>
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <legend>Datos del administrador</legend>
            <p>
              <label htmlFor="setup-name">Nombre completo *</label>
              <br />
              <input
                id="setup-name"
                name="name"
                autoComplete="name"
                required
                maxLength={120}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoFocus
              />
            </p>
            <p>
              <label htmlFor="setup-username">Nombre de usuario *</label>
              <br />
              <input
                id="setup-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={USERNAME_RULES.minLength}
                maxLength={USERNAME_RULES.maxLength}
                pattern={USERNAME_RULES.pattern}
                aria-describedby="setup-username-help"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setAcknowledged(false);
                }}
              />
              <br />
              <small id="setup-username-help">
                De 3 a 30 caracteres. Empieza con una letra o número; puedes
                usar letras sin acentos, números, puntos, guiones y guion bajo.
                Se guardará en minúsculas.
              </small>
            </p>
            <p>
              <label htmlFor="setup-email">Correo electrónico (opcional)</label>
              <br />
              <input
                id="setup-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </p>
            <p>
              <label htmlFor="setup-password">Contraseña *</label>
              <br />
              <input
                id="setup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={INITIAL_ADMIN_PASSWORD_MIN_LENGTH}
                maxLength={72}
                aria-describedby="setup-password-help"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setAcknowledged(false);
                }}
              />
              <br />
              <small id="setup-password-help">
                Al menos {INITIAL_ADMIN_PASSWORD_MIN_LENGTH} caracteres. Elige
                una contraseña que no uses en otros servicios.
              </small>
            </p>
            <p>
              <label htmlFor="setup-confirmation">Confirmar contraseña *</label>
              <br />
              <input
                id="setup-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={INITIAL_ADMIN_PASSWORD_MIN_LENGTH}
                maxLength={72}
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setAcknowledged(false);
                }}
              />
            </p>
            <p>
              <label>
                <input
                  type="checkbox"
                  required
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />{" "}
                Confirmo que guardé mi nombre de usuario y contraseña en un
                lugar seguro.
              </label>
            </p>
            {error ? <p role="alert">{error}</p> : null}
            <button type="submit" disabled={!acknowledged}>
              {pending
                ? "Creando administrador…"
                : "Crear administrador y entrar"}
            </button>
          </fieldset>
        </form>
      </main>
    </PlainDocument>
  );
}
