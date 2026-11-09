import {AsyncLocalStorage} from 'node:async_hooks';
import type {SQLInputValue} from 'node:sqlite';
import {createPostgresPool} from './postgres';

type Row = Record<string, unknown>;
type MaybePromise<T> = T | Promise<T>;
interface Statement {
  get(...values: SQLInputValue[]): MaybePromise<Row | undefined>;
  all(...values: SQLInputValue[]): MaybePromise<Row[]>;
  run(...values: SQLInputValue[]): MaybePromise<{changes: number | bigint}>;
}
export interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): MaybePromise<unknown>;
  close(): MaybePromise<void>;
}
export interface QueryResult {
  rows: Row[];
  rowCount: number | null;
}
export interface QueryClient {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface QueryPool {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  connect(): Promise<QueryClient>;
  end(): Promise<void>;
}
const camelNames =
  'brandName branchName sortOrder difficultyRank gradeName conditionId placeId gymId gradeId visitedOn visitId gymName fullName passwordHash createdAt updatedAt tokenHash userId expiresAt achievedAt createdBy actorId targetId achievementId authorId imageUrl productId productName requestId orderId'.split(
    ' '
  );
const names = new Map(camelNames.map(name => [name.toLowerCase(), name]));

export function postgresSql(sql: string): string {
  let index = 0;
  let quoted = false;
  let result = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      result += c;
      if (quoted && sql[i + 1] === "'") {
        result += sql[++i];
        continue;
      }
      quoted = !quoted;
    } else result += c === '?' && !quoted ? `$${++index}` : c;
  }
  result = result.replace(/\s+COLLATE NOCASE/gi, '').replace(/ORDER BY rowid/gi, 'ORDER BY sortOrder');
  // PostgreSQL LIKE is case sensitive; retain the existing search behavior.
  result = result.replace(/\bLIKE\b/g, 'ILIKE');
  if (/INSERT OR IGNORE/i.test(result))
    result = result.replace(/INSERT OR IGNORE/i, 'INSERT') + ' ON CONFLICT DO NOTHING';
  return result;
}
export class PostgresDatabase implements Database {
  private readonly current = new AsyncLocalStorage<QueryClient>();
  constructor(private readonly pool: QueryPool) {}
  private async query(sql: string, values: SQLInputValue[] = []) {
    const result = await (this.current.getStore() ?? this.pool).query(postgresSql(sql), values);
    return {
      ...result,
      rows: result.rows.map(row =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => {
            const name = names.get(key) ?? key;
            if (
              typeof value === 'string' &&
              ['count', 'total', 'n', 'balance', 'value', 'expiresAt', 'id', 'amount', 'quantity'].includes(name) &&
              /^-?\d+$/.test(value)
            ) {
              const number = Number(value);
              if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds safe range');
              // IDs in application tables are UUID strings; numeric IDs belong to ledger/audit rows.
              return [name, number];
            }
            return [name, value];
          })
        )
      ),
    };
  }
  prepare(sql: string): Statement {
    return {
      get: async (...values) => (await this.query(sql, values)).rows[0],
      all: async (...values) => (await this.query(sql, values)).rows,
      run: async (...values) => ({changes: (await this.query(sql, values)).rowCount ?? 0}),
    };
  }
  async exec(sql: string) {
    await this.query(sql);
  }
  async close() {
    await this.pool.end();
  }
  async transaction<T>(work: () => MaybePromise<T>): Promise<T> {
    if (this.current.getStore()) return work();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Keep the original single-writer semantics across all serverless instances.
      await client.query('SELECT pg_advisory_xact_lock(673810242)');
      const value = await this.current.run(client, work);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
const sqliteQueues = new WeakMap<Database, Promise<void>>();
export async function transaction<T>(db: Database, work: () => MaybePromise<T>): Promise<T> {
  if (db instanceof PostgresDatabase) return db.transaction(work);
  const previous = sqliteQueues.get(db) ?? Promise.resolve();
  let unlock!: () => void;
  const next = new Promise<void>(resolve => {
    unlock = resolve;
  });
  sqliteQueues.set(db, next);
  await previous;
  try {
    await db.exec('BEGIN IMMEDIATE');
    try {
      const result = await work();
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    unlock();
    if (sqliteQueues.get(db) === next) sqliteQueues.delete(db);
  }
}
export function openPostgresDatabase(environment: NodeJS.ProcessEnv = process.env) {
  return new PostgresDatabase(createPostgresPool(environment));
}
