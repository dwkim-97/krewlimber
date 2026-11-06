import {expect, it} from 'vitest';
import request from 'supertest';
import {openDatabase} from '../server/db';
import {createAccount} from '../server/auth';
import {createApp} from '../server/app';
import {LEVELS, levelLabel} from '../src/consts/levels';
it('starts at level zero and restricts level changes to management within 0–11', async () => {
  const db = openDatabase(':memory:'),
    origin = 'http://localhost:4173';
  try {
    const user = await createAccount(db, {
      username: 'member',
      nickname: '회원',
      password: 'testpass',
      role: 'member',
      status: 'approved',
    });
    expect(user.level).toBe(0);
    await createAccount(db, {
      username: 'staff',
      nickname: '운영진',
      password: 'testpass',
      role: 'staff',
      status: 'approved',
    });
    const app = createApp({db, origin, secureCookies: false, trustProxy: false}),
      member = request.agent(app),
      staff = request.agent(app);
    for (const [agent, username] of [
      [member, 'member'],
      [staff, 'staff'],
    ] as const)
      await agent.post('/api/auth/login').set('Origin', origin).send({username, password: 'testpass'});
    await member
      .patch('/api/me')
      .set('Origin', origin)
      .send({nickname: '회원', bio: '', location: '', gym: '', grade: '입문', level: 11});
    expect((await member.get('/api/me')).body.user.level).toBe(0);
    const input = {role: 'member', status: 'approved', reason: '레벨 설정', level: 11};
    expect((await member.patch(`/api/admin/users/${user.id}`).set('Origin', origin).send(input)).status).toBe(403);
    for (const level of [-1, 12, 1.5, null, false, ''])
      expect(
        (
          await staff
            .patch(`/api/admin/users/${user.id}`)
            .set('Origin', origin)
            .send({...input, level})
        ).status
      ).toBe(400);
    expect((await staff.patch(`/api/admin/users/${user.id}`).set('Origin', origin).send(input)).status).toBe(200);
    expect((await member.get('/api/me/level')).body.level).toBe(11);
    expect((await member.get('/api/members')).body.members.find((m: {id: string}) => m.id === user.id).level).toBe(11);
    expect(LEVELS).toHaveLength(12);
    expect(levelLabel(11)).toBe('Lv.11 회색 1');
  } finally {
    db.close();
  }
});
