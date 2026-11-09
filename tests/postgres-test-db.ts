import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase} from '../server/database';
export async function openPostgresTestDatabase() {
  const engine = new PGlite();
  await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  for (const file of readdirSync('supabase/migrations')
    .filter(f => /^\d+.*\.sql$/.test(f))
    .sort())
    await engine.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
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
