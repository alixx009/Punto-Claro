import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Download,
  Palette,
  Printer,
  Server,
  Settings,
  Tag,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { getSettings } from "@/config/settings";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/useAuth";
import { SectionHelp } from "@/components/help/SectionHelp";
import { settingsHelpTopics } from "@/components/help/settings-guides";
import { BusinessSettingsSection } from "./BusinessSettingsSection";
import { AppearanceSettingsSection } from "./AppearanceSettingsSection";
import { TicketSettingsSection } from "./TicketSettingsSection";
import { PrinterSettingsSection } from "./PrinterSettingsSection";
import {
  CatalogSettingsSection,
  ConnectionSettingsSection,
} from "./OtherSettingsSections";
import { StaffSettingsSection } from "./StaffSettingsSection";

type Section =
  | "business"
  | "appearance"
  | "ticket"
  | "printer"
  | "staff"
  | "catalog"
  | "connection";

const sections: Array<{
  id: Section;
  label: string;
  description: string;
  icon: LucideIcon;
  later?: boolean;
}> = [
  {
    id: "business",
    label: "Negocio y caja",
    description: "Identidad y datos de contacto",
    icon: Tag,
  },
  {
    id: "appearance",
    label: "Apariencia",
    description: "Tema y aspecto de la aplicación",
    icon: Palette,
  },
  {
    id: "ticket",
    label: "Diseño de ticket",
    description: "Formato y mensajes",
    icon: Settings,
  },
  {
    id: "printer",
    label: "Configuración de impresora",
    description: "Dispositivo y prueba",
    icon: Printer,
  },
  {
    id: "staff",
    label: "Personal y roles",
    description: "Operadores y permisos",
    icon: Users,
  },
  {
    id: "catalog",
    label: "Catálogos base",
    description: "Categorías y cajas",
    icon: ClipboardList,
  },
  {
    id: "connection",
    label: "Conexión y datos",
    description: "Red y respaldos",
    icon: Server,
  },
];

export function SettingsScreen() {
  const { isAdmin } = useAuth();
  const accessibleSections = isAdmin
    ? sections
    : sections.filter(({ id }) => id === "printer" || id === "ticket");
  const [active, setActive] = useState<Section>(
    isAdmin ? "business" : "printer",
  );
  const activeSection = accessibleSections.some(({ id }) => id === active)
    ? active
    : isAdmin
      ? "business"
      : "printer";
  const [business, setBusiness] = useState(() => getSettings().business);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [ticket, setTicket] = useState(() => getSettings().ticket);
  const [printerName, setPrinterName] = useState(
    () => getSettings().printerName,
  );
  const [categories, setCategories] = useState(() => getSettings().categories);

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-w-0 max-w-[1450px] flex-col gap-5 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {isAdmin ? "Ajustes generales" : "Ajustes de impresión"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {isAdmin
                ? "Configura y ajusta los parámetros de tu punto de venta e identidad corporativa."
                : "Selecciona la impresora, ajusta los márgenes y configura el diseño del ticket."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActive("connection")}
                title="Abrir respaldos integrales"
              >
                <Download data-icon="inline-start" /> Respaldo
              </Button>
            )}
            <SectionHelp
              key={activeSection}
              topic={settingsHelpTopics[activeSection]}
              label="Ver tutorial"
            />
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <Field className="lg:hidden">
            <FieldLabel htmlFor="settings-section">
              Sección de ajustes
            </FieldLabel>
            <Select
              value={activeSection}
              onValueChange={(value) => setActive(value as Section)}
            >
              <SelectTrigger id="settings-section" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {accessibleSections.map(({ id, label }) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <aside
            className="hidden rounded-xl border bg-card p-2 shadow-sm lg:sticky lg:top-4 lg:block"
            aria-label="Secciones de ajustes"
          >
            <nav className="flex flex-col gap-1">
              {accessibleSections.map(
                ({ id, label, description, icon: Icon, later }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActive(id)}
                    aria-current={activeSection === id ? "page" : undefined}
                    className={cn(
                      "flex min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      activeSection === id && "bg-muted",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-muted-foreground",
                        activeSection === id && "text-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium leading-tight">
                        {label}
                        {later && (
                          <Badge variant="secondary" className="text-[9px]">
                            Próximo
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </button>
                ),
              )}
            </nav>
          </aside>
          <section
            className="min-w-0 pb-8"
            aria-label={
              accessibleSections.find((section) => section.id === activeSection)
                ?.label
            }
          >
            {isAdmin && activeSection === "business" && (
              <BusinessSettingsSection
                value={business}
                onChange={setBusiness}
                pendingLogo={pendingLogo}
                onPendingLogoChange={setPendingLogo}
              />
            )}
            {isAdmin && activeSection === "appearance" && (
              <AppearanceSettingsSection />
            )}
            {activeSection === "ticket" && (
              <TicketSettingsSection
                value={ticket}
                onChange={setTicket}
                business={business}
              />
            )}
            {activeSection === "printer" && (
              <PrinterSettingsSection
                selectedName={printerName}
                onSelectedNameChange={setPrinterName}
              />
            )}
            {isAdmin && activeSection === "staff" && <StaffSettingsSection />}
            {isAdmin && activeSection === "catalog" && (
              <CatalogSettingsSection
                categories={categories}
                onCategoriesChange={setCategories}
              />
            )}
            {isAdmin && activeSection === "connection" && (
              <ConnectionSettingsSection />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
