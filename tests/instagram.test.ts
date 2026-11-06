import {afterAll, expect, it} from 'vitest';
import request from 'supertest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';

const db = openDatabase(':memory:');
const origin = 'http://localhost:4173';
const app = createApp({db, origin, secureCookies: false, trustProxy: false});
afterAll(() => db.close());

it('normalizes a climbing Instagram profile and shows it only to approved members', async () => {
  const password = 'a strong climbing password';
  const user = await createAccount(db, {
    username: 'insta.user',
    nickname: '인스타',
    password,
    role: 'member',
    status: 'approved',
  });
  expect(user).toHaveProperty('instagramUrl', '');
  const agent = request.agent(app);
  await agent.post('/api/auth/login').set('Origin', origin).send({username: user.username, password}).expect(200);
  const profile = {nickname: '인스타', bio: '', location: '', gym: '', grade: 'V3', instagramUrl: '@climb.aiden'};
  const saved = await agent.patch('/api/me').set('Origin', origin).send(profile).expect(200);
  expect(saved.body.user.instagramUrl).toBe('https://www.instagram.com/climb.aiden/');
  expect((await agent.get('/api/members')).body.members[0].instagramUrl).toBe(saved.body.user.instagramUrl);
  await request(app).get('/api/members').expect(401);
  for (const instagramUrl of [
    'javascript:alert(1)',
    'https://instagram.com.evil.test/user',
    'https://www.instagram.com/p/123/',
    'https://user:pass@instagram.com/user',
    'https://instagram.com/user?redirect=evil',
  ]) {
    await agent
      .patch('/api/me')
      .set('Origin', origin)
      .send({...profile, instagramUrl})
      .expect(400);
  }
  const removed = await agent
    .patch('/api/me')
    .set('Origin', origin)
    .send({...profile, instagramUrl: ''})
    .expect(200);
  expect(removed.body.user.instagramUrl).toBe('');
});
