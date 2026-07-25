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
  framesPerMin: number,
): number {
  if (framesPerMin <= 0 || avgFrameBytes <= 0) {
    return Infinity;
  }
  return freeBytes / (framesPerMin * avgFrameBytes);
}

/**
 * Capture rate (frames/minute) over the last 60 s, from capture timestamps.
 * Pure with `now` passed in, so it is NEVER computed inside a store selector —
 * doing that (a value that changes every call via Date.now()) caused an
 * infinite render loop once there were ≥2 captures in the window.
 */
export function framesPerMinute(recentCaptures: number[], now: number): number {
  const windowMs = 60_000;
  const inWindow = recentCaptures.filter((t) => now - t <= windowMs);
  if (inWindow.length < 2) {
    return 0;
  }
  const spanMs = now - inWindow[0];
  return spanMs > 0 ? (inWindow.length / spanMs) * windowMs : 0;
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
