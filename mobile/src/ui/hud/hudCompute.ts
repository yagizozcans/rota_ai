import { config } from '../../config';

/**
 * Pure display logic for the HUD (01 §3.6). No React, no I/O — unit-tested so
 * the thresholds and formatting are provable and match the acceptance criteria.
 */

export type GpsLevel = 'good' | 'warn' | 'bad';

/** GPS accuracy → indicator level: green ≤ WARN, amber ≤ FLAG, red above. */
export function gpsAccuracyLevel(accuracyM: number): GpsLevel {
  if (accuracyM <= config.GPS_ACCURACY_WARN_M) {
    return 'good';
  }
  if (accuracyM <= config.GPS_ACCURACY_FLAG_M) {
    return 'warn';
  }
  return 'bad';
}

/**
 * Estimated recording time left, in minutes, from free storage and the current
 * capture rate (01 §3.6: free ÷ (frame rate × avg frame size)). Returns
 * Infinity when the rate/size is unknown (nothing to estimate against yet).
 */
export function estimateRemainingMinutes(
  freeBytes: number,
  avgFrameBytes: number,
  framesPerMinute: number,
): number {
  if (framesPerMinute <= 0 || avgFrameBytes <= 0) {
    return Infinity;
  }
  return freeBytes / (framesPerMinute * avgFrameBytes);
}

/** Human label for remaining time: "~6.5 saat", "~45 dk", or "—" when unknown. */
export function formatRemaining(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    return '—';
  }
  if (minutes >= 60) {
    return `~${(minutes / 60).toFixed(1)} saat`;
  }
  return `~${Math.round(minutes)} dk`;
}

/** True when remaining time has dropped under the warn threshold (turn HUD red). */
export function isStorageLow(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes < config.STORAGE_WARN_MINUTES;
}

/** Temperature label: "23°" or "~" when there is no source (01 §3.6, plan Q10). */
export function formatTemp(tempC: number | null): string {
  return tempC == null ? '~' : `${Math.round(tempC)}°`;
}

/** A cached temperature older than the TTL is shown faded (stale) — 01 §3.6. */
export function isTempStale(fetchedAt: number | null, now: number): boolean {
  if (fetchedAt == null) {
    return false;
  }
  return now - fetchedAt > config.TEMP_CACHE_TTL_MIN * 60_000;
}
