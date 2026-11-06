import {expect, it} from 'vitest';
import request from 'supertest';
import {openDatabase} from '../server/db';
import {createAccount} from '../server/auth';
import {createApp} from '../server/app';
it('returns approved member roles and actual point balances without inventing rating or level', async () => {
  const db = openDatabase(':memory:');
  const origin = 'http://localhost:4173';
  try {
    const user = await createAccount(db, {
      username: 'leader',
      nickname: '운영진',
      password: 'testpass',
      role: 'staff',
      status: 'approved',
    });
    await db
      .prepare('INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt) VALUES(?,?,?,?,?,?)')
      .run(user.id, 120, '테스트', user.id, 'grant', new Date().toISOString());
    const app = createApp({db, origin, secureCookies: false, trustProxy: false}),
      agent = request.agent(app);
    expect((await request(app).get('/api/members')).status).toBe(401);
    await agent.post('/api/auth/login').set('Origin', origin).send({username: 'leader', password: 'testpass'});
    expect((await agent.get('/api/members')).body.members[0]).toMatchObject({
      role: 'staff',
      points: 120,

      level: 0,
    });
  } finally {
    db.close();
  }
});
