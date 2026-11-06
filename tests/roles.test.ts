import {randomBytes} from 'node:crypto';
import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {createAccount, hashToken} from '../server/auth';
import {openPostgresTestDatabase} from './postgres-test-db';

it('gives staff and administrators the same management access while denying ordinary members', async () => {
  const db = await openPostgresTestDatabase();
  try {
    const users = [];
    for (const role of ['member', 'staff', 'admin'] as const) {
      const user = await createAccount(db, {
        username: `role.${role}`,
        password: '1234',
        nickname: role,
        role,
        status: 'approved',
      });
      const token = randomBytes(32).toString('hex');
      await db
        .prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)')
        .run(hashToken(token), user.id, Date.now() + 60000);
      users.push({user, cookie: `krew_session=${token}`});
    }
    const app = createApp({db, origin: 'http://localhost:4173', secureCookies: false, trustProxy: false});
    for (const {user, cookie} of users) {
      const status = user.role === 'member' ? 403 : 200;
      expect((await request(app).get('/api/admin/users').set('Cookie', cookie)).status).toBe(status);
      expect((await request(app).get('/api/admin/progression').set('Cookie', cookie)).status).toBe(status);
      expect((await request(app).get('/api/admin/market/products').set('Cookie', cookie)).status).toBe(status);
      expect(
        (
          await request(app)
            .post('/api/admin/notices')
            .set('Origin', 'http://localhost:4173')
            .set('Cookie', cookie)
            .send({title: '운영 공지', body: '모임 안내', pinned: false})
        ).status
      ).toBe(user.role === 'member' ? 403 : 201);
    }
    const staff = users.find(x => x.user.role === 'staff')!;
    const member = users.find(x => x.user.role === 'member')!;
    expect(
      (
        await request(app)
          .post('/api/admin/market/products')
          .set('Origin', 'http://localhost:4173')
          .set('Cookie', staff.cookie)
          .send({
            name: '테스트 상품',
            description: '운영진 등록',
            imageUrl: null,
            category: 'gear',
            points: 100,
            stock: 1,
            active: true,
          })
      ).status
    ).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/admin/users/${member.user.id}/recovery`)
          .set('Origin', 'http://localhost:4173')
          .set('Cookie', staff.cookie)
      ).status
    ).toBe(201);

    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${member.user.id}`)
          .set('Origin', 'http://localhost:4173')
          .set('Cookie', staff.cookie)
          .send({role: 'staff', status: 'approved', reason: '운영진 지정'})
      ).status
    ).toBe(200);
    expect((await db.prepare('SELECT role FROM users WHERE id=?').get(member.user.id))!.role).toBe('staff');
    const admin = users.find(x => x.user.role === 'admin')!;
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${admin.user.id}`)
          .set('Origin', 'http://localhost:4173')
          .set('Cookie', staff.cookie)
          .send({role: 'staff', status: 'approved', reason: '변경'})
      ).status
    ).toBe(409);
  } finally {
    await db.close();
  }
}, 30000);
