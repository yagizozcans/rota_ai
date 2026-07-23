import { useCallback, useEffect, useRef } from 'react';
import type { Camera } from 'react-native-vision-camera';
import { takePhoto } from '../../capture/camera';
import { captureFrame, type PhotoResult } from '../../capture/captureController';
import { initTriggerState, onFix, type GpsFix, type TriggerState } from '../../capture/distanceTrigger';
import { newUuid } from '../../capture/ids';
import { startLocation } from '../../capture/location';
import { openStorage } from '../../storage/db';
import { enqueue } from '../../storage/frameRepo';
import { deleteFile, persistPhoto } from '../../storage/files';
import { freeStorageBytes } from '../../storage/diskSpace';
import type { SqlExecutor } from '../../storage/sqlExecutor';
import { finalizeSession, registerSession } from '../../sync/sessions';
import type { DeviceIdentity } from '../../types/models';
import { useCaptureStore } from '../state/captureStore';

/**
 * Assembles the capture loop for the screen: GPS stream → distance trigger →
 * captureController → SQLite outbox, plus manual photo. Wires the capture
 * layer's pure pieces to the native camera ref and storage. Sync (upload) is
 * separate (Slice 5) and drains the same outbox independently.
 *
 * The GPS watch runs for the whole life of the screen — NOT just while
 * recording — so the HUD (accuracy, speed, weather coords) is always live and
 * a manual photo can be geotagged at any time. Recording only gates whether
 * fixes feed the distance trigger.
 *
 * Inline blur analysis is DISABLED here: without the native pre-resize
 * (dropped — RN 0.86 incompatibility, see capture/analyzeBlur.ts) it decodes
 * the full-resolution JPEG on the JS thread, freezing the UI for seconds per
 * frame — in the field this made the stop button unresponsive. The pure
 * scoring code + tests remain; re-enable via a VisionCamera Frame Processor
 * (background thread) so calibration logging (plan Q2) can resume.
 */
export function useCaptureEngine(
  cameraRef: React.RefObject<Camera | null>,
  identity: DeviceIdentity,
) {
  const store = useCaptureStore;
  const triggerRef = useRef<TriggerState>(initTriggerState());
  const dbRef = useRef<SqlExecutor | null>(null);
  /** Session for the active recording drive (null when not recording). */
  const recordSessionRef = useRef<string | null>(null);
  /** Lazy session that owns manual photos taken outside a recording. */
  const manualSessionRef = useRef<string | null>(null);
  const capturesSinceProbe = useRef(0);

  const ensureDb = useCallback(async (): Promise<SqlExecutor> => {
    if (!dbRef.current) {
      dbRef.current = await openStorage();
    }
    return dbRef.current;
  }, []);

  const probeFreeSpace = useCallback(async () => {
    try {
      store.getState().setFreeBytes(await freeStorageBytes());
    } catch {
      // Non-fatal; the HUD just keeps the last known value.
    }
  }, [store]);

  const doCapture = useCallback(
    async (fix: GpsFix, sessionId: string) => {
      if (!cameraRef.current) {
        return;
      }
      try {
        const db = await ensureDb();
        const camera = cameraRef.current;
        const deps = {
          takePhoto: (): Promise<PhotoResult> => takePhoto(camera),
          discardPhoto: deleteFile,
          persist: persistPhoto,
          enqueue: (frame: Parameters<typeof enqueue>[1], localPath: string) =>
            enqueue(db, frame, localPath),
          newId: newUuid,
          now: Date.now,
        };
        const result = await captureFrame(deps, { ...identity, sessionId }, fix);
        if (result.frame) {
          store.getState().onCaptured(Date.now());
        } else {
          store.getState().onDropped();
        }
        if (++capturesSinceProbe.current >= 20) {
          capturesSinceProbe.current = 0;
          probeFreeSpace();
        }
      } catch {
        // A single failed capture must never kill the drive; skip and continue.
      }
    },
    [cameraRef, identity, store, ensureDb, probeFreeSpace],
  );

  // Always-on GPS watch: live HUD from mount, trigger only while recording.
  useEffect(() => {
    probeFreeSpace();
    const stopWatch = startLocation((fix) => {
      store.getState().setFix(fix);
      if (!store.getState().recording || !recordSessionRef.current) {
        return;
      }
      const result = onFix(triggerRef.current, fix);
      triggerRef.current = result.state;
      if (result.capture) {
        doCapture(fix, recordSessionRef.current);
      }
    });
    return stopWatch;
  }, [store, probeFreeSpace, doCapture]);

  const start = useCallback(async () => {
    await ensureDb();
    triggerRef.current = initTriggerState();
    probeFreeSpace();
    const sessionId = newUuid();
    recordSessionRef.current = sessionId;
    store.getState().startDrive({ sessionId, startedAt: Date.now() });
    // Opportunistic; offline is fine — frames lazy-register the session on upload.
    registerSession(sessionId, identity.deviceId);
  }, [store, identity, ensureDb, probeFreeSpace]);

  const stop = useCallback(() => {
    store.getState().stopDrive();
    const sessionId = recordSessionRef.current;
    recordSessionRef.current = null;
    if (sessionId) {
      // Persist the drive as completed in the backend (best-effort, 03 §4.1).
      finalizeSession(sessionId, identity.deviceId);
    }
  }, [store, identity]);

  /** Manual photo — works any time there is a GPS fix, recording or not. */
  const captureManual = useCallback(async () => {
    const fix = store.getState().fix;
    if (!fix) {
      return;
    }
    let sessionId = store.getState().recording ? recordSessionRef.current : manualSessionRef.current;
    if (!sessionId) {
      // First manual photo outside a recording: mint a session to own them.
      sessionId = newUuid();
      manualSessionRef.current = sessionId;
      registerSession(sessionId, identity.deviceId);
    }
    await doCapture(fix, sessionId);
  }, [store, identity, doCapture]);

  return { start, stop, captureManual };
}
