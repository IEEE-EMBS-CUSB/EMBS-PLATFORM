/**
 * Performs a full document navigation to flush Next.js client router cache
 * and React preserved component state across authentication boundary changes.
 */
export function navigateHard(url: string): void {
  window.location.assign(url);
}
