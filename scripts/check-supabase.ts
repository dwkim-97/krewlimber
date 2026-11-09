import {config} from 'dotenv';
import {environmentFile} from '../server/environment';
import {createPostgresPool} from '../server/postgres';
config({path: environmentFile({...process.env, PHASE: process.env.PHASE ?? 'production'}), quiet: true});
const pool = createPostgresPool();
try {
  await pool.query('SELECT 1');
  console.log('Supabase PostgreSQL connection verified (TLS certificate validation enabled).');
} catch (error) {
  console.error(
    'Supabase connection failed:',
    error && typeof error === 'object' && 'code' in error ? error.code : 'ConnectionError'
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
