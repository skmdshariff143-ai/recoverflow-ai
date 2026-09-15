import type { IntentTelemetrySnapshot } from './tracker';

/**
 * Dispatches an intent telemetry payload using the fastest edge transport available.
 */
export function sendIntentBeacon(endpoint: string, payload: IntentTelemetrySnapshot): boolean {
  if (typeof window === 'undefined') return false;

  const serialized = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([serialized], { type: 'application/json' });
      return navigator.sendBeacon(endpoint, blob);
    } catch {
      // Fallback to fetch
    }
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: serialized,
    keepalive: true,
  }).catch(() => {});

  return true;
}
