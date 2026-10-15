import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import type {
  SalesHistoryPaymentFilter,
  SalesHistoryResult,
} from "../../../../shared/ipc";
import { currentWeekRange, toDateKey } from "./format";

export function useSalesHistory() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [payment, setPayment] = useState<SalesHistoryPaymentFilter>("ALL");
  const [date, setDate] = useState<DateRange | undefined>(currentWeekRange);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<SalesHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateFrom = date?.from ? toDateKey(date.from) : null;
  const dateTo = date?.to ? toDateKey(date.to) : dateFrom;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setResult(null);
    void window.api.sales
      .history({
        search: debouncedSearch,
        payment,
        dateFrom,
        dateTo,
        page,
        pageSize: 20,
      })
      .then((data) => {
        if (current) {
          setResult(data);
          setPage(data.page);
        }
      })
      .catch(() => {
        if (current)
          setError("No se pudo cargar el historial. Inténtalo de nuevo.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [debouncedSearch, payment, dateFrom, dateTo, page, revision]);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }
  function changePayment(value: SalesHistoryPaymentFilter) {
    setPayment(value);
    setPage(1);
  }
  function changeDate(value: DateRange | undefined) {
    setDate(value);
    setPage(1);
  }
  function refresh() {
    setRevision((value) => value + 1);
  }
  function reset() {
    setSearch("");
    setDebouncedSearch("");
    setPayment("ALL");
    setDate(undefined);
    setPage(1);
    refresh();
  }

  return {
    search,
    payment,
    date,
    page,
    result,
    loading,
    error,
    changeSearch,
    changePayment,
    changeDate,
    setPage,
    refresh,
    reset,
    filtered: Boolean(search.trim() || payment !== "ALL" || date),
  };
}
