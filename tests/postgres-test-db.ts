import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase} from '../server/database';
export async function openPostgresTestDatabase() {
  const engine = new PGlite();
  await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await engine.exec(readFileSync('supabase/migrations/202611060001_initial.sql', 'utf8'));
  await engine.exec(readFileSync('supabase/migrations/202611060002_rate_limits.sql', 'utf8'));
  const query = async (sql: string, values?: unknown[]) => {
    if (!values?.length && sql.includes(';')) {
      await engine.exec(sql);
      return {rows: [], rowCount: 0};
    }
    const r = await engine.query(sql, values);
    return {rows: r.rows as Record<string, unknown>[], rowCount: r.affectedRows ?? r.rows.length};
  };
  return new PostgresDatabase({query, connect: async () => ({query, release() {}}), end: async () => engine.close()});
}
