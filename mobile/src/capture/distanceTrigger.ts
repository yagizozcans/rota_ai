import { config } from '../config';

/**
 * Decides WHEN to capture a frame during a drive (01 §3.2, plan Q3). Pure and
 * framework-free so it is fully unit-testable without a device.
 *
 * Primary mode (good GPS): accumulate ground distance between fixes and fire
 * every CAPTURE_DISTANCE_M (~5 m). Fallback mode (weak GPS, accuracy worse than
 * GPS_WEAK_FALLBACK_M): fire on a speed-derived time interval instead, so a
 * bad-accuracy stretch still yields ~5 m spacing rather than a gap.
 */

export interface GpsFix {
  lat: number;
  lon: number;
  accuracy_m: number;
  speed_kmh: number;
  heading_deg: number;
  /** Fix time, epoch ms. */
  t: number;
}

export interface TriggerState {
  /** Last fix used for distance accumulation; null before the first fix. */
  lastFix: GpsFix | null;
  /** Distance (m) accumulated since the last capture. */
  accumulatedM: number;
  /** Epoch ms of the last capture; 0 before the first. */
  lastCaptureAt: number;
}

export function initTriggerState(): TriggerState {
  return { lastFix: null, accumulatedM: 0, lastCaptureAt: 0 };
}

/** Great-circle distance between two lat/lon points, in metres. */
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6_371_000; // Earth radius, m
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Time between captures (ms) in the weak-GPS fallback, derived from speed so
 * spacing stays ~CAPTURE_DISTANCE_M. Unknown/zero speed falls back to a seed;
 * the result is clamped so we neither spam nor leave large gaps (plan Q3).
 */
export function timeFallbackIntervalMs(speedKmh: number): number {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
    return config.TIME_FALLBACK_SEED_MS;
  }
  const mps = speedKmh / 3.6;
  const raw = (config.CAPTURE_DISTANCE_M / mps) * 1000;
  return Math.min(config.TIME_FALLBACK_MAX_MS, Math.max(config.TIME_FALLBACK_MIN_MS, raw));
}

/**
 * Feed the next GPS fix. Returns the next state and whether this fix should
 * trigger a capture. The first fix of a drive always captures (baseline frame).
 */
export function onFix(
  state: TriggerState,
  fix: GpsFix,
): { state: TriggerState; capture: boolean } {
  // First fix of the drive → capture a baseline, establish the reference point.
  if (!state.lastFix) {
    return { state: { lastFix: fix, accumulatedM: 0, lastCaptureAt: fix.t }, capture: true };
  }

  const weakGps = fix.accuracy_m > config.GPS_WEAK_FALLBACK_M;

  if (weakGps) {
    // Fallback: time-based. Distance from a low-accuracy fix isn't trustworthy.
    const interval = timeFallbackIntervalMs(fix.speed_kmh);
    const due = fix.t - state.lastCaptureAt >= interval;
    if (due) {
      return { state: { lastFix: fix, accumulatedM: 0, lastCaptureAt: fix.t }, capture: true };
    }
    // Keep lastFix current so distance mode resumes cleanly when GPS recovers.
    return { state: { ...state, lastFix: fix }, capture: false };
  }

  // Primary: distance-based.
  const accumulatedM = state.accumulatedM + haversineMeters(state.lastFix, fix);
  if (accumulatedM >= config.CAPTURE_DISTANCE_M) {
    return { state: { lastFix: fix, accumulatedM: 0, lastCaptureAt: fix.t }, capture: true };
  }
  return {
    state: { lastFix: fix, accumulatedM, lastCaptureAt: state.lastCaptureAt },
    capture: false,
  };
}
