import { DatabaseSync } from 'node:sqlite';
import { runMigrations, MIGRATIONS } from '../migrations';
import type { SqlExecutor, SqlRow } from '../sqlExecutor';
import {
  countPending,
  enqueue,
  listReady,
  markFailed,
  markUploaded,
} from '../frameRepo';
import type { CaptureFrame } from '../../types/captureFrame';

/**
 * Exercises the REAL schema and repo SQL against Node's built-in SQLite — the
 * same statements the device runs via react-native-sqlite-storage — so the
 * storage layer is verified without an Android device.
 */
function makeExecutor(db: DatabaseSync): SqlExecutor {
  const isWrite = (sql: string) =>
    /^\s*(insert|update|delete|create)/i.test(sql) ||
    (/^\s*pragma/i.test(sql) && sql.includes('='));
  return {
    async execute(sql: string, params: unknown[] = []): Promise<SqlRow[]> {
      const stmt = db.prepare(sql);
      if (isWrite(sql)) {
        stmt.run(...(params as never[]));
        return [];
      }
      return stmt.all(...(params as never[])) as SqlRow[];
    },
  };
}

function frame(id: string, timestamp: string): CaptureFrame {
  return {
    frame_id: id,
    org_id: 'org-1',
    session_id: 'sess-1',
    device_id: 'dev-1',
    timestamp,
    gps: { lat: 41.01, lon: 28.97, accuracy_m: 4.2, speed_kmh: 48 },
    heading_deg: 275,
    image_ref: `org-1/sess-1/${id}.jpg`,
  };
}

let db: DatabaseSync;
let exec: SqlExecutor;

beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  exec = makeExecutor(db);
  await runMigrations(exec);
});

afterEach(() => db.close());

test('migrations set user_version and are idempotent', async () => {
  const [{ user_version: v1 }] = (await exec.execute('PRAGMA user_version')) as Array<{
    user_version: number;
  }>;
  expect(v1).toBe(MIGRATIONS.length);
  await runMigrations(exec); // second run is a no-op
  const [{ user_version: v2 }] = (await exec.execute('PRAGMA user_version')) as Array<{
    user_version: number;
  }>;
  expect(v2).toBe(MIGRATIONS.length);
});

test('enqueue then listReady round-trips a frame with nested gps', async () => {
  await enqueue(exec, frame('f1', '2026-07-20T10:00:00Z'), '/data/f1.jpg');
  expect(await countPending(exec)).toBe(1);

  const [q] = await listReady(exec, Date.now(), 10);
  expect(q.frame.gps).toEqual({ lat: 41.01, lon: 28.97, accuracy_m: 4.2, speed_kmh: 48 });
  expect(q.frame.image_ref).toBe('org-1/sess-1/f1.jpg');
  expect(q.localPath).toBe('/data/f1.jpg');
  expect(q.attempts).toBe(0);
});

test('listReady returns oldest-first and respects the limit', async () => {
  await enqueue(exec, frame('b', '2026-07-20T10:00:02Z'), '/b.jpg');
  await enqueue(exec, frame('a', '2026-07-20T10:00:01Z'), '/a.jpg');
  await enqueue(exec, frame('c', '2026-07-20T10:00:03Z'), '/c.jpg');

  const ids = (await listReady(exec, Date.now(), 2)).map((q) => q.frame.frame_id);
  expect(ids).toEqual(['a', 'b']);
});

test('markFailed backs the frame off until next_attempt_at, then it returns', async () => {
  await enqueue(exec, frame('f1', '2026-07-20T10:00:00Z'), '/f1.jpg');
  const now = 1_000_000;
  await markFailed(exec, 'f1', now + 5000);

  expect(await listReady(exec, now, 10)).toHaveLength(0); // not yet due
  const [due] = await listReady(exec, now + 5000, 10); // due now
  expect(due.frame.frame_id).toBe('f1');
  expect(due.attempts).toBe(1);
});

test('markUploaded removes the frame from the outbox', async () => {
  await enqueue(exec, frame('f1', '2026-07-20T10:00:00Z'), '/f1.jpg');
  await markUploaded(exec, 'f1');
  expect(await countPending(exec)).toBe(0);
});
