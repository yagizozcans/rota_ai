import Geolocation from 'react-native-geolocation-service';
import type { GpsFix } from './distanceTrigger';

/**
 * Native GPS stream. Emits a normalised {@link GpsFix} per position update.
 * Heading comes from GPS course (valid only while moving); when stationary the
 * chip reports no heading and we emit 0. NOTE: magnetometer fusion for a stable
 * heading at low speed (01 §2) is deferred to a later refinement — flagged.
 */

export type FixListener = (fix: GpsFix) => void;

/** Start watching position. Returns an unsubscribe function. */
export function startLocation(onFix: FixListener, onError?: (e: unknown) => void): () => void {
  const watchId = Geolocation.watchPosition(
    (pos) => {
      const c = pos.coords;
      onFix({
        lat: c.latitude,
        lon: c.longitude,
        // Missing accuracy ⇒ treat as very poor so the weak-GPS fallback engages.
        accuracy_m: c.accuracy ?? 9999,
        speed_kmh: c.speed != null && c.speed >= 0 ? c.speed * 3.6 : 0,
        heading_deg: c.heading != null && c.heading >= 0 ? c.heading : 0,
        t: pos.timestamp ?? Date.now(),
      });
    },
    (err) => onError?.(err),
    { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 1000 },
  );
  return () => Geolocation.clearWatch(watchId);
}
