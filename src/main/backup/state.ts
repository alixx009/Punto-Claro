let replacing = false;

export function setDataReplacementInProgress(value: boolean): void {
  replacing = value;
}

export function assertDataAvailable(): void {
  if (replacing)
    throw new Error(
      "Se está restaurando el respaldo. Espera a que termine para continuar.",
    );
}
