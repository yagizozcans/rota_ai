import { useCallback, useEffect, useRef } from 'react';
import type { Camera } from 'react-native-vision-camera';
import { takePhoto } from '../../capture/camera';
import { captureFrame, type PhotoResult } from '../../capture/captureController';
import { initTriggerState, onFix, type GpsFix, type TriggerState } from '../../capture/distanceTrigger';
import { newUuid } from '../../capture/ids';
import { startLocation } from '../../capture/location';
import { openStorage } from '../../storage/db';
import { enqueue } from '../../storage/frameRepo';
import { persistPhoto } from '../../storage/files';
import { freeStorageBytes } from '../../storage/diskSpace';
import type { SqlExecutor } from '../../storage/sqlExecutor';
import type { DeviceIdentity } from '../../types/models';
import { useCaptureStore } from '../state/captureStore';

/**
 * Assembles the capture loop for the screen: GPS stream → distance trigger →
 * captureController → SQLite outbox, plus manual photo. Wires the capture layer's
 * pure pieces to the native camera ref and storage. Sync (upload) is separate
 * (Slice 5) and drains the same outbox independently.
 */
export function useCaptureEngine(
  cameraRef: React.RefObject<Camera | null>,
  identity: DeviceIdentity,
) {
  const store = useCaptureStore;
  const triggerRef = useRef<TriggerState>(initTriggerState());
  const dbRef = useRef<SqlExecutor | null>(null);
  const stopLocationRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const capturesSinceProbe = useRef(0);

  const probeFreeSpace = useCallback(async () => {
    try {
      store.getState().setFreeBytes(await freeStorageBytes());
    } catch {
      // Non-fatal; the HUD just keeps the last known value.
    }
  }, [store]);

  const doCapture = useCallback(
    async (fix: GpsFix) => {
      const db = dbRef.current;
      const sessionId = sessionIdRef.current;
      if (!db || !sessionId || !cameraRef.current) {
        return;
      }
      try {
        const camera = cameraRef.current;
        const deps = {
          takePhoto: (): Promise<PhotoResult> => takePhoto(camera),
          persist: persistPhoto,
          enqueue: (frame: Parameters<typeof enqueue>[1], localPath: string) =>
            enqueue(db, frame, localPath),
          newId: newUuid,
          now: Date.now,
        };
        await captureFrame(deps, { ...identity, sessionId }, fix);
        store.getState().onCaptured(Date.now());
        if (++capturesSinceProbe.current >= 20) {
          capturesSinceProbe.current = 0;
          probeFreeSpace();
        }
      } catch {
        // A single failed capture must never kill the drive; skip and continue.
      }
    },
    [cameraRef, identity, store, probeFreeSpace],
  );

  const start = useCallback(async () => {
    dbRef.current = await openStorage();
    triggerRef.current = initTriggerState();
    probeFreeSpace();
    const sessionId = newUuid();
    sessionIdRef.current = sessionId;
    store.getState().startDrive({ sessionId, startedAt: Date.now() });

    stopLocationRef.current = startLocation((fix) => {
      store.getState().setFix(fix);
      const result = onFix(triggerRef.current, fix);
      triggerRef.current = result.state;
      if (result.capture) {
        doCapture(fix);
      }
    });
  }, [store, probeFreeSpace, doCapture]);

  const stop = useCallback(() => {
    stopLocationRef.current?.();
    stopLocationRef.current = null;
    store.getState().stopDrive();
  }, [store]);

  /** Manual photo — one frame at the current fix, independent of the trigger. */
  const captureManual = useCallback(() => {
    const fix = store.getState().fix;
    if (fix) {
      doCapture(fix);
    }
  }, [store, doCapture]);

  // Safety net: stop the GPS watch if the screen unmounts mid-drive.
  useEffect(() => () => stopLocationRef.current?.(), []);

  return { start, stop, captureManual };
}
