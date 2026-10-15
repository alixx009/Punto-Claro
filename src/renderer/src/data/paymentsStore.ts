import type { CreatePaymentInput, Payment } from "../../../shared/ipc";
import { getRegisterSession, loadRegisterSession } from "./registerStore";
import { assertSessionDataEpoch, getSessionDataEpoch } from "./sessionEpoch";

export async function refreshCustomersAfterPayment(
  customerId: number,
  amount: number,
): Promise<void> {
  const epoch = getSessionDataEpoch();
  const { applyCustomerPayment, refreshCustomers } =
    await import("./customersStore");
  assertSessionDataEpoch(epoch);
  applyCustomerPayment(customerId, amount);
  await refreshCustomers();
}

export async function addPayment(input: CreatePaymentInput): Promise<Payment> {
  const epoch = getSessionDataEpoch();
  const session = getRegisterSession();
  const enriched: CreatePaymentInput = {
    ...input,
    registerSessionId: session?.id ?? null,
  };
  const payment = await window.api.payments.create(enriched);
  assertSessionDataEpoch(epoch);
  const updates = await Promise.allSettled([
    refreshCustomersAfterPayment(input.customerId, input.amount),
    session ? loadRegisterSession() : Promise.resolve(),
  ]);
  for (const update of updates) {
    if (update.status === "rejected") {
      console.error(
        "El pago se registró, pero no se pudo actualizar la pantalla.",
        update.reason,
      );
    }
  }
  assertSessionDataEpoch(epoch);
  return payment;
}
