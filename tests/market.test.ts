import {randomBytes, randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {createApp} from '../server/app';
import {hashToken} from '../server/auth';
import {openDatabase} from '../server/db';

const origin = 'http://localhost:4173';
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;
let admin: string;
let member: string;
let other: string;
let pending: string;
let memberId: string;
async function account(name: string, role: 'admin' | 'member', status: 'approved' | 'pending') {
  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  await db
    .prepare('INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES(?,?,?,?,?,?,?)')
    .run(id, name, 'unused-test-hash', name, role, status, new Date().toISOString());
  await db
    .prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)')
    .run(hashToken(token), id, Date.now() + 60000);
  return {id, cookie: `krew_session=${token}`};
}
const input = {
  name: '초크백',
  description: '가볍게 챙기는 크루 장비',
  imageUrl: null,
  category: 'gear',
  points: 100,
  stock: 2,
  active: true,
};
beforeEach(async () => {
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false});
  admin = (await account('admin', 'admin', 'approved')).cookie;
  const user = await account('member', 'member', 'approved');
  member = user.cookie;
  memberId = user.id;
  other = (await account('other', 'member', 'approved')).cookie;
  pending = (await account('pending', 'member', 'pending')).cookie;
});
afterEach(() => db.close());
async function product() {
  const result = await request(app)
    .post('/api/admin/market/products')
    .set('Cookie', admin)
    .set('Origin', origin)
    .send(input);
  expect(result.status).toBe(201);
  return result.body.product;
}
async function grant(amount: number) {
  return request(app)
    .post('/api/admin/points')
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({userId: memberId, amount, reason: '운영진 활동 포인트', requestId: randomUUID()});
}
async function order(productId: string, quantity: number, requestId: string) {
  return request(app)
    .post('/api/market/orders')
    .set('Cookie', member)
    .set('Origin', origin)
    .send({
      productId,
      quantity,
      requestId,
      productRevision: Number(
        (await db.prepare('SELECT revision FROM marketProducts WHERE id=?').get(productId))!.revision
      ),
    });
}
it('protects catalog, wallet and administration with current member permissions', async () => {
  expect((await request(app).get('/api/market/products')).status).toBe(401);
  expect((await request(app).get('/api/market/products').set('Cookie', pending)).status).toBe(403);
  expect((await request(app).get('/api/me/wallet').set('Cookie', pending)).status).toBe(403);
  expect(
    (await request(app).post('/api/admin/market/products').set('Cookie', member).set('Origin', origin).send(input))
      .status
  ).toBe(403);
  expect((await request(app).get('/api/admin/market/orders').set('Cookie', member)).status).toBe(403);
});
it('validates products and hides inactive products from member catalog', async () => {
  for (const patch of [{points: 0}, {stock: -1}, {imageUrl: 'javascript:alert(1)'}, {category: 'invalid'}])
    expect(
      (
        await request(app)
          .post('/api/admin/market/products')
          .set('Cookie', admin)
          .set('Origin', origin)
          .send({...input, ...patch})
      ).status
    ).toBe(400);
  const p = await product();
  expect((await request(app).get('/api/market/products?q=초크').set('Cookie', member)).body.total).toBe(1);
  expect(
    (
      await request(app)
        .patch(`/api/admin/market/products/${p.id}`)
        .set('Cookie', admin)
        .set('Origin', origin)
        .send({
          ...input,
          revision: Number((await db.prepare('SELECT revision FROM marketProducts WHERE id=?').get(p.id))!.revision),
          active: false,
        })
    ).status
  ).toBe(200);
  expect((await request(app).get('/api/market/products').set('Cookie', member)).body.total).toBe(0);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).status).toBe(404);
});
it('deducts points and stock once, returns request replays and preserves order snapshots', async () => {
  const p = await product();
  expect((await grant(250)).status).toBe(201);
  const key = randomUUID();
  const first = await order(p.id, 2, key);
  expect(first.status).toBe(201);
  const replay = await order(p.id, 2, key);
  expect(replay.status).toBe(200);
  expect(replay.body.order.id).toBe(first.body.order.id);
  expect((await order(p.id, 1, key)).status).toBe(409);
  expect((await request(app).get('/api/me/wallet').set('Cookie', member)).body.balance).toBe(50);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(0);
  await request(app)
    .patch(`/api/admin/market/products/${p.id}`)
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({
      ...input,
      revision: Number((await db.prepare('SELECT revision FROM marketProducts WHERE id=?').get(p.id))!.revision),
      name: '새 이름',
      points: 500,
    });
  const history = await request(app).get('/api/me/orders').set('Cookie', member);
  expect(history.body.items[0]).toMatchObject({
    productName: '초크백',
    points: 100,
    quantity: 2,
    total: 200,
    status: 'pending',
  });
});
it('rejects insufficient funds or stock without changing either', async () => {
  const p = await product();
  await grant(50);
  expect((await order(p.id, 1, randomUUID())).status).toBe(409);
  await grant(500);
  expect((await order(p.id, 3, randomUUID())).status).toBe(409);
  expect((await request(app).get('/api/me/wallet').set('Cookie', member)).body.balance).toBe(550);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(2);
  expect((await request(app).get('/api/me/orders').set('Cookie', member)).body.total).toBe(0);
});
it('allows only one request to reserve the last unit', async () => {
  const p = await product();
  await grant(500);
  await request(app)
    .patch(`/api/admin/market/products/${p.id}`)
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({
      ...input,
      revision: Number((await db.prepare('SELECT revision FROM marketProducts WHERE id=?').get(p.id))!.revision),
      stock: 1,
    });
  const results = await Promise.all([await order(p.id, 1, randomUUID()), await order(p.id, 1, randomUUID())]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  expect((await request(app).get('/api/me/wallet').set('Cookie', member)).body.balance).toBe(400);
});
it('refunds a pending cancellation exactly once and prevents another member cancellation', async () => {
  const p = await product();
  await grant(250);
  const created = await order(p.id, 2, randomUUID());
  const url = `/api/market/orders/${created.body.order.id}/cancel`;
  expect((await request(app).patch(url).set('Cookie', other).set('Origin', origin).send({})).status).toBe(404);
  for (let i = 0; i < 2; i++)
    expect((await request(app).patch(url).set('Cookie', member).set('Origin', origin).send({})).status).toBe(200);
  const wallet = (await request(app).get('/api/me/wallet').set('Cookie', member)).body;
  expect(wallet.balance).toBe(250);
  expect(wallet.entries).toHaveLength(3);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(2);
});
it('restricts completed order transitions and keeps member histories separate', async () => {
  const p = await product();
  await grant(250);
  const created = await order(p.id, 1, randomUUID());
  const url = `/api/admin/market/orders/${created.body.order.id}`;
  expect(
    (await request(app).patch(url).set('Cookie', admin).set('Origin', origin).send({status: 'completed'})).status
  ).toBe(200);
  expect(
    (await request(app).patch(url).set('Cookie', admin).set('Origin', origin).send({status: 'cancelled'})).status
  ).toBe(409);
  expect(
    (
      await request(app)
        .patch(`/api/market/orders/${created.body.order.id}/cancel`)
        .set('Cookie', member)
        .set('Origin', origin)
        .send({})
    ).status
  ).toBe(409);
  expect((await request(app).get('/api/me/orders').set('Cookie', other)).body.total).toBe(0);
  expect((await request(app).get('/api/admin/market/orders?status=completed').set('Cookie', admin)).body.total).toBe(1);
});
it('allows audited point corrections without a negative balance and rejects invalid amounts', async () => {
  expect((await grant(250)).status).toBe(201);
  expect((await grant(-100)).status).toBe(201);
  expect((await grant(-151)).status).toBe(409);
  expect((await grant(0)).status).toBe(400);
  expect((await grant(1.2)).status).toBe(400);
  expect((await request(app).get(`/api/admin/points?userId=${memberId}`).set('Cookie', admin)).body.balance).toBe(150);
  expect((await db.prepare("SELECT COUNT(*) AS count FROM auditLog WHERE action='points.adjust'").get())!.count).toBe(
    2
  );
});
it('rolls back a purchase if its audit write fails', async () => {
  const p = await product();
  await grant(250);
  db.exec(
    "CREATE TRIGGER fail_order_audit BEFORE INSERT ON auditLog WHEN NEW.action='order.create' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;"
  );
  expect((await order(p.id, 1, randomUUID())).status).toBe(500);
  expect((await request(app).get('/api/me/wallet').set('Cookie', member)).body.balance).toBe(250);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(2);
});

it('rejects inventory corrections that would prevent pending cancellation', async () => {
  const p = await product();
  await grant(250);
  const created = await order(p.id, 1, randomUUID());
  expect(
    (
      await request(app)
        .patch(`/api/admin/market/products/${p.id}`)
        .set('Cookie', admin)
        .set('Origin', origin)
        .send({
          ...input,
          revision: Number((await db.prepare('SELECT revision FROM marketProducts WHERE id=?').get(p.id))!.revision),
          stock: 1000000,
        })
    ).status
  ).toBe(400);
  const result = await request(app)
    .patch(`/api/market/orders/${created.body.order.id}/cancel`)
    .set('Cookie', member)
    .set('Origin', origin)
    .send({});
  expect(result.status).toBe(200);
  expect((await request(app).get('/api/me/wallet').set('Cookie', member)).body.balance).toBe(250);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(2);
});

it('rejects stale administrator edits after stock is reserved or returned', async () => {
  const p = await product();
  await grant(250);
  const created = await order(p.id, 1, randomUUID());
  const stale = await request(app)
    .patch(`/api/admin/market/products/${p.id}`)
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({...input, revision: p.revision, active: false});
  expect(stale.status).toBe(409);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(1);
  const reserved = (await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product;
  await request(app)
    .patch(`/api/market/orders/${created.body.order.id}/cancel`)
    .set('Cookie', member)
    .set('Origin', origin)
    .send({});
  expect(
    (
      await request(app)
        .patch(`/api/admin/market/products/${p.id}`)
        .set('Cookie', admin)
        .set('Origin', origin)
        .send({...input, revision: reserved.revision})
    ).status
  ).toBe(409);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.stock).toBe(2);
});

it('requires the displayed product version before charging a changed price', async () => {
  const p = await product();
  await grant(1000);
  await request(app)
    .patch(`/api/admin/market/products/${p.id}`)
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({...input, revision: p.revision, points: 500});
  const result = await request(app)
    .post('/api/market/orders')
    .set('Cookie', member)
    .set('Origin', origin)
    .send({productId: p.id, quantity: 1, requestId: randomUUID(), productRevision: p.revision});
  expect(result.status).toBe(409);
  expect((await request(app).get('/api/me/wallet').set('Cookie', member)).body.balance).toBe(1000);
  expect((await request(app).get('/api/me/orders').set('Cookie', member)).body.total).toBe(0);
});
it('applies a point grant or correction once after its response is lost', async () => {
  const key = randomUUID();
  const input = {userId: memberId, amount: 250, reason: '응답 유실 재시도', requestId: key};
  const send = (data: typeof input) =>
    request(app).post('/api/admin/points').set('Cookie', admin).set('Origin', origin).send(data);
  expect((await send(input)).status).toBe(201);
  const replay = await send(input);
  expect(replay.status).toBe(200);
  expect(replay.body.balance).toBe(250);
  expect(replay.body.entries).toHaveLength(1);
  expect((await send({...input, amount: 500})).status).toBe(409);
  const correction = {...input, amount: -50, requestId: randomUUID()};
  await send(correction);
  const again = await send(correction);
  expect(again.status).toBe(200);
  expect(again.body.balance).toBe(200);
  expect(again.body.entries).toHaveLength(2);
});

it('loads active and stopped products only through the administrator edit endpoint', async () => {
  const p = await product();
  expect((await request(app).get(`/api/admin/market/products/${p.id}`)).status).toBe(401);
  expect((await request(app).get(`/api/admin/market/products/${p.id}`).set('Cookie', member)).status).toBe(403);
  const loaded = await request(app).get(`/api/admin/market/products/${p.id}`).set('Cookie', admin);
  expect(loaded.status).toBe(200);
  expect(loaded.body.product).toMatchObject({id: p.id, active: true, revision: 1});
  await request(app)
    .patch(`/api/admin/market/products/${p.id}`)
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({...input, revision: 1, active: false});
  expect((await request(app).get(`/api/admin/market/products/${p.id}`).set('Cookie', admin)).body.product.active).toBe(
    false
  );
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).status).toBe(404);
  const reopened = await request(app)
    .patch(`/api/admin/market/products/${p.id}`)
    .set('Cookie', admin)
    .set('Origin', origin)
    .send({...input, revision: 2, active: true});
  expect(reopened.status).toBe(200);
  expect((await request(app).get(`/api/market/products/${p.id}`).set('Cookie', member)).body.product.active).toBe(true);
});
