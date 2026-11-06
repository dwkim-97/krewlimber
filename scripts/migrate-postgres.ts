import {readFileSync} from 'node:fs';
import {config} from 'dotenv';
import {environmentFile} from '../server/environment';
import {createPostgresPool, postgresTransaction} from '../server/postgres';
config({path: environmentFile({...process.env, PHASE: process.env.PHASE ?? 'production'}), quiet: true});
const pool = createPostgresPool();
try {
  await postgresTransaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(673810241)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS krew_schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    await client.query('ALTER TABLE krew_schema_migrations ENABLE ROW LEVEL SECURITY');
    await client.query('REVOKE ALL ON TABLE krew_schema_migrations FROM anon, authenticated');
    const version = '202611060001';
    if ((await client.query('SELECT version FROM krew_schema_migrations WHERE version=$1', [version])).rowCount) return;
    const source = readFileSync(new URL('../supabase/migrations/202611060001_initial.sql', import.meta.url), 'utf8');
    await client.query(source.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, ''));
    await client.query('INSERT INTO krew_schema_migrations(version) VALUES($1)', [version]);
  });
  console.log('PostgreSQL migrations applied.');
} finally {
  await pool.end();
}
