import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';

const origin = 'http://localhost:4173';
const password = 'a strong climbing passphrase';
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false});
});
afterEach(() => db.close());

async function account(username: string, role: 'member' | 'admin', status: 'pending' | 'approved') {
  return await createAccount(db, {fullName: '홍길동', username, password, nickname: username, role, status});
}

async function login(username: string) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').set('Origin', origin).send({username, password});
  expect(response.status).toBe(200);
  return agent;
}

describe('own-account authentication', () => {
  it('keeps different clients behind an explicitly trusted proxy in separate signup buckets', async () => {
    app = createApp({db, origin, secureCookies: false, trustProxy: 'loopback'});
    for (let i = 0; i < 6; i++) {
      const response = await request(app)
        .post('/api/auth/signup')
        .set('Origin', origin)
        .set('X-Forwarded-For', `203.0.113.${i + 1}`)
        .send({fullName: '홍길동', username: `climber${i}`, nickname: `크루${i}`, password});
      expect(response.status).toBe(201);
    }
  });

  it('does not let one members password failures block another member on the same network', async () => {
    await account('aiden.dw', 'member', 'approved');
    await account('other.member', 'member', 'approved');
    const first = await login('aiden.dw');
    const second = await login('other.member');
    for (let i = 0; i < 15; i++) {
      await first
        .patch('/api/me/password')
        .set('Origin', origin)
        .send({currentPassword: 'incorrect current password', newPassword: 'new climbing passphrase'});
    }
    expect(
      (
        await second
          .patch('/api/me/password')
          .set('Origin', origin)
          .send({currentPassword: password, newPassword: 'new climbing passphrase'})
      ).status
    ).toBe(200);
  }, 15000);
  it('creates a pending account without email, hashes password and retains its session', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/auth/signup')
      .set('Origin', origin)
      .send({
        fullName: '홍길동',
        username: 'Aiden.DW',
        password,
        nickname: '에이든',
        role: 'admin',
        status: 'approved',
      });
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({username: 'aiden.dw', status: 'pending', role: 'member'});
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    const stored = (await db.prepare('SELECT passwordHash FROM users').get()) as {passwordHash: string};
    expect(stored.passwordHash).not.toBe(password);
    const session = await agent.get('/api/me');
    expect(session.body.user.username).toBe('aiden.dw');
    expect((await agent.get('/api/members')).status).toBe(403);
  });

  it('accepts a four-character signup password and allows logging in with it', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .set('Origin', origin)
      .send({fullName: '홍길동', username: 'short.pass', password: '1234', nickname: '새회원'});
    expect(response.status).toBe(201);
    expect(response.body.user.status).toBe('pending');
    const loggedIn = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({username: 'short.pass', password: '1234'});
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.username).toBe('short.pass');
  });

  it('rejects malformed and duplicate IDs and weak passwords', async () => {
    for (const data of [
      {fullName: '홍길동', username: 'a b', password, nickname: '에이든'},
      {fullName: '홍길동', username: 'aiden.dw', password: '123', nickname: '에이든'},
      {fullName: '홍길동', username: 'aiden.dw', password, nickname: ''},
    ]) {
      expect((await request(app).post('/api/auth/signup').set('Origin', origin).send(data)).status).toBe(400);
    }
    await account('aiden.dw', 'member', 'pending');
    expect(
      (
        await request(app)
          .post('/api/auth/signup')
          .set('Origin', origin)
          .send({fullName: '홍길동', username: 'AIDEN.DW', password, nickname: '새회원'})
      ).status
    ).toBe(409);
  });

  it('rejects incorrect credentials and returns no private profile to anonymous callers', async () => {
    await account('aiden.dw', 'member', 'approved');
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({username: 'aiden.dw', password: 'incorrect password'});
    expect(response.status).toBe(401);
    expect((await request(app).get('/api/me')).body.user).toBeNull();
    expect((await request(app).get('/api/members')).status).toBe(401);
  });

  it('revokes a session on logout and rejects expired sessions', async () => {
    await account('aiden.dw', 'member', 'approved');
    const agent = await login('aiden.dw');
    const cookie = (
      await request(app).post('/api/auth/login').set('Origin', origin).send({username: 'aiden.dw', password})
    ).headers['set-cookie'].at(-1)!;
    expect((await agent.post('/api/auth/logout').set('Origin', origin)).status).toBe(200);
    expect((await agent.get('/api/me')).body.user).toBeNull();
    await db.prepare('UPDATE sessions SET expiresAt = 0').run();
    expect((await request(app).get('/api/me').set('Cookie', cookie)).body.user).toBeNull();
  });

  it('rejects cross-site and missing-origin mutation requests', async () => {
    const data = {fullName: '홍길동', username: 'aiden.dw', password, nickname: '에이든'};
    expect((await request(app).post('/api/auth/signup').send(data)).status).toBe(403);
    expect((await request(app).post('/api/auth/signup').set('Origin', 'https://evil.example').send(data)).status).toBe(
      403
    );
    expect(await db.prepare('SELECT count(*) AS n FROM users').get()).toMatchObject({n: 0});
  });

  it('throttles repeated invalid logins', async () => {
    for (let i = 0; i < 15; i++) {
      await request(app).post('/api/auth/login').set('Origin', origin).send({username: 'nobody', password});
    }
    expect(
      (await request(app).post('/api/auth/login').set('Origin', origin).send({username: 'nobody', password})).status
    ).toBe(429);
  }, 15000);
  it('always allows an existing session to log out after credential throttling', async () => {
    await account('aiden.dw', 'member', 'approved');
    const agent = await login('aiden.dw');
    for (let i = 0; i < 15; i++) {
      await request(app).post('/api/auth/login').set('Origin', origin).send({username: 'nobody', password});
    }
    expect((await agent.post('/api/auth/logout').set('Origin', origin)).status).toBe(200);
    expect((await agent.get('/api/me')).body.user).toBeNull();
  }, 15000);
});

describe('membership authorization', () => {
  it('allows an administrator to approve a member and writes audit history', async () => {
    await account('owner', 'admin', 'approved');
    const member = await account('aiden.dw', 'member', 'pending');
    const admin = await login('owner');
    const user = await login('aiden.dw');
    expect((await user.get('/api/admin/users')).status).toBe(403);
    expect(
      (
        await admin
          .patch(`/api/admin/users/${member.id}`)
          .set('Origin', origin)
          .send({status: 'approved', role: 'member', reason: '확인 완료'})
      ).status
    ).toBe(200);
    expect((await user.get('/api/members')).body.members).toEqual(
      expect.arrayContaining([expect.objectContaining({nickname: 'aiden.dw'})])
    );
    expect(await db.prepare('SELECT count(*) AS n FROM auditLog').get()).toMatchObject({n: 1});
    expect(JSON.stringify((await user.get('/api/members')).body)).not.toContain('passwordHash');
  });

  it('ignores privilege fields in profile updates and never exposes pending members', async () => {
    await account('aiden.dw', 'member', 'approved');
    await account('waiting', 'member', 'pending');
    const user = await login('aiden.dw');
    const updated = await user
      .patch('/api/me')
      .set('Origin', origin)
      .send({
        fullName: '홍길동',
        nickname: '새닉네임',
        bio: '',
        location: '서울',
        gym: '더클라임',
        grade: 'V3',
        role: 'admin',
        status: 'approved',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({role: 'member', nickname: '새닉네임'});
    const members = (await user.get('/api/members')).body.members;
    expect(members).toHaveLength(1);
    expect(
      (
        await user
          .patch('/api/admin/users/unknown')
          .set('Origin', origin)
          .send({status: 'approved', role: 'admin', reason: ''})
      ).status
    ).toBe(403);
  });

  it('revokes sessions on suspension, rejects suspended login, and protects the last administrator', async () => {
    const owner = await account('owner', 'admin', 'approved');
    const member = await account('aiden.dw', 'member', 'approved');
    const user = await login('aiden.dw');
    const admin = await login('owner');
    expect(
      (
        await admin
          .patch(`/api/admin/users/${owner.id}`)
          .set('Origin', origin)
          .send({status: 'suspended', role: 'member', reason: ''})
      ).status
    ).toBe(409);
    expect(
      (
        await admin
          .patch(`/api/admin/users/${member.id}`)
          .set('Origin', origin)
          .send({status: 'suspended', role: 'member', reason: '활동 중지'})
      ).status
    ).toBe(200);
    expect((await user.get('/api/members')).status).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').set('Origin', origin).send({username: 'aiden.dw', password})).status
    ).toBe(403);
  });

  it('requires the old password to change it and revokes every existing session', async () => {
    await account('aiden.dw', 'member', 'approved');
    const user = await login('aiden.dw');
    const otherSession = await login('aiden.dw');
    expect(
      (await user.patch('/api/me/password').set('Origin', origin).send({currentPassword: password, newPassword: '123'}))
        .status
    ).toBe(400);
    expect(
      (
        await user
          .patch('/api/me/password')
          .set('Origin', origin)
          .send({currentPassword: 'wrong password', newPassword: '1234'})
      ).status
    ).toBe(401);
    expect(
      (
        await user
          .patch('/api/me/password')
          .set('Origin', origin)
          .send({currentPassword: password, newPassword: '1234'})
      ).status
    ).toBe(200);
    expect((await otherSession.get('/api/me')).body.user).toBeNull();
    expect((await user.get('/api/me')).body.user).toBeNull();
    const loggedIn = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({username: 'aiden.dw', password: '1234'});
    expect(loggedIn.status).toBe(200);
  });

  it('uses expiring, single-use recovery tokens issued only by administrators', async () => {
    await account('owner', 'admin', 'approved');
    const member = await account('aiden.dw', 'member', 'approved');
    const user = await login('aiden.dw');
    expect((await user.post(`/api/admin/users/${member.id}/recovery`).set('Origin', origin)).status).toBe(403);
    const admin = await login('owner');
    const issued = await admin.post(`/api/admin/users/${member.id}/recovery`).set('Origin', origin);
    expect(issued.status).toBe(201);
    const payload = {username: 'aiden.dw', token: issued.body.token, newPassword: '1234'};
    expect(
      (
        await request(app)
          .post('/api/auth/recover')
          .set('Origin', origin)
          .send({...payload, token: 'incorrect'})
      ).status
    ).toBe(400);
    expect((await request(app).post('/api/auth/recover').set('Origin', origin).send(payload)).status).toBe(200);
    expect((await request(app).post('/api/auth/recover').set('Origin', origin).send(payload)).status).toBe(400);
    expect((await user.get('/api/me')).body.user).toBeNull();
    const second = await admin.post(`/api/admin/users/${member.id}/recovery`).set('Origin', origin);
    await db.prepare('UPDATE recoveryTokens SET expiresAt = 0').run();
    expect(
      (
        await request(app)
          .post('/api/auth/recover')
          .set('Origin', origin)
          .send({...payload, token: second.body.token})
      ).status
    ).toBe(400);
  });
});

describe('hall of fame', () => {
  it('lets administrators manage inactive members records without exposing them to members', async () => {
    await account('owner', 'admin', 'approved');
    const member = await account('aiden.dw', 'member', 'approved');
    await account('reader', 'member', 'approved');
    const admin = await login('owner');
    const reader = await login('reader');
    const created = await admin.post('/api/admin/honors').set('Origin', origin).send({
      userId: member.id,
      title: '첫 도전',
      description: '꾸준하게 오른 기록',
      kind: 'growth',
      achievedAt: '2026-11-05',
    });
    expect(created.status).toBe(201);
    await admin
      .patch(`/api/admin/users/${member.id}`)
      .set('Origin', origin)
      .send({role: 'member', status: 'suspended', reason: '활동 정지'});
    expect((await reader.get('/api/honors')).body.honors).toEqual([]);
    expect((await reader.get('/api/admin/honors')).status).toBe(403);
    const records = await admin.get('/api/admin/honors');
    expect(records.status).toBe(200);
    expect(records.body.honors).toEqual([expect.objectContaining({id: created.body.honor.id})]);
    expect((await admin.delete(`/api/admin/honors/${created.body.honor.id}`).set('Origin', origin)).status).toBe(200);
  });
  it('keeps every internal record private to approved members', async () => {
    expect((await request(app).get('/api/honors')).status).toBe(401);
    await account('waiting', 'member', 'pending');
    const waiting = await login('waiting');
    expect((await waiting.get('/api/honors')).status).toBe(403);
  });
  it('starts empty, allows administrator CRUD, and rejects invalid dates and targets', async () => {
    await account('owner', 'admin', 'approved');
    const member = await account('aiden.dw', 'member', 'approved');
    const admin = await login('owner');
    expect((await admin.get('/api/honors')).body.honors).toEqual([]);
    const honor = {
      userId: member.id,
      title: '첫 V5 완등',
      description: '끝까지 도전한 멋진 기록',
      kind: 'send',
      achievedAt: '2026-11-05',
    };
    expect((await request(app).post('/api/admin/honors').set('Origin', origin).send(honor)).status).toBe(401);
    expect(
      (
        await admin
          .post('/api/admin/honors')
          .set('Origin', origin)
          .send({...honor, achievedAt: '2026-02-30'})
      ).status
    ).toBe(400);
    expect(
      (
        await admin
          .post('/api/admin/honors')
          .set('Origin', origin)
          .send({...honor, userId: 'missing'})
      ).status
    ).toBe(400);
    const created = await admin.post('/api/admin/honors').set('Origin', origin).send(honor);
    expect(created.status).toBe(201);
    expect((await admin.get('/api/honors')).body.honors).toEqual([
      expect.objectContaining({title: '첫 V5 완등', nickname: 'aiden.dw'}),
    ]);
    expect((await admin.delete(`/api/admin/honors/${created.body.honor.id}`).set('Origin', origin)).status).toBe(200);
    expect((await admin.get('/api/honors')).body.honors).toEqual([]);
    expect((await admin.delete('/api/admin/honors/missing').set('Origin', origin)).status).toBe(404);
  });
});
