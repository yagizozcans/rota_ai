/**
 * CaptureFrame — the exact upload payload the mobile layer sends per frame.
 *
 * Derived FIELD-FOR-FIELD from docs/00-overview.md §4.1. No field is invented
 * or omitted (NON-NEGOTIABLE BEHAVIORS). `weather_temp_c` and any quality flag
 * are deliberately absent — they are not in §4.1 (plan Q5/Q6).
 */
export interface CaptureFrame {
  /** uuid — client-generated (plan Q1). */
  frame_id: string;
  /** uuid — tenant, from the auth token; token is authoritative (§4.1 note). */
  org_id: string;
  /** uuid — one drive; client-generated so a drive can start offline (plan Q1). */
  session_id: string;
  device_id: string;
  /** ISO8601. */
  timestamp: string;
  gps: {
    lat: number;
    lon: number;
    accuracy_m: number;
    speed_kmh: number;
  };
  /** Vehicle heading in degrees (gyroscope/magnetometer). */
  heading_deg: number;
  /** Deterministic storage key `{org_id}/{session_id}/{frame_id}.jpg` (plan Q4). */
  image_ref: string;
}
