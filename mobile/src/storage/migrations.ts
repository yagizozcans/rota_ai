import type { SqlExecutor } from './sqlExecutor';

/**
 * Versioned schema migrations, tracked via SQLite's `PRAGMA user_version`.
 * Each entry is the list of statements for that version; index i => version i+1.
 * To evolve the schema, append a new array — never edit a shipped one.
 */
export const MIGRATIONS: string[][] = [
  // ---- v1: the local frame outbox ----
  [
    `CREATE TABLE IF NOT EXISTS frames (
       frame_id        TEXT PRIMARY KEY NOT NULL,
       org_id          TEXT NOT NULL,
       session_id      TEXT NOT NULL,
       device_id       TEXT NOT NULL,
       timestamp       TEXT NOT NULL,
       lat             REAL NOT NULL,
       lon             REAL NOT NULL,
       accuracy_m      REAL NOT NULL,
       speed_kmh       REAL NOT NULL,
       heading_deg     REAL NOT NULL,
       image_ref       TEXT NOT NULL,
       local_path      TEXT NOT NULL,
       attempts        INTEGER NOT NULL DEFAULT 0,
       next_attempt_at INTEGER NOT NULL DEFAULT 0
     )`,
    // listReady() orders the due queue by this column; index keeps it cheap.
    `CREATE INDEX IF NOT EXISTS idx_frames_next_attempt ON frames(next_attempt_at)`,
  ],
];

/**
 * Apply any migrations newer than the DB's current `user_version`, in order,
 * bumping the version after each. Idempotent: a fully-migrated DB is a no-op.
 */
export async function runMigrations(db: SqlExecutor): Promise<void> {
  const rows = await db.execute('PRAGMA user_version');
  const current = Number(rows[0]?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version++) {
    for (const statement of MIGRATIONS[version]) {
      await db.execute(statement);
    }
    // PRAGMA can't be parameterised; version is a controlled loop integer.
    await db.execute(`PRAGMA user_version = ${version + 1}`);
  }
}
