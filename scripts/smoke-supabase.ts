import {randomBytes} from 'node:crypto';
import {config} from 'dotenv';
import request from 'supertest';
import {createApp} from '../server/app';
import {hashToken} from '../server/auth';
import {openPostgresDatabase} from '../server/database';
import {supabaseImageStorage} from '../server/image-storage';
config({path: 'deploy/.env.production', quiet: true});
const db = openPostgresDatabase();
const token = randomBytes(32).toString('hex');
const tokenHash = hashToken(token);
try {
  if (!process.env.SMOKE_USERNAME) throw new Error('Set SMOKE_USERNAME to an existing approved member');
  const user = await db
    .prepare("SELECT id FROM users WHERE username=? AND status='approved'")
    .get(process.env.SMOKE_USERNAME);
  if (!user) throw new Error('Approved member not found');
  await db
    .prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)')
    .run(tokenHash, String(user.id), Date.now() + 60000);
  const app = createApp({
    db,
    origin: 'http://localhost:4175',
    secureCookies: false,
    trustProxy: false,
    imageStorage: supabaseImageStorage(),
  });
  for (const path of [
    '/api/me',
    '/api/members',
    '/api/titles',
    '/api/me/achievements',
    '/api/notices',
    '/api/market/products',
    '/api/me/wallet',
    '/api/me/orders',
  ]) {
    const response = await request(app).get(path).set('Cookie', `krew_session=${token}`);
    if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
    if (JSON.stringify(response.body).includes('passwordHash')) throw new Error('Unexpected credential disclosure');
    console.log(`PASS ${path}`);
  }
} finally {
  await db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(tokenHash);
  await db.close();
}
