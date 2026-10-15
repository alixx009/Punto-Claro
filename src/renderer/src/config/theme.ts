import { getSettings, SETTINGS_CHANGED_EVENT, type AppTheme } from "./settings";

export function applyTheme(theme: AppTheme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function initializeTheme(): void {
  const synchronize = () => applyTheme(getSettings().appearance.theme);
  synchronize();
  window.addEventListener(SETTINGS_CHANGED_EVENT, synchronize);
  window.addEventListener("storage", synchronize);
}
