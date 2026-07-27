import type { CaptureFrame } from '../types/captureFrame';
import type { QueuedFrame } from '../types/models';
import type { SqlExecutor, SqlRow } from './sqlExecutor';

/**
 * The local frame outbox. Frames are inserted by the capture layer and drained
 * by the sync layer; the two never touch each other, only this table (that is
 * what lets sync run with the camera closed — IMPLEMENTATION-PLAN §3).
 *
 * There is no "uploaded" state: a confirmed upload removes the row (the frame's
 * job is done and the device must not fill up — 01 §3.3). A failed upload keeps
 * the row and pushes out `next_attempt_at` for backoff (01 §3.4).
 */

/** Add a freshly captured frame to the outbox. */
export async function enqueue(
  db: SqlExecutor,
  frame: CaptureFrame,
  localPath: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO frames
       (frame_id, org_id, session_id, device_id, timestamp,
        lat, lon, accuracy_m, speed_kmh, heading_deg, image_ref, local_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      frame.frame_id,
      frame.org_id,
      frame.session_id,
      frame.device_id,
      frame.timestamp,
      frame.gps.lat,
      frame.gps.lon,
      frame.gps.accuracy_m,
      frame.gps.speed_kmh,
      frame.heading_deg,
      frame.image_ref,
      localPath,
    ],
  );
}

/** Frames due for an upload attempt now (`next_attempt_at <= now`), oldest first. */
export async function listReady(
  db: SqlExecutor,
  now: number,
  limit: number,
): Promise<QueuedFrame[]> {
  const rows = await db.execute(
    `SELECT * FROM frames
     WHERE next_attempt_at <= ?
     ORDER BY timestamp ASC
     LIMIT ?`,
    [now, limit],
  );
  return rows.map(rowToQueuedFrame);
}

/** Remove a frame after its upload is confirmed. Caller deletes the JPEG first. */
export async function markUploaded(db: SqlExecutor, frameId: string): Promise<void> {
  await db.execute('DELETE FROM frames WHERE frame_id = ?', [frameId]);
}

/** Record a failed attempt and schedule the next one (backoff). Row stays queued. */
export async function markFailed(
  db: SqlExecutor,
  frameId: string,
  nextAttemptAt: number,
): Promise<void> {
  await db.execute(
    'UPDATE frames SET attempts = attempts + 1, next_attempt_at = ? WHERE frame_id = ?',
    [nextAttemptAt, frameId],
  );
}

/** How many frames are still waiting to upload (for HUD counters / "Y yüklendi"). */
export async function countPending(db: SqlExecutor): Promise<number> {
  const rows = await db.execute('SELECT COUNT(*) AS n FROM frames');
  return Number(rows[0]?.n ?? 0);
}

/** Map a flat DB row back to a QueuedFrame (nested gps, device-only fields). */
export function rowToQueuedFrame(row: SqlRow): QueuedFrame {
  return {
    frame: {
      frame_id: String(row.frame_id),
      org_id: String(row.org_id),
      session_id: String(row.session_id),
      device_id: String(row.device_id),
      timestamp: String(row.timestamp),
      gps: {
        lat: Number(row.lat),
        lon: Number(row.lon),
        accuracy_m: Number(row.accuracy_m),
        speed_kmh: Number(row.speed_kmh),
      },
      heading_deg: Number(row.heading_deg),
      image_ref: String(row.image_ref),
    },
    localPath: String(row.local_path),
    attempts: Number(row.attempts),
    nextAttemptAt: Number(row.next_attempt_at),
  };
}
