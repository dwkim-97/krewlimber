import {readFileSync, readdirSync} from 'node:fs';
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
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const file of readdirSync(directory)
      .filter(name => /^\d+.*\.sql$/.test(name))
      .sort()) {
      const version = file.split('_')[0];
      if ((await client.query('SELECT version FROM krew_schema_migrations WHERE version=$1', [version])).rowCount)
        continue;
      const source = readFileSync(new URL(file, directory), 'utf8');
      await client.query(source.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, ''));
      await client.query('INSERT INTO krew_schema_migrations(version) VALUES($1)', [version]);
    }
  });
  console.log('PostgreSQL migrations applied.');
} finally {
  await pool.end();
}
