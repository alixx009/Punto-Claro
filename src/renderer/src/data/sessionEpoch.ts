let sessionEpoch = 0;

export function getSessionDataEpoch(): number {
  return sessionEpoch;
}

export function advanceSessionDataEpoch(): void {
  sessionEpoch += 1;
}

export function assertSessionDataEpoch(epoch: number): void {
  if (epoch !== sessionEpoch) {
    throw new Error("La sesión cambió. Vuelve a iniciar la operación.");
  }
}
