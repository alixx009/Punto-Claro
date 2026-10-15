import { lazy, Suspense, useState } from "react";
import {
  ArrowRightLeft,
  ClipboardCheck,
  History,
  PackageSearch,
  ReceiptText,
  Warehouse,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportLoading } from "./ReportPrimitives";
import { useAuth } from "@/auth/useAuth";
import { SectionHelp } from "@/components/help/SectionHelp";
import { reportHelpTopics } from "@/components/help/report-guides";

const Sales = lazy(() => import("./ReportSalesSection"));
const Cuts = lazy(() => import("./ReportCutsSection"));
const Audit = lazy(() => import("./ReportAuditSection"));
const Restock = lazy(() => import("./ReportRestockSection"));
const Inventory = lazy(() => import("./ReportInventorySection"));
const Movements = lazy(() => import("./ReportMovementsSection"));
const tabs = [
  {
    value: "sales",
    label: "Ventas y Devoluciones",
    icon: ReceiptText,
    component: Sales,
  },
  {
    value: "cuts",
    label: "Historial de Cortes",
    icon: History,
    component: Cuts,
  },
  {
    value: "audit",
    label: "Auditoría",
    icon: ClipboardCheck,
    component: Audit,
  },
  {
    value: "restock",
    label: "Reabastecimiento",
    icon: PackageSearch,
    component: Restock,
  },
  {
    value: "inventory",
    label: "Inventario",
    icon: Warehouse,
    component: Inventory,
  },
  {
    value: "movements",
    label: "Movimientos (Kardex)",
    icon: ArrowRightLeft,
    component: Movements,
  },
] as const;
type ReportTab = (typeof tabs)[number]["value"];

export default function ReportsScreen() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<ReportTab>("sales");
  const canInspectStock = hasPermission("stock.inspect");
  const visibleTabs = canInspectStock
    ? tabs
    : tabs.filter(
        ({ value }) => !["restock", "inventory", "movements"].includes(value),
      );
  const activeTab = visibleTabs.some(({ value }) => value === tab)
    ? tab
    : "sales";
  if (!hasPermission("reports.view")) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        No tienes permiso para consultar reportes.
      </main>
    );
  }
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4 lg:p-6">
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <SectionHelp key={activeTab} topic={reportHelpTopics[activeTab]} />
        </div>
        <p className="text-sm text-muted-foreground">
          Consulta ventas, cierres de caja y existencias para dar seguimiento a
          tu negocio.
        </p>
      </header>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(value as ReportTab)}
        className="min-w-0 gap-5"
      >
        <div className="min-w-0 overflow-x-auto border-b pb-2">
          <TabsList
            variant="line"
            aria-label="Secciones de reportes"
            className="w-max max-w-none justify-start"
          >
            {visibleTabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="px-3">
                <Icon aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {visibleTabs.map(({ value, component: Component }) => (
          <TabsContent key={value} value={value} className="min-w-0">
            {activeTab === value ? (
              <Suspense fallback={<ReportLoading />}>
                <Component />
              </Suspense>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
