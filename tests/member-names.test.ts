import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {openPostgresTestDatabase} from './postgres-test-db';

it('stores a Korean signup name separately from nickname and exposes it in own profile and members', async () => {
  const db = await openPostgresTestDatabase();
  try {
    const origin = 'http://localhost:4173';
    const app = createApp({db, origin, secureCookies: false, trustProxy: false});
    const agent = request.agent(app);
    const signedUp = await agent
      .post('/api/auth/signup')
      .set('Origin', origin)
      .send({username: 'name.member', password: '1234', nickname: '클라이머', fullName: '김성수'});
    expect(signedUp.status).toBe(201);
    expect(signedUp.body.user).toMatchObject({fullName: '김성수', nickname: '클라이머'});
    expect((await agent.get('/api/me')).body.user.fullName).toBe('김성수');
    await db.prepare("UPDATE users SET status='approved' WHERE username=?").run('name.member');
    expect((await agent.get('/api/members')).body.members[0]).toMatchObject({fullName: '김성수', nickname: '클라이머'});
    const profile = {nickname: '새닉네임', bio: '', location: '', gym: '', grade: '입문'};
    expect((await agent.patch('/api/me').set('Origin', origin).send(profile)).status).toBe(200);
    expect((await agent.get('/api/me')).body.user.fullName).toBe('김성수');
    const updated = await agent
      .patch('/api/me')
      .set('Origin', origin)
      .send({...profile, fullName: '김선우'});
    expect(updated.status).toBe(200);
    expect(updated.body.user.fullName).toBe('김선우');
  } finally {
    await db.close();
  }
}, 30000);

it('requires a Korean name at signup', async () => {
  const db = await openPostgresTestDatabase();
  try {
    const app = createApp({db, origin: 'http://localhost:4173', secureCookies: false, trustProxy: false});
    for (const [index, fullName] of [undefined, '', 'John', '김'.repeat(31)].entries()) {
      const response = await request(app)
        .post('/api/auth/signup')
        .set('Origin', 'http://localhost:4173')
        .send({username: `invalid.name${index}`, password: '1234', nickname: '크루', fullName});
      expect(response.status).toBe(400);
    }
  } finally {
    await db.close();
  }
}, 30000);
