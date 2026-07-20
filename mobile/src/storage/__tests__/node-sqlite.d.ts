/**
 * Minimal ambient types for Node's built-in SQLite — TEST ONLY.
 * RN's tsconfig intentionally excludes @types/node globals (they can clash with
 * React Native's own typings), so we declare just the sliver used by the
 * storage tests rather than pulling in all of @types/node.
 */
declare module 'node:sqlite' {
  export class StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
  export class DatabaseSync {
    constructor(path: string);
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}
