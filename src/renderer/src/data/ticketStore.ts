import type { CreateTicketInput, Ticket } from "../../../shared/ipc";
import { assertSessionDataEpoch, getSessionDataEpoch } from "./sessionEpoch";

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.tickets.create(input);
  assertSessionDataEpoch(epoch);
  return result;
}

export async function getTicket(id: number): Promise<Ticket | null> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.tickets.get(id);
  assertSessionDataEpoch(epoch);
  return result;
}

export async function listTickets(): Promise<Ticket[]> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.tickets.list();
  assertSessionDataEpoch(epoch);
  return result;
}
