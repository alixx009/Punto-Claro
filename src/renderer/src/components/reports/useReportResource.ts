import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

export function useReportResource<T>(load: () => Promise<T>, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let current = true;
    setLoading(true);
    setError(null);
    void load()
      .then((result) => {
        if (current) setData(result);
      })
      .catch((cause) => {
        if (current) {
          setData(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo consultar la información. Inténtalo de nuevo.",
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [load, enabled, revision]);
  return {
    data,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
  };
}
