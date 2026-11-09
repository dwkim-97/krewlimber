import {DatabaseSync, backup} from 'node:sqlite';
import {mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {config} from 'dotenv';
import {createPostgresPool, postgresTransaction} from '../server/postgres';
import {supabaseImageStorage} from '../server/image-storage';
config({path: 'deploy/.env.production', quiet: true});
const sourcePath = resolve(process.env.IMPORT_SQLITE_PATH ?? 'data/krewlimber.sqlite');
const source = new DatabaseSync(sourcePath, {readOnly: true});
const pool = createPostgresPool();
const tables = [
  'users',
  'honors',
  'activityStats',
  'achievementDefinitions',
  'featuredAchievements',
  'notices',
  'marketProducts',
  'marketOrders',
  'pointLedger',
  'auditLog',
];
try {
  mkdirSync('data/backups', {recursive: true, mode: 0o700});
  await backup(source, resolve(`data/backups/before-supabase-${Date.now()}.sqlite`));
  source.exec('BEGIN');
  const snapshot = new Map(tables.map(table => [table, source.prepare(`SELECT * FROM ${table}`).all()]));
  source.exec('COMMIT');
  const storage = supabaseImageStorage();
  const uploads = resolve(process.env.IMPORT_UPLOADS_DIR ?? 'data/uploads');
  let images = 0;
  try {
    for (const name of readdirSync(uploads).filter(name => /^[a-f0-9]{64}\.webp$/.test(name))) {
      await storage.put(name, readFileSync(resolve(uploads, name)));
      images++;
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  await postgresTransaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(673810242)');
    if (Number((await client.query('SELECT count(*) AS n FROM users')).rows[0].n) !== 0)
      throw new Error('Target contains users; refusing to overwrite existing data');
    await client.query('DELETE FROM achievementDefinitions');
    for (const table of tables) {
      for (const row of snapshot.get(table)!) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(',');
        const override = ['auditLog', 'pointLedger'].includes(table) ? ' OVERRIDING SYSTEM VALUE' : '';
        const conflict =
          table === 'achievementDefinitions'
            ? ' ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,metric=excluded.metric,target=excluded.target'
            : '';
        await client.query(
          `INSERT INTO ${table}(${columns.join(',')})${override} VALUES(${placeholders})${conflict}`,
          values
        );
      }
    }
    for (const table of ['auditlog', 'pointledger'])
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),GREATEST(COALESCE((SELECT MAX(id) FROM ${table}),0),1),(SELECT COUNT(*)>0 FROM ${table}))`
      );
  });
  console.log(
    JSON.stringify({
      imported: Object.fromEntries([...snapshot].map(([table, rows]) => [table, rows.length])),
      images,
      sessionsImported: false,
    })
  );
} finally {
  source.close();
  await pool.end();
}
