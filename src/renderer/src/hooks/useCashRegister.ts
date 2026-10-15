import { useCallback, useEffect, useState } from "react";
import {
  getRegisterSession,
  subscribeRegisterSession,
  openRegisterSession,
  closeRegisterSession,
  loadRegisterSession,
} from "@/data/registerStore";
import type { RegisterSession } from "../../../shared/ipc";

export function useCashRegister() {
  const [session, setSession] = useState<RegisterSession | null>(
    getRegisterSession(),
  );
  const [openingInput, setOpeningInput] = useState("");

  useEffect(() => subscribeRegisterSession(setSession), []);

  const openRegister = async () => {
    const amount = parseFloat(openingInput);
    if (!Number.isFinite(amount) || amount < 0) return;
    await openRegisterSession({ openingAmount: amount, notes: null });
    setOpeningInput("");
  };

  const closeRegister = async (declaredByMethod: {
    cash: number;
    card: number;
    transfer: number;
  }) => {
    const current = getRegisterSession();
    if (!current) return;
    await closeRegisterSession({
      declaredByMethod,
      notes: null,
    });
  };

  const refresh = useCallback(() => {
    void loadRegisterSession();
  }, []);

  return {
    session,
    shift: session !== null,
    openingMoney: session?.openingAmount ?? 0,
    cashPayments: session?.cashPayments ?? 0,
    cashMovements: session?.cashMovements ?? 0,
    expectedByMethod: session?.expectedByMethod ?? {
      cash: 0,
      card: 0,
      transfer: 0,
      other: 0,
    },
    currentCash:
      (session?.openingAmount ?? 0) +
      (session?.cashPayments ?? 0) +
      (session?.cashMovements ?? 0),
    openingInput,
    setOpeningInput,
    openRegister,
    closeRegister,
    refresh,
  };
}