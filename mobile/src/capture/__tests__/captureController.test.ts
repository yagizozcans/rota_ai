import {
  captureFrame,
  type CaptureDeps,
  type CaptureContext,
} from '../captureController';
import type { CaptureFrame } from '../../types/captureFrame';
import type { GpsFix } from '../distanceTrigger';

const ctx: CaptureContext = { orgId: 'org-1', sessionId: 'sess-1', deviceId: 'dev-1' };

const fix: GpsFix = {
  lat: 41.01,
  lon: 28.97,
  accuracy_m: 4.2,
  speed_kmh: 48,
  heading_deg: 275,
  t: 1_000_000,
};

test('captureFrame: take → persist → build → enqueue, wired correctly', async () => {
  const enqueued: Array<{ frame: CaptureFrame; localPath: string }> = [];
  const deps: CaptureDeps = {
    takePhoto: async () => ({ path: 'file:///tmp/raw.jpg', width: 4000, height: 3000 }),
    persist: async (tempPath, frameId) => {
      expect(tempPath).toBe('file:///tmp/raw.jpg'); // the temp photo is what gets persisted
      return `/data/frames/${frameId}.jpg`;
    },
    enqueue: async (frame, localPath) => {
      enqueued.push({ frame, localPath });
    },
    newId: () => 'frame-xyz',
    now: () => Date.parse('2026-07-20T10:00:00.000Z'),
  };

  const result = await captureFrame(deps, ctx, fix);

  expect(enqueued).toHaveLength(1);
  const { frame, localPath } = enqueued[0];
  expect(frame).toBe(result);
  expect(localPath).toBe('/data/frames/frame-xyz.jpg'); // persisted path, keyed by frameId
  expect(frame.frame_id).toBe('frame-xyz');
  expect(frame.image_ref).toBe('org-1/sess-1/frame-xyz.jpg');
  expect(frame.timestamp).toBe('2026-07-20T10:00:00.000Z'); // from deps.now()
  expect(frame.gps).toEqual({ lat: 41.01, lon: 28.97, accuracy_m: 4.2, speed_kmh: 48 });
  expect(frame.heading_deg).toBe(275);
});
