import {randomBytes, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {createApp} from '../server/app';
import {hashToken} from '../server/auth';
import {openDatabase} from '../server/db';

const origin = 'http://localhost:4173';
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;
let uploadsDir: string;
let admin: string;
let member: string;
let pending: string;
function account(role: 'admin' | 'member', status: 'approved' | 'pending') {
  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES(?,?,?,?,?,?,?)').run(
    id,
    id,
    'unused',
    id,
    role,
    status,
    new Date().toISOString()
  );
  db.prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)').run(
    hashToken(token),
    id,
    Date.now() + 60000
  );
  return `krew_session=${token}`;
}
beforeEach(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), 'krew-market-images-'));
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false, uploadsDir});
  admin = account('admin', 'approved');
  member = account('member', 'approved');
  pending = account('member', 'pending');
});
afterEach(async () => {
  db.close();
  await rm(uploadsDir, {recursive: true, force: true});
});
async function image() {
  return sharp({create: {width: 30, height: 20, channels: 3, background: '#badd66'}})
    .png()
    .toBuffer();
}
function upload(cookie: string, bytes: Buffer, type: string) {
  return request(app)
    .post('/api/admin/market/images')
    .set('Origin', origin)
    .set('Cookie', cookie)
    .set('Content-Type', type)
    .send(bytes);
}
it('requires approved administrators and the same origin before accepting uploads', async () => {
  const bytes = await image();
  expect((await upload('', bytes, 'image/png')).status).toBe(401);
  expect((await upload(member, bytes, 'image/png')).status).toBe(403);
  expect((await upload(pending, bytes, 'image/png')).status).toBe(403);
  expect(
    (
      await request(app)
        .post('/api/admin/market/images')
        .set('Cookie', admin)
        .set('Origin', 'https://other.example')
        .set('Content-Type', 'image/png')
        .send(bytes)
    ).status
  ).toBe(403);
  expect(await readdir(uploadsDir)).toEqual([]);
});
it('stores a decoded WebP in the configured directory, deduplicates it and serves it only to members', async () => {
  const bytes = await image();
  const first = await upload(admin, bytes, 'image/png');
  expect(first.status).toBe(201);
  expect(first.body.imageUrl).toMatch(/^\/api\/market\/images\/[a-f0-9]{64}\.webp$/);
  const file = first.body.imageUrl.split('/').at(-1);
  const metadata = await sharp(await readFile(join(uploadsDir, file))).metadata();
  expect(metadata).toMatchObject({format: 'webp', width: 30, height: 20});
  expect(metadata.exif).toBeUndefined();
  expect((await upload(admin, bytes, 'image/png')).body.imageUrl).toBe(first.body.imageUrl);
  expect(await readdir(uploadsDir)).toHaveLength(1);
  expect((await request(app).get(first.body.imageUrl)).status).toBe(401);
  expect((await request(app).get(first.body.imageUrl).set('Cookie', pending)).status).toBe(403);
  const loaded = await request(app).get(first.body.imageUrl).set('Cookie', member);
  expect(loaded.status).toBe(200);
  expect(loaded.headers['content-type']).toContain('image/webp');
  expect(loaded.headers['cache-control']).toContain('no-store');
});
it('rejects unsupported, malformed, empty, oversized and excessive-pixel images without saving files', async () => {
  expect((await upload(admin, Buffer.from('<svg/>'), 'image/svg+xml')).status).toBe(415);
  expect((await upload(admin, Buffer.from('not an image'), 'image/png')).status).toBe(400);
  expect((await upload(admin, Buffer.alloc(0), 'image/png')).status).toBe(400);
  expect((await upload(admin, Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png')).status).toBe(413);
  const huge = await sharp({create: {width: 6000, height: 6000, channels: 3, background: 'white'}})
    .png()
    .toBuffer();
  expect((await upload(admin, huge, 'image/png')).status).toBe(400);
  expect(await readdir(uploadsDir)).toEqual([]);
});
it('resizes large valid images and does not expose arbitrary files or a missing image', async () => {
  const bytes = await sharp({create: {width: 2400, height: 1200, channels: 3, background: 'white'}})
    .jpeg()
    .toBuffer();
  const result = await upload(admin, bytes, 'image/jpeg');
  expect(result.status).toBe(201);
  const data = await request(app).get(result.body.imageUrl).set('Cookie', member);
  expect(await sharp(data.body).metadata()).toMatchObject({width: 1800, height: 900});
  expect((await request(app).get('/api/market/images/not-a-file').set('Cookie', member)).status).toBe(404);
  expect(
    (
      await request(app)
        .get(`/api/market/images/${'f'.repeat(64)}.webp`)
        .set('Cookie', member)
    ).status
  ).toBe(404);
});

it('allows local image previews in the production content security policy', async () => {
  const productionApp = createApp({
    db,
    origin: 'https://crew.example',
    secureCookies: true,
    trustProxy: false,
    uploadsDir,
  });
  const response = await request(productionApp).get('/api/health');
  expect(response.headers['content-security-policy']).toMatch(/img-src[^;]*blob:/);
});
