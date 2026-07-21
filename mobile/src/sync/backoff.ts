import { config } from '../config';

/**
 * Exponential backoff for failed uploads (01 §3.4). Pure — unit-tested.
 * Delay doubles per prior attempt from BACKOFF_BASE_MS, capped at BACKOFF_MAX_MS.
 */
export function backoffDelayMs(attempts: number): number {
  const raw = config.BACKOFF_BASE_MS * 2 ** Math.max(0, attempts);
  return Math.min(config.BACKOFF_MAX_MS, raw);
}

/** When a frame with `attempts` prior failures should next be retried. */
export function nextAttemptAt(attempts: number, now: number): number {
  return now + backoffDelayMs(attempts);
}
