import { FieldGroup } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toDateKey } from "@/components/sales-history/format";
import { ReportDatePicker, ReportSelect } from "./ReportPrimitives";

export type ReportPeriod =
  "HISTORIC" | "TODAY" | "WEEK" | "THIRTY" | "MONTH" | "YEAR" | "CUSTOM";
export interface ReportRangeState {
  period: ReportPeriod;
  month: number;
  year: number;
  from: Date | undefined;
  to: Date | undefined;
}
const periods: { value: ReportPeriod; label: string }[] = [
  { value: "HISTORIC", label: "HISTÓRICO" },
  { value: "TODAY", label: "HOY" },
  { value: "WEEK", label: "7 DÍAS" },
  { value: "THIRTY", label: "30 DÍAS" },
  { value: "MONTH", label: "MES" },
  { value: "YEAR", label: "AÑO" },
  { value: "CUSTOM", label: "RANGO PERSONALIZADO" },
];
const months = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: new Date(2020, index, 1).toLocaleString("es-MX", { month: "long" }),
}));

export function initialReportRange(): ReportRangeState {
  const now = new Date();
  return {
    period: "TODAY",
    month: now.getMonth(),
    year: now.getFullYear(),
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

export function reportDateBounds(range: ReportRangeState): {
  dateFrom: string | null;
  dateTo: string | null;
} {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start = new Date(end);
  if (range.period === "HISTORIC") return { dateFrom: null, dateTo: null };
  if (range.period === "CUSTOM")
    return {
      dateFrom: range.from ? toDateKey(range.from) : null,
      dateTo: range.to ? toDateKey(range.to) : null,
    };
  if (range.period === "WEEK") start.setDate(start.getDate() - 6);
  if (range.period === "THIRTY") start.setDate(start.getDate() - 29);
  if (range.period === "MONTH") {
    start = new Date(range.year, range.month, 1);
    end.setFullYear(range.year, range.month + 1, 0);
  }
  if (range.period === "YEAR") {
    start = new Date(range.year, 0, 1);
    end.setFullYear(range.year, 11, 31);
  }
  return { dateFrom: toDateKey(start), dateTo: toDateKey(end) };
}

export function ReportTimeRange({
  value,
  years,
  onChange,
}: {
  value: ReportRangeState;
  years: number[];
  onChange: (value: ReportRangeState) => void;
}) {
  const availableYears = [
    ...new Set([new Date().getFullYear(), value.year, ...years]),
  ]
    .sort((left, right) => right - left)
    .map((year) => ({ value: String(year), label: String(year) }));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="min-w-0 overflow-x-auto pb-1">
        <ToggleGroup
          type="single"
          value={value.period}
          onValueChange={(period) => {
            if (period) onChange({ ...value, period: period as ReportPeriod });
          }}
          variant="outline"
          size="sm"
          aria-label="Periodo del reporte"
          className="w-max"
        >
          {periods.map((period) => (
            <ToggleGroupItem key={period.value} value={period.value}>
              {period.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {["MONTH", "YEAR", "CUSTOM"].includes(value.period) ? (
        <FieldGroup className="gap-3 sm:flex-row sm:flex-wrap">
          {value.period === "MONTH" ? (
            <ReportSelect
              id="report-month"
              label="Mes"
              value={String(value.month)}
              options={months}
              onChange={(month) => onChange({ ...value, month: Number(month) })}
            />
          ) : null}
          {value.period === "MONTH" || value.period === "YEAR" ? (
            <ReportSelect
              id="report-year"
              label="Año"
              value={String(value.year)}
              options={availableYears}
              onChange={(year) => onChange({ ...value, year: Number(year) })}
            />
          ) : null}
          {value.period === "CUSTOM" ? (
            <>
              <ReportDatePicker
                id="report-from"
                label="Desde"
                value={value.from}
                clearable={false}
                onChange={(from) => onChange({ ...value, from })}
              />
              <ReportDatePicker
                id="report-to"
                label="Hasta"
                value={value.to}
                clearable={false}
                onChange={(to) => onChange({ ...value, to })}
              />
            </>
          ) : null}
        </FieldGroup>
      ) : null}
    </div>
  );
}
