import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import request from 'supertest';
Object.assign(process.env, {
  VERCEL: '1',
  APP_ORIGIN: 'https://deployment-check.example',
  PGHOST: 'deployment-check.invalid',
  PGPORT: '6543',
  PGDATABASE: 'postgres',
  PGUSER: 'check',
  PGPASSWORD: 'check',
  SUPABASE_URL: 'https://deployment-check.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_deployment_check',
});
const {default: app} = await import('../api/index.mjs');
const health = await request(app).get('/api/health');
assert.equal(health.status, 200);
assert.deepEqual(health.body, {status: 'ok'});
const current = await request(app).get('/api/me');
assert.equal(current.status, 200);
assert.deepEqual(current.body, {user: null});
console.log('Built Vercel function verified with native Node ESM.');
