import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CreatePurchaseResult,
  PurchaseDetail,
  PurchasesResult,
} from "../../../../shared/purchases";
import { useAuth } from "@/auth/useAuth";
import { getSessionDataEpoch } from "@/data/sessionEpoch";
import { applyPurchasedProducts } from "@/data/productStore";
import {
  purchaseErrorMessage,
  readPendingPurchase,
  type PendingPurchaseAttempt,
} from "./purchaseUtils";

interface ManualEditor {
  key: string;
  open: boolean;
  recovered: PendingPurchaseAttempt | null;
}

export function usePurchasesController() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [recovery] = useState(() => {
    try {
      return {
        attempt: userId ? readPendingPurchase(userId) : null,
        error: "",
      };
    } catch (error) {
      return { attempt: null, error: purchaseErrorMessage(error) };
    }
  });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1 });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [result, setResult] = useState<PurchasesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [manual, setManual] = useState<ManualEditor | null>(() =>
    recovery.attempt
      ? {
          key: recovery.attempt.input.requestId,
          open: false,
          recovered: recovery.attempt,
        }
      : null,
  );
  const [pending, setPending] = useState(Boolean(recovery.attempt));
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailVersion, setDetailVersion] = useState(0);
  const mounted = useRef(false);
  const epoch = useRef(getSessionDataEpoch());
  const requestVersion = useRef(0);
  const detailRequestVersion = useRef(0);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const isCurrent = useCallback(
    () => mounted.current && epoch.current === getSessionDataEpoch(),
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ++requestVersion.current;
      ++detailRequestVersion.current;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setQuery((current) => ({
          search: search.trim(),
          page: search.trim() === current.search ? current.page : 1,
        })),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError("");
    void window.api.purchases
      .list(query)
      .then((rows) => {
        if (!isCurrent() || version !== requestVersion.current) return;
        setResult(rows);
        if (rows.page !== query.page)
          setQuery((current) => ({ ...current, page: rows.page }));
      })
      .catch((error: unknown) => {
        if (isCurrent() && version === requestVersion.current)
          setLoadError(purchaseErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent() && version === requestVersion.current)
          setLoading(false);
      });
    return () => {
      ++requestVersion.current;
    };
  }, [query, refreshVersion, isCurrent]);

  useEffect(() => {
    if (detailId === null) return;
    const version = ++detailRequestVersion.current;
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");
    void window.api.purchases
      .get(detailId)
      .then((row) => {
        if (isCurrent() && version === detailRequestVersion.current)
          setDetail(row);
      })
      .catch((error: unknown) => {
        if (isCurrent() && version === detailRequestVersion.current)
          setDetailError(purchaseErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent() && version === detailRequestVersion.current)
          setDetailLoading(false);
      });
    return () => {
      ++detailRequestVersion.current;
    };
  }, [detailId, detailVersion, isCurrent]);

  const rememberFocus = () => {
    returnFocusTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };
  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!isCurrent()) return;
      (returnFocusTo.current?.isConnected
        ? returnFocusTo.current
        : document.getElementById("purchases-search")
      )?.focus();
    });
  }, [isCurrent]);

  const onRegistered = useCallback(
    (saved: CreatePurchaseResult) => {
      if (!isCurrent()) return;
      applyPurchasedProducts(saved.updatedProducts, epoch.current);
      setManual(null);
      setPending(false);
      setSearch("");
      setQuery({ search: "", page: 1 });
      setRefreshVersion((value) => value + 1);
      setNotice(
        `Compra ${saved.purchase.folio} registrada. Se actualizaron las existencias y el costo de compra de sus productos.`,
      );
    },
    [isCurrent],
  );

  return {
    userId,
    search,
    setSearch,
    result,
    loading,
    loadError,
    reload: () => setRefreshVersion((value) => value + 1),
    setPage: (page: number) => {
      if (!loading && search.trim() === query.search)
        setQuery((current) => ({ ...current, page }));
    },
    searchPending: search.trim() !== query.search,
    notice,
    dismissNotice: () => setNotice(""),
    recoveryError: recovery.error,
    manual,
    pending,
    setPending,
    openManual: () => {
      if (recovery.error) return;
      rememberFocus();
      setNotice("");
      setManual((current) =>
        current
          ? { ...current, open: true }
          : { key: crypto.randomUUID(), open: true, recovered: null },
      );
    },
    closeManual: (retain: boolean) =>
      setManual((current) =>
        retain && current ? { ...current, open: false } : null,
      ),
    onRegistered,
    restoreFocus,
    detailId,
    detail,
    detailLoading,
    detailError,
    openDetail: (id: number) => {
      rememberFocus();
      setDetailId(id);
    },
    closeDetail: () => setDetailId(null),
    reloadDetail: () => setDetailVersion((value) => value + 1),
  };
}
