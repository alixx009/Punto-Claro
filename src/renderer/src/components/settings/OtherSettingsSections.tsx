import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ClipboardList, Info, Plus, Server, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSettings, saveSettings } from "@/config/settings";
import { BackupSettingsCard } from "./BackupSettingsCard";

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function CatalogSettingsSection({
  categories,
  onCategoriesChange,
}: {
  categories: string[];
  onCategoriesChange: Dispatch<SetStateAction<string[]>>;
}) {
  const [newCategory, setNewCategory] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const updateCategories = (next: string[]) => {
    try {
      saveSettings({ ...getSettings(), categories: next });
      onCategoriesChange(next);
      setError("");
      setFeedback("Lista de categorías actualizada en este equipo.");
    } catch {
      setError("No se pudo guardar la lista de categorías.");
    }
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (
      categories.some(
        (category) =>
          category.toLocaleLowerCase("es-MX") ===
          name.toLocaleLowerCase("es-MX"),
      )
    ) {
      setError("Esa categoría ya está en la lista.");
      return;
    }
    updateCategories([...categories, name]);
    setNewCategory("");
  };

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <SectionHeading
        title="Catálogos base"
        description="Organiza las categorías de referencia y consulta las cajas registradoras."
      />
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" /> Familia de categorías
          </CardTitle>
          <CardDescription>
            Puedes agregar y quitar categorías de esta lista local.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 sm:px-6">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              addCategory();
            }}
          >
            <Input
              aria-label="Nueva categoría"
              value={newCategory}
              onChange={(event) => {
                setNewCategory(event.target.value);
                setError("");
              }}
              placeholder="Nueva categoría…"
              maxLength={80}
            />
            <Button type="submit" disabled={!newCategory.trim()}>
              <Plus data-icon="inline-start" /> Cargar
            </Button>
          </form>
          <div className="grid gap-2 md:grid-cols-2">
            {categories.map((category) => (
              <div
                key={category}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="truncate">{category}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar ${category}`}
                  onClick={() =>
                    updateCategories(
                      categories.filter((item) => item !== category),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay categorías en la lista.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {feedback && (
            <p role="status" className="text-sm text-emerald-700">
              {feedback}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Cajas registradoras</CardTitle>
          <CardDescription>
            Vista de referencia. La gestión de terminales se habilitará más
            adelante.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Nombre de caja registradora"
              placeholder="Ej. Terminal fija 2"
              disabled
            />
            <Button disabled>
              <Plus data-icon="inline-start" /> Cargar
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
            <span className="flex-1 font-medium">Caja principal</span>
            <Badge variant="secondary">ACTIVA</Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled
              aria-label="Eliminar caja principal"
            >
              <Trash2 />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConnectionSettingsSection() {
  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <SectionHeading
        title="Conexión y datos"
        description="Administra los respaldos y consulta las opciones de conexión entre estaciones."
      />
      <Card className="border-slate-900 bg-slate-900 text-white">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" /> Conectividad multicaja
          </CardTitle>
          <CardDescription className="text-slate-300">
            Dirección local en red
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <p className="text-sm text-slate-200">
            No se pudieron detectar IPs alternativas en red local...
          </p>
          <div className="mt-6 flex items-start gap-2 border-t border-slate-700 pt-4 text-xs text-slate-300">
            <Info className="size-4 shrink-0" />
            <span>
              La conexión entre estaciones estará disponible cuando se habilite
              la sincronización local.
            </span>
          </div>
        </CardContent>
      </Card>
      <BackupSettingsCard />
    </div>
  );
}
