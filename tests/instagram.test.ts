import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import type {Database} from '../server/database';
import {openDatabase} from '../server/db';
import {openPostgresTestDatabase} from './postgres-test-db';

const origin = 'http://localhost:4173';
const password = 'instagram test password';
const profile = {nickname: '인스타', bio: '함께 올라요', location: '판교', gym: '더클라임', grade: 'V3'};

describe.each([
  ['SQLite', () => openDatabase(':memory:')],
  ['PostgreSQL', openPostgresTestDatabase],
] as const)('Instagram profile on %s', (_, open) => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  beforeAll(async () => {
    db = await open();
    app = createApp({db, origin, secureCookies: false, trustProxy: false});
    await createAccount(db, {
      username: 'insta.user',
      nickname: '인스타',
      fullName: '홍길동',
      password,
      role: 'member',
      status: 'approved',
    });
    agent = request.agent(app);
    await agent.post('/api/auth/login').set('Origin', origin).send({username: 'insta.user', password}).expect(200);
  }, 30000);
  afterAll(async () => db?.close());

  it('returns an empty Instagram string for new profiles', async () => {
    expect((await agent.get('/api/me')).body.user.instagramUrl).toBe('');
  });

  it('normalizes handles and profile URLs and preserves omitted values for older clients', async () => {
    for (const instagramUrl of ['Climb.Aiden', '@Climb.Aiden', 'https://instagram.com/Climb.Aiden/']) {
      const saved = await agent
        .patch('/api/me')
        .set('Origin', origin)
        .send({...profile, instagramUrl})
        .expect(200);
      expect(saved.body.user).toMatchObject({
        ...profile,
        fullName: '홍길동',
        instagramUrl: 'https://www.instagram.com/climb.aiden/',
      });
    }
    await agent.patch('/api/me').set('Origin', origin).send(profile).expect(200);
    expect((await agent.get('/api/me')).body.user.instagramUrl).toBe('https://www.instagram.com/climb.aiden/');
    expect((await agent.get('/api/members')).body.members[0].instagramUrl).toBe(
      'https://www.instagram.com/climb.aiden/'
    );
    const cleared = await agent
      .patch('/api/me')
      .set('Origin', origin)
      .send({...profile, instagramUrl: ''})
      .expect(200);
    expect(cleared.body.user.instagramUrl).toBe('');
  });

  it('rejects non-profile links and malformed handles without changing the saved profile', async () => {
    await agent
      .patch('/api/me')
      .set('Origin', origin)
      .send({...profile, instagramUrl: '@safe_handle'})
      .expect(200);
    for (const instagramUrl of [
      'javascript:alert(1)',
      'http://instagram.com/user',
      'https://instagram.com.evil.test/user',
      'https://user:pass@instagram.com/user',
      'https://instagram.com/user?redirect=evil',
      'https://instagram.com/user#fragment',
      'https://instagram.com:1234/user',
      'https://instagram.com/p/123/',
      'https://instagram.com/reels/',
      'https://instagram.com/accounts/',
      '@explore',
      'two..dots',
      '.leading',
      'trailing.',
      'a'.repeat(31),
      null,
    ]) {
      const response = await agent
        .patch('/api/me')
        .set('Origin', origin)
        .send({...profile, instagramUrl});
      expect(response.status, String(instagramUrl)).toBe(400);
    }
    expect((await agent.get('/api/me')).body.user.instagramUrl).toBe('https://www.instagram.com/safe_handle/');
  });

  it('keeps Instagram links behind approved member access', async () => {
    await request(app).get('/api/members').expect(401);
    await db.prepare("UPDATE users SET status='pending' WHERE username=?").run('insta.user');
    await agent.get('/api/members').expect(403);
  });
});
