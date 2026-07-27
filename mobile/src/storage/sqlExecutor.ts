/**
 * Minimal SQL execution seam. Pure interface with NO native import — so
 * frameRepo/migrations depend on this, and both the on-device driver (db.ts,
 * react-native-sqlite-storage) and the node:sqlite test adapter implement it.
 * This is what lets the storage layer be exercised in jest without a device.
 */

export type SqlRow = Record<string, unknown>;

export interface SqlExecutor {
  /** Run one SQL statement. Reads return rows; writes return an empty array. */
  execute(sql: string, params?: unknown[]): Promise<SqlRow[]>;
}
