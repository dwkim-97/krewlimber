import {readFileSync} from 'node:fs';
import {Pool, type PoolClient} from 'pg';

export function createPostgresPool(environment: NodeJS.ProcessEnv = process.env) {
  for (const name of ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) {
    if (!environment[name]) throw new Error(`Missing ${name}`);
  }
  return new Pool({
    host: environment.PGHOST,
    port: Number(environment.PGPORT ?? 6543),
    user: environment.PGUSER,
    password: environment.PGPASSWORD,
    database: environment.PGDATABASE,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync(new URL('../deploy/certs/supabase-ca.crt', import.meta.url), 'utf8'),
    },
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
}

export async function postgresTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
