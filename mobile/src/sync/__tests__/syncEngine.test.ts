import { runOnce, type SyncDeps } from '../syncEngine';
import type { QueuedFrame } from '../../types/models';
import { nextAttemptAt } from '../backoff';

function queued(id: string, over: Partial<QueuedFrame> = {}): QueuedFrame {
  return {
    frame: {
      frame_id: id,
      org_id: 'org-1',
      session_id: 'sess-1',
      device_id: 'dev-1',
      timestamp: '2026-07-20T10:00:00.000Z',
      gps: { lat: 41, lon: 29, accuracy_m: 4, speed_kmh: 40 },
      heading_deg: 0,
      image_ref: `org-1/sess-1/${id}.jpg`,
    },
    localPath: `/data/${id}.jpg`,
    attempts: 0,
    nextAttemptAt: 0,
    ...over,
  };
}

function makeDeps(over: Partial<SyncDeps> & { queue: QueuedFrame[] }): {
  deps: SyncDeps;
  calls: { uploaded: string[]; deleted: string[]; failed: Array<[string, number]> };
} {
  const calls = { uploaded: [] as string[], deleted: [] as string[], failed: [] as Array<[string, number]> };
  const deps: SyncDeps = {
    listReady: async () => over.queue,
    fileExists: async () => true,
    upload: async () => 'ok',
    markUploaded: async (id) => {
      calls.uploaded.push(id);
    },
    deleteFile: async (p) => {
      calls.deleted.push(p);
    },
    markFailed: async (id, at) => {
      calls.failed.push([id, at]);
    },
    isOnline: () => true,
    now: () => 1_000_000,
    ...over,
  };
  return { deps, calls };
}

test('offline: does nothing', async () => {
  const { deps, calls } = makeDeps({ queue: [queued('a')], isOnline: () => false });
  expect(await runOnce(deps)).toEqual({ uploaded: 0, failed: 0 });
  expect(calls.uploaded).toEqual([]);
});

test('ok: deletes the file then removes the row (order matters — §3.3)', async () => {
  const { deps, calls } = makeDeps({ queue: [queued('a')] });
  const res = await runOnce(deps);
  expect(res.uploaded).toBe(1);
  expect(calls.deleted).toEqual(['/data/a.jpg']);
  expect(calls.uploaded).toEqual(['a']);
});

test('retry: keeps the row and schedules backoff from attempts', async () => {
  const { deps, calls } = makeDeps({
    queue: [queued('a', { attempts: 2 })],
    upload: async () => 'retry',
  });
  const res = await runOnce(deps);
  expect(res.failed).toBe(1);
  expect(calls.deleted).toEqual([]); // file NOT deleted on failure
  expect(calls.failed).toEqual([['a', nextAttemptAt(2, 1_000_000)]]);
});

test('orphan (file already gone): removes the row without uploading', async () => {
  const uploads: string[] = [];
  const { deps, calls } = makeDeps({
    queue: [queued('a')],
    fileExists: async () => false,
    upload: async (f) => {
      uploads.push(f.frame_id);
      return 'ok';
    },
  });
  await runOnce(deps);
  expect(uploads).toEqual([]); // never attempted an upload
  expect(calls.uploaded).toEqual(['a']); // but the row is cleaned up
});

test('connectivity dropping mid-batch stops the pass', async () => {
  let online = true;
  const { deps, calls } = makeDeps({
    queue: [queued('a'), queued('b')],
    isOnline: () => online,
    upload: async () => {
      online = false; // drops right after the first upload
      return 'ok';
    },
  });
  const res = await runOnce(deps);
  expect(res.uploaded).toBe(1);
  expect(calls.uploaded).toEqual(['a']); // 'b' left for next pass
});
