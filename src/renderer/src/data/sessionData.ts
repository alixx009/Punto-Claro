import { resetCustomers } from "./customersStore";
import { resetProducts } from "./productStore";
import { resetRegisterSession } from "./registerStore";
import { advanceSessionDataEpoch } from "./sessionEpoch";

/** Invalidate responses from the previous user before clearing shared data. */
export function resetSessionData(): void {
  advanceSessionDataEpoch();
  resetProducts();
  resetCustomers();
  resetRegisterSession();
}
