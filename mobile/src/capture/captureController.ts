import type { CaptureFrame } from '../types/captureFrame';
import type { DeviceIdentity } from '../types/models';
import { isTooBlurry } from './blur';
import type { GpsFix } from './distanceTrigger';
import { buildCaptureFrame } from './metadata';

/**
 * Orchestrates a single capture: take photo → blur gate → persist to durable
 * storage → build metadata → enqueue. All side effects are INJECTED (deps), so
 * this stays pure enough to unit-test with fakes and never imports the native
 * camera, filesystem, or storage modules directly (keeps vision-camera out of
 * jest and keeps the capture layer from importing sync/ui).
 */

export interface CaptureContext extends DeviceIdentity {
  sessionId: string;
}

export interface PhotoResult {
  path: string;
  width: number;
  height: number;
}

export interface CaptureDeps {
  takePhoto: () => Promise<PhotoResult>;
  /** Blur score for the temp photo (01 §3.5). Omitted ⇒ no blur gating. */
  analyzeBlur?: (tempPath: string) => Promise<number>;
  /** Delete a temp photo that won't be kept (blurry frame). */
  discardPhoto: (tempPath: string) => Promise<void>;
  /** Move the temp photo into durable app storage, keyed by frameId; returns its path. */
  persist: (tempPath: string, frameId: string) => Promise<string>;
  enqueue: (frame: CaptureFrame, localPath: string) => Promise<void>;
  newId: () => string;
  now: () => number;
}

/** Outcome of one capture: the enqueued frame (or null if dropped) + its blur score. */
export interface CaptureResult {
  frame: CaptureFrame | null;
  /** Measured blur score, or null when blur gating was not run. */
  blurScore: number | null;
}

/**
 * Capture one frame for the given GPS fix. If the frame is too blurry it is
 * dropped locally (temp deleted, nothing enqueued) so it is never uploaded
 * (01 §3.5, plan Q6) — `frame` is null in that case.
 */
export async function captureFrame(
  deps: CaptureDeps,
  ctx: CaptureContext,
  fix: GpsFix,
): Promise<CaptureResult> {
  const frameId = deps.newId();
  const photo = await deps.takePhoto();

  let blurScore: number | null = null;
  if (deps.analyzeBlur) {
    blurScore = await deps.analyzeBlur(photo.path);
    if (isTooBlurry(blurScore)) {
      await deps.discardPhoto(photo.path);
      return { frame: null, blurScore };
    }
  }

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
  return { frame, blurScore };
}
