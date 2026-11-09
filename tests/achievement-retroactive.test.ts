import {expect, it} from 'vitest';
import request from 'supertest';
import {openDatabase} from '../server/db';
import {createAccount} from '../server/auth';
import {createApp} from '../server/app';
import {setActivityCounts} from '../server/progression';
it('reads persisted achievements from pre-existing member history', async () => {
  const db = openDatabase(':memory:'),
    origin = 'http://localhost:4173';
  try {
    const old = await createAccount(db, {
      username: 'oldmember',
      nickname: '기존회원',
      password: 'testpass',
      role: 'member',
      status: 'approved',
    });
    await setActivityCounts(db, old.id, '2026-Q4', {
      participation: 15,
      hosted: 0,
      attended: 0,
      red: 20,
      pink: 0,
      purple: 0,
    });
    await createAccount(db, {
      username: 'manager',
      nickname: '관리자',
      password: 'testpass',
      role: 'admin',
      status: 'approved',
    });
    const app = createApp({db, origin, secureCookies: false, trustProxy: false}),
      admin = request.agent(app),
      member = request.agent(app);
    for (const [agent, username] of [
      [admin, 'manager'],
      [member, 'oldmember'],
    ] as const)
      await agent.post('/api/auth/login').set('Origin', origin).send({username, password: 'testpass'});
    await db
      .prepare('INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES(?,?,?,?,?)')
      .run('persisted', '저장된 업적', '빨강 10개', 'red', 10);
    const collection = (await member.get('/api/me/achievements')).body;
    expect(collection.achievements.find((a: {id: string}) => a.id === 'persisted')).toMatchObject({
      earned: true,
      progress: 20,
      target: 10,
    });
  } finally {
    db.close();
  }
});
