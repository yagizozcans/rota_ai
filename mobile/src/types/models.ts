import type { CaptureFrame } from './captureFrame';

/**
 * The tenant + device a drive's frames belong to. Sourced from the auth token
 * (plan Q7); the per-drive session_id is added on top (see CaptureContext).
 */
export interface DeviceIdentity {
  orgId: string;
  deviceId: string;
}

/**
 * A frame sitting in the local outbox (SQLite). Wraps the upload payload with
 * the device-only fields the backend never sees: where the JPEG lives, and the
 * retry bookkeeping used by the sync layer's backoff (01 §3.4).
 */
export interface QueuedFrame {
  frame: CaptureFrame;
  /** Absolute device path to the JPEG; deleted only after confirmed upload (01 §3.3). */
  localPath: string;
  /** Failed upload attempts so far. */
  attempts: number;
  /** Epoch ms before which this frame should not be retried; 0 = ready now. */
  nextAttemptAt: number;
}
