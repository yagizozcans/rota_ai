import type { CaptureFrame } from '../types/captureFrame';
import type { GpsFix } from './distanceTrigger';
import { buildCaptureFrame } from './metadata';

/**
 * Orchestrates a single capture: take photo → persist to durable storage →
 * build metadata → enqueue. All side effects are INJECTED (deps), so this stays
 * pure enough to unit-test with fakes and never imports the native camera,
 * filesystem, or storage modules directly (keeps vision-camera out of jest and
 * keeps the capture layer from importing sync/ui).
 */

export interface CaptureContext {
  orgId: string;
  sessionId: string;
  deviceId: string;
}

export interface PhotoResult {
  path: string;
  width: number;
  height: number;
}

export interface CaptureDeps {
  takePhoto: () => Promise<PhotoResult>;
  /** Move the temp photo into durable app storage, keyed by frameId; returns its path. */
  persist: (tempPath: string, frameId: string) => Promise<string>;
  enqueue: (frame: CaptureFrame, localPath: string) => Promise<void>;
  newId: () => string;
  now: () => number;
}

/**
 * Capture one frame for the given GPS fix. Returns the enqueued CaptureFrame.
 * (Slice 6 inserts the blur gate between takePhoto and persist: drop-and-return
 * when the frame is too blurry.)
 */
export async function captureFrame(
  deps: CaptureDeps,
  ctx: CaptureContext,
  fix: GpsFix,
): Promise<CaptureFrame> {
  const frameId = deps.newId();
  const photo = await deps.takePhoto();
  const localPath = await deps.persist(photo.path, frameId);

  const frame = buildCaptureFrame({
    frameId,
    orgId: ctx.orgId,
    sessionId: ctx.sessionId,
    deviceId: ctx.deviceId,
    timestamp: new Date(deps.now()).toISOString(),
    gps: {
      lat: fix.lat,
      lon: fix.lon,
      accuracy_m: fix.accuracy_m,
      speed_kmh: fix.speed_kmh,
    },
    headingDeg: fix.heading_deg,
  });

  await deps.enqueue(frame, localPath);
  return frame;
}
