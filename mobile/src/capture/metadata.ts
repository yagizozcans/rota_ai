import type { CaptureFrame } from '../types/captureFrame';

/**
 * Assembles a CaptureFrame from the fields the device owns at capture time.
 * Pure — no clock, no id generation, no I/O — so it is fully unit-testable and
 * the caller controls every input (ids, timestamp).
 */

export interface BuildFrameInput {
  frameId: string;
  orgId: string;
  sessionId: string;
  deviceId: string;
  /** ISO8601, supplied by the caller. */
  timestamp: string;
  gps: { lat: number; lon: number; accuracy_m: number; speed_kmh: number };
  headingDeg: number;
}

/** Deterministic object-storage key `{org_id}/{session_id}/{frame_id}.jpg` (plan Q4). */
export function imageRefFor(orgId: string, sessionId: string, frameId: string): string {
  return `${orgId}/${sessionId}/${frameId}.jpg`;
}

export function buildCaptureFrame(input: BuildFrameInput): CaptureFrame {
  return {
    frame_id: input.frameId,
    org_id: input.orgId,
    session_id: input.sessionId,
    device_id: input.deviceId,
    timestamp: input.timestamp,
    gps: {
      lat: input.gps.lat,
      lon: input.gps.lon,
      accuracy_m: input.gps.accuracy_m,
      speed_kmh: input.gps.speed_kmh,
    },
    heading_deg: input.headingDeg,
    image_ref: imageRefFor(input.orgId, input.sessionId, input.frameId),
  };
}
