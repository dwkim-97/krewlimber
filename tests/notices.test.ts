import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import request from 'supertest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';

const origin = 'http://localhost:4173';
const password = 'a strong climbing passphrase';
const input = {title: '정기 모임 안내', body: '토요일에 만나요.\n초크를 챙겨주세요.', pinned: false};
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false});
});
afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

async function login(username: string, role: 'admin' | 'member', status: 'approved' | 'pending') {
  await createAccount(db, {username, nickname: username, password, role, status});
  const agent = request.agent(app);
  expect((await agent.post('/api/auth/login').set('Origin', origin).send({username, password})).status).toBe(200);
  return agent;
}

describe('notices', () => {
  it('requires approved membership for every read and admin rights for every write', async () => {
    const waiting = await login('waiting', 'member', 'pending');
    const member = await login('member', 'member', 'approved');
    for (const path of ['/api/notices', '/api/notices/missing']) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await waiting.get(path)).status).toBe(403);
    }
    for (const agent of [request(app), waiting, member]) {
      const expected = agent === member || agent === waiting ? 403 : 401;
      expect((await agent.post('/api/admin/notices').set('Origin', origin).send(input)).status).toBe(expected);
      expect((await agent.patch('/api/admin/notices/missing').set('Origin', origin).send(input)).status).toBe(expected);
      expect((await agent.delete('/api/admin/notices/missing').set('Origin', origin)).status).toBe(expected);
    }
  });

  it('creates, edits and deletes notices with actor audit records and escaped plain text', async () => {
    const admin = await login('owner', 'admin', 'approved');
    const member = await login('reader', 'member', 'approved');
    const created = await admin
      .post('/api/admin/notices')
      .set('Origin', origin)
      .send({...input, title: '  안내  '});
    expect(created.status).toBe(201);
    expect(created.body.notice).toMatchObject({
      title: '안내',
      body: input.body,
      pinned: false,
      author: 'owner',
      views: 0,
    });
    const id = created.body.notice.id;
    const updated = await admin
      .patch(`/api/admin/notices/${id}`)
      .set('Origin', origin)
      .send({title: '새 안내', body: '<script>alert(1)</script>\n일반 본문', pinned: true});
    expect(updated.status).toBe(200);
    expect(updated.body.notice).toMatchObject({title: '새 안내', pinned: true, author: 'owner', views: 0});
    const detail = await member.get(`/api/notices/${id}`);
    expect(detail.body.notice).toMatchObject({body: '<script>alert(1)</script>\n일반 본문', views: 1});
    expect((await member.get(`/api/notices/${id}`)).body.notice.views).toBe(2);
    const list = await member.get('/api/notices');
    expect(list.body.items[0]).not.toHaveProperty('body');
    expect((await admin.delete(`/api/admin/notices/${id}`).set('Origin', origin)).status).toBe(200);
    expect((await member.get(`/api/notices/${id}`)).status).toBe(404);
    expect((await admin.delete(`/api/admin/notices/${id}`).set('Origin', origin)).status).toBe(404);
    expect(await db.prepare('SELECT action FROM auditLog ORDER BY id').all()).toEqual([
      {action: 'notice.create'},
      {action: 'notice.update'},
      {action: 'notice.delete'},
    ]);
  });

  it('validates complete trimmed input and reports missing notices', async () => {
    const admin = await login('owner', 'admin', 'approved');
    for (const invalid of [
      {...input, title: ' '},
      {...input, title: 'a'.repeat(121)},
      {...input, body: ' '},
      {...input, body: 'a'.repeat(4001)},
      {...input, pinned: 'true'},
      {title: input.title, body: input.body},
    ]) {
      expect((await admin.post('/api/admin/notices').set('Origin', origin).send(invalid)).status).toBe(400);
    }
    expect((await admin.patch('/api/admin/notices/missing').set('Origin', origin).send(input)).status).toBe(404);
    expect((await admin.get('/api/notices/missing')).status).toBe(404);
    expect((await admin.get('/api/notices')).body).toEqual({items: [], total: 0, page: 1, pageSize: 10});
  });

  it('sorts pinned first, uses deterministic newest order and clamps page boundaries', async () => {
    const admin = await login('owner', 'admin', 'approved');
    const actor = (await db.prepare('SELECT id FROM users').get()) as {id: string};
    const insert = db.prepare(
      'INSERT INTO notices (id,title,body,pinned,authorId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'
    );
    for (let i = 0; i < 23; i++) {
      const id = String(i).padStart(2, '0');
      await insert.run(
        id,
        `공지 ${id}`,
        '본문',
        i === 0 ? 1 : 0,
        actor.id,
        '2026-11-05T00:00:00Z',
        '2026-11-05T00:00:00Z'
      );
    }
    const first = await admin.get('/api/notices');
    expect(first.body).toMatchObject({total: 23, page: 1, pageSize: 10});
    expect(first.body.items.map((notice: {id: string}) => notice.id)).toEqual([
      '00',
      '22',
      '21',
      '20',
      '19',
      '18',
      '17',
      '16',
      '15',
      '14',
    ]);
    const last = await admin.get('/api/notices?page=999999');
    expect(last.body).toMatchObject({page: 3, total: 23});
    expect(last.body.items.map((notice: {id: string}) => notice.id)).toEqual(['03', '02', '01']);
    for (const page of ['-1', '0', 'nope', 'Infinity', '1.5']) {
      expect((await admin.get(`/api/notices?page=${page}`)).body.page).toBe(1);
    }
  });

  it('searches titles and bodies while treating SQL wildcard and quote characters literally', async () => {
    const admin = await login('owner', 'admin', 'approved');
    for (const notice of [
      {...input, title: '100% 모임'},
      {...input, title: '다른 안내', body: '장소_a\\b'},
      {...input, title: '평범한 모임'},
    ])
      expect((await admin.post('/api/admin/notices').set('Origin', origin).send(notice)).status).toBe(201);
    for (const [q, total] of [
      ['%', 1],
      ['_', 1],
      ['\\', 1],
      ["' OR 1=1 --", 0],
      ['초크', 2],
    ]) {
      const result = await admin.get('/api/notices').query({q});
      expect(result.status).toBe(200);
      expect(result.body.total).toBe(total);
    }
  });

  it('rolls back create, update and delete when the audit record cannot be written', async () => {
    const admin = await login('owner', 'admin', 'approved');
    const created = await admin.post('/api/admin/notices').set('Origin', origin).send(input);
    expect(created.status).toBe(201);
    const id = created.body.notice.id;
    db.exec(
      "CREATE TRIGGER reject_notice_audit BEFORE INSERT ON auditLog BEGIN SELECT RAISE(ABORT, 'audit failed'); END"
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await admin.post('/api/admin/notices').set('Origin', origin).send(input)).status).toBe(500);
    expect(
      (
        await admin
          .patch(`/api/admin/notices/${id}`)
          .set('Origin', origin)
          .send({...input, title: '변경'})
      ).status
    ).toBe(500);
    expect((await admin.delete(`/api/admin/notices/${id}`).set('Origin', origin)).status).toBe(500);
    expect(await db.prepare('SELECT title FROM notices').all()).toEqual([{title: input.title}]);
  });
});
