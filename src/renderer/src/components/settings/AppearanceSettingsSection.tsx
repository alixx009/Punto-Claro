import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { getSettings, saveSettings, type AppTheme } from "@/config/settings";

export function AppearanceSettingsSection() {
  const [theme, setTheme] = useState<AppTheme>(
    () => getSettings().appearance.theme,
  );
  const [error, setError] = useState("");

  const changeTheme = (dark: boolean) => {
    const next: AppTheme = dark ? "dark" : "light";
    try {
      saveSettings({ ...getSettings(), appearance: { theme: next } });
      setTheme(next);
      setError("");
    } catch {
      setError("No se pudo guardar el tema. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Apariencia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personaliza el aspecto de la aplicación.
        </p>
      </div>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Tema de la aplicación</CardTitle>
          <CardDescription>
            El cambio se aplica al instante y se guarda en este equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="appearance-dark-mode">
                  Modo oscuro
                </FieldLabel>
                <FieldDescription id="appearance-dark-mode-description">
                  Actívalo para usar el modo oscuro o desactívalo para usar el
                  modo claro.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="appearance-dark-mode"
                checked={theme === "dark"}
                onCheckedChange={changeTheme}
                aria-describedby="appearance-dark-mode-description"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
