import { useState } from "react";
import { CalendarIcon, Search, X } from "lucide-react";
import { es } from "date-fns/locale/es";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import type { SalesHistoryPaymentFilter } from "../../../../shared/ipc";
import { currentWeekRange, formatSaleDate, toDateKey } from "./format";

interface Props {
  search: string;
  payment: SalesHistoryPaymentFilter;
  date: DateRange | undefined;
  count: number | null;
  loading: boolean;
  onSearch: (value: string) => void;
  onPayment: (value: SalesHistoryPaymentFilter) => void;
  onDate: (value: DateRange | undefined) => void;
}

export function SalesHistoryFilters({
  search,
  payment,
  date,
  count,
  loading,
  onSearch,
  onPayment,
  onDate,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<DateRange | undefined>(date);

  function changeCalendarOpen(open: boolean) {
    if (open) setDraftDate(date);
    setCalendarOpen(open);
  }

  function applyDate(value: DateRange) {
    if (!value.from) return;
    onDate({ from: value.from, to: value.to ?? value.from });
    setCalendarOpen(false);
  }
  return (
    <div className="flex min-w-0 flex-col gap-4 border-b p-4 xl:flex-row xl:items-end lg:p-5">
      <FieldGroup className="min-w-0 gap-3 sm:flex-row sm:flex-wrap xl:flex-1">
        <Field className="min-w-0 gap-1.5 sm:flex-1 sm:basis-64">
          <FieldLabel htmlFor="sales-history-search">
            Buscar una venta
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="sales-history-search"
              placeholder="Buscar por folio o cliente..."
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </InputGroup>
        </Field>
        <Field className="min-w-0 gap-1.5 sm:w-48 sm:shrink-0">
          <FieldLabel htmlFor="sales-history-payment">Forma de pago</FieldLabel>
          <Select
            value={payment}
            onValueChange={(value) =>
              onPayment(value as SalesHistoryPaymentFilter)
            }
          >
            <SelectTrigger id="sales-history-payment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="CARD">Tarjeta</SelectItem>
                <SelectItem value="TRANSFER">Transferencia</SelectItem>
                <SelectItem value="STORE_CREDIT">Crédito / Fiar</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="min-w-0 gap-1.5 sm:w-auto sm:shrink-0">
          <FieldLabel htmlFor="sales-history-date">
            Periodo de ventas
          </FieldLabel>
          <div className="flex min-w-0 gap-1.5">
            <Popover open={calendarOpen} onOpenChange={changeCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="sales-history-date"
                  variant="outline"
                  className="min-w-0 flex-1 justify-start"
                >
                  <CalendarIcon data-icon="inline-start" />
                  <span className="truncate">
                    {date?.from
                      ? `${formatSaleDate(toDateKey(date.from))} – ${formatSaleDate(toDateKey(date.to ?? date.from))}`
                      : "Todas las fechas"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
                align="start"
              >
                <Calendar
                  mode="range"
                  selected={draftDate}
                  defaultMonth={date?.from}
                  onSelect={setDraftDate}
                  locale={es}
                  weekStartsOn={1}
                  formatters={{
                    formatMonthDropdown: (value) =>
                      value.toLocaleString("es-MX", { month: "short" }),
                  }}
                  captionLayout="dropdown"
                  autoFocus
                />
                <div className="flex flex-col gap-3 border-t p-3">
                  <p className="text-xs text-muted-foreground">
                    Selecciona la fecha inicial y la final.
                  </p>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyDate(currentWeekRange())}
                    >
                      Semana actual
                    </Button>
                    <Button
                      size="sm"
                      disabled={!draftDate?.from}
                      onClick={() => {
                        if (draftDate) applyDate(draftDate);
                      }}
                    >
                      Aplicar rango
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {date && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Quitar filtro de fecha"
                onClick={() => onDate(undefined)}
              >
                <X />
              </Button>
            )}
          </div>
        </Field>
      </FieldGroup>
      <p
        className="pb-2 text-sm text-muted-foreground xl:shrink-0"
        role="status"
        aria-live="polite"
      >
        {loading
          ? "Consultando registros…"
          : count === null
            ? "Registros no disponibles"
            : `${count.toLocaleString("es-MX")} ${count === 1 ? "transacción registrada" : "transacciones registradas"}`}
      </p>
    </div>
  );
}
