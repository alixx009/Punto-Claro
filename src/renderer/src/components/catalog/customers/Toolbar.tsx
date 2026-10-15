import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Filter } from "./constants";

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  totalCustomers: number;
  debtorCount: number;
  onCreate: () => void;
}

export const Toolbar = ({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  totalCustomers,
  debtorCount,
  onCreate,
}: ToolbarProps) => (
  <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3 border-b border-border p-3 sm:px-6">
    <div className="relative min-w-0 basis-full flex-1 lg:basis-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label="Buscar clientes"
        placeholder="Buscar por nombre, ID o teléfono de contacto..."
        className="h-10 bg-background pl-10"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>

    <div className="flex max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background/45 p-1">
      <FilterTab
        active={filter === "all"}
        onClick={() => onFilterChange("all")}
        label="Todos"
        count={totalCustomers}
      />
      <FilterTab
        active={filter === "debtors"}
        onClick={() => onFilterChange("debtors")}
        label="Solo Deudores"
        count={debtorCount}
        tone="danger"
      />
    </div>

    <Button className="hover:cursor-pointer" onClick={onCreate}>
      <Plus />
      Nuevo Cliente
    </Button>
  </div>
);

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "danger";
}

const FilterTab = ({ active, onClick, label, count, tone }: FilterTabProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:cursor-pointer",
      active
        ? tone === "danger"
          ? "bg-red-500/15 text-red-500"
          : "bg-accent text-foreground"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {label}
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        tone === "danger"
          ? "bg-red-500/15 text-red-500"
          : "bg-muted text-muted-foreground",
      )}
    >
      {count}
    </span>
  </button>
);
