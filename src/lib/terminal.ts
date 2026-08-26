export const terminalOpenEvent = "yanxiao:terminal-open";

export function openTerminal(): void {
  window.dispatchEvent(new Event(terminalOpenEvent));
}
