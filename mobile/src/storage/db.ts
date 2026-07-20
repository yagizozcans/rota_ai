import SQLite, { type SQLiteDatabase } from 'react-native-sqlite-storage';
import { runMigrations } from './migrations';
import type { SqlExecutor, SqlRow } from './sqlExecutor';

/**
 * On-device storage driver: opens the SQLite database via
 * react-native-sqlite-storage and adapts it to the pure {@link SqlExecutor}
 * seam the rest of the storage layer depends on. Native — not used in tests
 * (those drive the same SQL through a node:sqlite adapter instead).
 */

const DB_NAME = 'rotaai.db';

function toExecutor(db: SQLiteDatabase): SqlExecutor {
  return {
    async execute(sql: string, params: unknown[] = []): Promise<SqlRow[]> {
      const [result] = await db.executeSql(sql, params);
      const out: SqlRow[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        out.push(result.rows.item(i) as SqlRow);
      }
      return out;
    },
  };
}

let cached: SqlExecutor | null = null;

/** Open (once) the migrated local database. Safe to call repeatedly. */
export async function openStorage(): Promise<SqlExecutor> {
  if (cached) {
    return cached;
  }
  SQLite.enablePromise(true);
  const db = await SQLite.openDatabase({ name: DB_NAME, location: 'default' });
  const executor = toExecutor(db);
  await runMigrations(executor);
  cached = executor;
  return executor;
}
