/** Pause sales input while a help dialog has focus, including the navbar guide. */
export function isSectionHelpOpen(): boolean {
  return document.querySelector('[data-section-help="true"]') !== null;
}
