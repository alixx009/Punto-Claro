import type {
  CloseRegisterInput,
  CreateCashMovementInput,
  OpenRegisterInput,
  RegisterSession,
} from "../../../shared/ipc";
import { assertSessionDataEpoch, getSessionDataEpoch } from "./sessionEpoch";

type Listener = (session: RegisterSession | null) => void;

let cache: RegisterSession | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener(cache));
}

export function getRegisterSession(): RegisterSession | null {
  return cache;
}

export async function loadRegisterSession(): Promise<RegisterSession | null> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.register.current();
  assertSessionDataEpoch(epoch);
  cache = result;
  emit();
  return cache;
}

export function subscribeRegisterSession(listener: Listener): () => void {
  listeners.add(listener);
  listener(cache);
  return () => {
    listeners.delete(listener);
  };
}

export async function openRegisterSession(
  input: OpenRegisterInput,
): Promise<RegisterSession> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.register.open(input);
  assertSessionDataEpoch(epoch);
  cache = result;
  emit();
  return cache;
}

export async function closeRegisterSession(
  input: CloseRegisterInput,
): Promise<RegisterSession> {
  const epoch = getSessionDataEpoch();
  const result = await window.api.register.close(input);
  assertSessionDataEpoch(epoch);
  cache = null;
  emit();
  return result;
}

export async function addCashMovement(
  input: CreateCashMovementInput,
): Promise<void> {
  const epoch = getSessionDataEpoch();
  await window.api.register.movement.create(input);
  assertSessionDataEpoch(epoch);
  const result = await window.api.register.current();
  assertSessionDataEpoch(epoch);
  cache = result;
  emit();
}

export function resetRegisterSession(): void {
  cache = null;
  emit();
}
