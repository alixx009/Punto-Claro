import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArchiveX,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { es } from "date-fns/locale/es";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSaleDate, toDateKey } from "@/components/sales-history/format";

export function ReportSearch({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="min-w-0 gap-1.5 sm:flex-1 sm:basis-64">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          placeholder={placeholder}
          value={value}
          maxLength={200}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputGroup>
    </Field>
  );
}

export function ReportSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field
      className="min-w-0 gap-1.5 sm:w-44 sm:shrink-0"
      data-disabled={disabled}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ReportDatePicker({
  id,
  label = "Fecha",
  value,
  onChange,
  clearable = true,
}: {
  id: string;
  label?: string;
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Field className="min-w-0 gap-1.5 sm:w-auto sm:shrink-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex min-w-0 gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className="min-w-0 flex-1 justify-start"
            >
              <CalendarIcon data-icon="inline-start" />
              {value ? formatSaleDate(toDateKey(value)) : "dd/mm/aaaa"}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
            align="start"
          >
            <Calendar
              mode="single"
              selected={value}
              defaultMonth={value}
              onSelect={(date) => {
                onChange(date);
                if (date) setOpen(false);
              }}
              locale={es}
              weekStartsOn={1}
              captionLayout="dropdown"
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {clearable && value ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
          >
            <X />
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

export function ReportMetric({
  title,
  value,
  description,
  loading,
  accent = false,
}: {
  title: string;
  value: string;
  description: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className="min-w-0 gap-2 py-3 sm:gap-3 sm:py-6">
      <CardHeader className="grid-cols-2 grid-rows-1 items-center gap-3 px-4 sm:grid-cols-1 sm:grid-rows-[auto_auto] sm:items-start sm:gap-1 sm:px-6">
        <CardDescription className="min-w-0 break-words">
          {title}
        </CardDescription>
        <CardTitle
          className={cn(
            "min-w-0 break-words text-right text-xl tabular-nums sm:text-left sm:text-2xl lg:text-3xl",
            accent && "sales-history-success",
          )}
        >
          {loading ? (
            <Skeleton className="ml-auto h-7 w-full max-w-32 sm:ml-0 sm:h-9" />
          ) : (
            value
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="sr-only">{title}</CardContent>
      <CardFooter className="flex-wrap px-4 text-xs text-muted-foreground sm:px-6">
        {description}
      </CardFooter>
    </Card>
  );
}

export function ReportPagination({
  page,
  pageSize = 25,
  total,
  loading,
  onPage,
}: {
  page: number;
  pageSize?: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground" role="status">
        {total
          ? `${((page - 1) * pageSize + 1).toLocaleString("es-MX")}–${Math.min(page * pageSize, total).toLocaleString("es-MX")} de ${total.toLocaleString("es-MX")} registros`
          : "0 registros"}
      </p>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <span className="w-full text-xs text-muted-foreground sm:mr-1 sm:w-auto">
          Página {page} de {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft data-icon="inline-start" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </footer>
  );
}

export function ReportEmpty({
  title = "No se encontraron registros",
  description = "Prueba con otro periodo o cambia los filtros.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty className="min-h-56 min-w-0 px-4 py-8 sm:p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArchiveX />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function ReportError({
  error,
  onRetry,
  title = "No se pudo cargar el reporte",
}: {
  error: string | null;
  onRetry: () => void;
  title?: string;
}) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {error}
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function ReportExport({
  onClick,
  busy,
  disabled = false,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <Button onClick={onClick} disabled={busy || disabled}>
      <Download data-icon="inline-start" />
      {busy ? "Exportando…" : "Exportar Excel"}
    </Button>
  );
}

export function ReportTableShell({
  title,
  description,
  children,
  loading,
  error,
  onRetry,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
      aria-label={title}
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {error ? (
        <div className="p-4">
          <ReportError error={error} onRetry={onRetry} />
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function ReportLoading({ columns = 5 }: { columns?: number }) {
  return (
    <div
      className="flex flex-col gap-5 p-5"
      role="status"
      aria-label="Cargando reporte"
    >
      {Array.from({ length: 5 }, (_, row) => (
        <div
          key={row}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}
