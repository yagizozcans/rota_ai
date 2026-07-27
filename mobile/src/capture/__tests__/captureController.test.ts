import {
  captureFrame,
  type CaptureDeps,
  type CaptureContext,
} from '../captureController';
import type { CaptureFrame } from '../../types/captureFrame';
import type { GpsFix } from '../distanceTrigger';
import { config } from '../../config';

const ctx: CaptureContext = { orgId: 'org-1', sessionId: 'sess-1', deviceId: 'dev-1' };

const fix: GpsFix = {
  lat: 41.01,
  lon: 28.97,
  accuracy_m: 4.2,
  speed_kmh: 48,
  heading_deg: 275,
  t: 1_000_000,
};

function makeDeps(over: Partial<CaptureDeps> = {}): {
  deps: CaptureDeps;
  enqueued: Array<{ frame: CaptureFrame; localPath: string }>;
  discarded: string[];
} {
  const enqueued: Array<{ frame: CaptureFrame; localPath: string }> = [];
  const discarded: string[] = [];
  const deps: CaptureDeps = {
    takePhoto: async () => ({ path: 'file:///tmp/raw.jpg', width: 4000, height: 3000 }),
    discardPhoto: async (p) => {
      discarded.push(p);
    },
    persist: async (_tempPath, frameId) => `/data/frames/${frameId}.jpg`,
    enqueue: async (frame, localPath) => {
      enqueued.push({ frame, localPath });
    },
    newId: () => 'frame-xyz',
    now: () => Date.parse('2026-07-20T10:00:00.000Z'),
    ...over,
  };
  return { deps, enqueued, discarded };
}

test('sharp frame (no blur gate): take → persist → build → enqueue', async () => {
  const { deps, enqueued } = makeDeps();
  const result = await captureFrame(deps, ctx, fix);

  expect(result.frame).not.toBeNull();
  expect(enqueued).toHaveLength(1);
  expect(enqueued[0].localPath).toBe('/data/frames/frame-xyz.jpg');
  expect(result.frame?.image_ref).toBe('org-1/sess-1/frame-xyz.jpg');
  expect(result.frame?.timestamp).toBe('2026-07-20T10:00:00.000Z');
});

test('blurry frame is dropped: temp discarded, nothing enqueued', async () => {
  const { deps, enqueued, discarded } = makeDeps({
    analyzeBlur: async () => config.BLUR_VARIANCE_MIN - 1, // below threshold
  });
  const result = await captureFrame(deps, ctx, fix);

  expect(result.frame).toBeNull();
  expect(result.blurScore).toBe(config.BLUR_VARIANCE_MIN - 1);
  expect(discarded).toEqual(['file:///tmp/raw.jpg']); // temp cleaned up
  expect(enqueued).toEqual([]); // never uploaded
});

test('sharp frame with blur gate passes and is enqueued', async () => {
  const { deps, enqueued } = makeDeps({
    analyzeBlur: async () => config.BLUR_VARIANCE_MIN + 100, // well above threshold
  });
  const result = await captureFrame(deps, ctx, fix);

  expect(result.frame).not.toBeNull();
  expect(result.blurScore).toBe(config.BLUR_VARIANCE_MIN + 100);
  expect(enqueued).toHaveLength(1);
});
