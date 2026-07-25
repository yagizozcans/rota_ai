import { config } from '../config';
import type { CaptureFrame } from '../types/captureFrame';
import type { QueuedFrame } from '../types/models';
import { openStorage } from '../storage/db';
import { listReady, markFailed, markUploaded } from '../storage/frameRepo';
import { deleteFile, fileExists } from '../storage/files';
import { nextAttemptAt } from './backoff';
import { isSyncAllowed, startNetWatch } from './net';
import { uploadFrame } from './uploader';

/**
 * Drains the local outbox to the backend, independently of capture (it only
 * touches storage, so it runs with the camera closed — IMPLEMENTATION-PLAN §3).
 * A confirmed upload deletes the local file then removes the row (local copy
 * gone only after confirmed upload — 01 §3.3); a failure schedules a backoff
 * retry (01 §3.4). No frame is ever dropped here.
 *
 * Scope (plan Q9): runs while the app is alive and resumes leftover rows on
 * relaunch — sufficient for MVP. Upload while the app is fully killed (native
 * WorkManager/Headless JS) is a Faz-3 follow-up.
 */

export interface SyncDeps {
  listReady: (now: number, limit: number) => Promise<QueuedFrame[]>;
  fileExists: (path: string) => Promise<boolean>;
  upload: (frame: CaptureFrame, localPath: string) => Promise<'ok' | 'retry'>;
  markUploaded: (frameId: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  markFailed: (frameId: string, nextAt: number) => Promise<void>;
  isOnline: () => boolean;
  now: () => number;
  onUploaded?: () => void;
  /** Fired right before a frame's upload begins (drives the HUD progress bar). */
  onUploadStart?: (frameId: string) => void;
  /** Fired after a frame's upload attempt finishes (success or retry). */
  onUploadEnd?: () => void;
}

export interface SyncPassResult {
  uploaded: number;
  failed: number;
}

/** One drain pass over a due batch. Pure orchestration — unit-tested with fakes. */
export async function runOnce(deps: SyncDeps): Promise<SyncPassResult> {
  if (!deps.isOnline()) {
    return { uploaded: 0, failed: 0 };
  }
  const batch = await deps.listReady(deps.now(), config.UPLOAD_BATCH);
  let uploaded = 0;
  let failed = 0;

  for (const q of batch) {
    if (!deps.isOnline()) {
      break; // connectivity dropped mid-batch — stop, leftovers stay queued
    }
    // Orphan row whose file was already deleted (uploaded before a crash) → drop it.
    if (!(await deps.fileExists(q.localPath))) {
      await deps.markUploaded(q.frame.frame_id);
      continue;
    }
    deps.onUploadStart?.(q.frame.frame_id);
    const outcome = await deps.upload(q.frame, q.localPath);
    if (outcome === 'ok') {
      await deps.deleteFile(q.localPath);
      await deps.markUploaded(q.frame.frame_id);
      uploaded += 1;
      deps.onUploaded?.();
    } else {
      await deps.markFailed(q.frame.frame_id, nextAttemptAt(q.attempts, deps.now()));
      failed += 1;
    }
    deps.onUploadEnd?.();
  }
  return { uploaded, failed };
}

/**
 * Start the background drain loop: opens storage, wires the real deps, then
 * ticks on an interval and wakes immediately when connectivity returns.
 * Returns a stop function.
 */
export type SyncHooks = Pick<SyncDeps, 'onUploaded' | 'onUploadStart' | 'onUploadEnd'>;

export function startSync(hooks: SyncHooks = {}): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deps: SyncDeps | null = null;

  const tick = async () => {
    if (stopped || !deps) {
      return;
    }
    try {
      await runOnce(deps);
    } catch {
      // Never let a pass throw out of the loop; try again next tick.
    }
    if (!stopped) {
      timer = setTimeout(tick, config.SYNC_INTERVAL_MS);
    }
  };

  (async () => {
    const db = await openStorage();
    deps = {
      listReady: (now, limit) => listReady(db, now, limit),
      fileExists,
      upload: uploadFrame,
      markUploaded: (id) => markUploaded(db, id),
      deleteFile,
      markFailed: (id, at) => markFailed(db, id, at),
      isOnline: isSyncAllowed,
      now: Date.now,
      ...hooks,
    };
    tick();
  })();

  const unwatch = startNetWatch(() => {
    if (!stopped && deps) {
      if (timer) {
        clearTimeout(timer);
      }
      tick(); // connectivity returned — drain now instead of waiting for the interval
    }
  });

  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
    }
    unwatch();
  };
}
