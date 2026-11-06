import {randomBytes, randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {createApp} from '../server/app';
import {hashToken} from '../server/auth';
import {openDatabase} from '../server/db';
import {getAchievements, getAdminProgression, getTitleBoard, setFeaturedAchievement} from '../server/progression';
import {EMPTY_COUNTS} from '../src/consts/progression';
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;
let owner: {id: string; cookie: string};
let member: {id: string; cookie: string};
const origin = 'http://localhost:4173';
function account(name: string, role: 'admin' | 'member', status: 'approved' | 'suspended' = 'approved') {
  const id = randomUUID(),
    token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES(?,?,?,?,?,?,?)').run(
    id,
    name,
    'unused',
    name,
    role,
    status,
    '2026-01-01'
  );
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token), id, Date.now() + 60000);
  return {id, cookie: `krew_session=${token}`};
}
beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false});
  owner = account('owner', 'admin');
  member = account('member', 'member');
});
afterEach(() => db.close());
function grant(amount: number) {
  return request(app)
    .post('/api/admin/points')
    .set('Cookie', owner.cookie)
    .set('Origin', origin)
    .send({userId: member.id, amount, reason: '활동 포인트', requestId: randomUUID()});
}
async function buy(points: number) {
  const product = await request(app)
    .post('/api/admin/market/products')
    .set('Cookie', owner.cookie)
    .set('Origin', origin)
    .send({name: '교환 상품', description: '', imageUrl: null, category: 'other', points, stock: 3, active: true});
  const order = await request(app)
    .post('/api/market/orders')
    .set('Cookie', member.cookie)
    .set('Origin', origin)
    .send({productId: product.body.product.id, quantity: 1, requestId: randomUUID(), productRevision: 1});
  expect(order.status).toBe(201);
  return order.body.order;
}
function manualGrant(userId: string, amount: number, date: string) {
  db.prepare("INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt) VALUES(?,?,?,?, 'grant',?)").run(
    userId,
    amount,
    '집계 테스트',
    owner.id,
    date
  );
}

it('counts net grants and non-cancelled purchases at Korean quarter boundaries', async () => {
  manualGrant(member.id, 500, '2026-03-31T14:59:59.999Z');
  manualGrant(member.id, 1000, '2026-03-31T15:00:00.000Z');
  manualGrant(member.id, -100, '2026-04-01T00:00:00.000Z');
  const inactive = account('inactive', 'member', 'suspended');
  manualGrant(inactive.id, 999999, '2026-04-01T00:00:00.000Z');
  const old = await buy(200),
    current = await buy(300);
  db.prepare('UPDATE marketOrders SET createdAt=? WHERE id=?').run('2026-03-31T14:59:59.999Z', old.id);
  db.prepare('UPDATE marketOrders SET createdAt=? WHERE id=?').run('2026-03-31T15:00:00.000Z', current.id);
  const cancelled = await request(app)
    .patch(`/api/market/orders/${old.id}/cancel`)
    .set('Cookie', member.cookie)
    .set('Origin', origin);
  expect(cancelled.status).toBe(200);
  expect(getTitleBoard(db, '2026-Q1').categories.find(x => x.id === 'pointsEarned')!.standings[0].value).toBe(500);
  expect(getTitleBoard(db, '2026-Q1').categories.find(x => x.id === 'pointsSpent')!.standings).toEqual([]);
  const board = getTitleBoard(db, '2026-Q2');
  expect(board.quarters).toEqual(expect.arrayContaining(['2026-Q1', '2026-Q2']));
  expect(board.categories.find(x => x.id === 'pointsEarned')!.standings).toEqual([
    {userId: member.id, nickname: 'member', value: 900, rank: 1},
  ]);
  expect(board.categories.find(x => x.id === 'pointsSpent')!.standings[0].value).toBe(300);
  const tied = account('tied', 'member');
  manualGrant(tied.id, 900, '2026-04-01T00:00:00.000Z');
  expect(
    getTitleBoard(db, '2026-Q2')
      .categories.find(x => x.id === 'pointsEarned')!
      .standings.filter(x => x.rank === 1)
  ).toHaveLength(2);
});
it('excludes refunds from earned points and clears a spent achievement after cancellation', async () => {
  expect((await grant(10000)).status).toBe(201);
  const order = await buy(1000);
  const earned = getAchievements(db, member.id);
  const spent = earned.achievements.find(x => x.metric === 'pointsSpent' && x.target === 1000)!;
  expect(spent.earned).toBe(true);
  setFeaturedAchievement(db, member.id, spent.id);
  await request(app).patch(`/api/market/orders/${order.id}/cancel`).set('Cookie', member.cookie).set('Origin', origin);
  expect(getAchievements(db, member.id).featuredAchievementId).toBeNull();
  expect(getAchievements(db, member.id).achievements.find(x => x.metric === 'pointsEarned')!.progress).toBe(10000);
  expect(getAchievements(db, member.id).achievements.find(x => x.metric === 'pointsSpent')!.progress).toBe(0);
  await buy(1000);
  expect(getAchievements(db, member.id).featuredAchievementId).toBeNull();
});
it('clears an earned-points feature on a negative correction and never automatically reselects it', async () => {
  await grant(1000);
  const achievement = getAchievements(db, member.id).achievements.find(
    x => x.metric === 'pointsEarned' && x.target === 1000
  )!;
  expect(achievement.earned).toBe(true);
  setFeaturedAchievement(db, member.id, achievement.id);
  await grant(-1);
  expect(getAchievements(db, member.id).featuredAchievementId).toBeNull();
  await grant(1);
  expect(getAchievements(db, member.id).featuredAchievementId).toBeNull();
});
it('separates automatic point metrics from manual counters and lets staff revise achievement goals', async () => {
  const data = getAdminProgression(db, '2026-Q4');
  expect(data.metrics.map(x => x.id)).toContain('gray');
  expect(data.metrics.map(x => x.id)).not.toContain('pointsEarned');
  expect(data.achievementMetrics.map(x => x.id)).toEqual(
    expect.arrayContaining(['gray', 'pointsEarned', 'pointsSpent'])
  );
  expect(
    (
      await request(app)
        .put(`/api/admin/activity/${member.id}`)
        .set('Cookie', owner.cookie)
        .set('Origin', origin)
        .send({quarter: '2026-Q4', counts: {...EMPTY_COUNTS, pointsEarned: 999}})
    ).status
  ).toBe(400);
  await grant(1000);
  const achievement = getAchievements(db, member.id).achievements.find(
    x => x.metric === 'pointsEarned' && x.target === 1000
  )!;
  setFeaturedAchievement(db, member.id, achievement.id);
  const input = {description: '[마켓] 포인트 순획득 2,000P 달성', target: 2000};
  expect(
    (
      await request(app)
        .patch(`/api/admin/achievements/${achievement.id}`)
        .set('Cookie', member.cookie)
        .set('Origin', origin)
        .send(input)
    ).status
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(`/api/admin/achievements/${achievement.id}`)
        .set('Cookie', owner.cookie)
        .set('Origin', origin)
        .send({...input, target: 0})
    ).status
  ).toBe(400);
  expect(
    (
      await request(app)
        .patch(`/api/admin/achievements/${achievement.id}`)
        .set('Cookie', owner.cookie)
        .set('Origin', origin)
        .send(input)
    ).status
  ).toBe(200);
  expect(getAchievements(db, member.id).featuredAchievementId).toBeNull();
  expect(getAchievements(db, member.id).achievements.find(x => x.id === achievement.id)).toMatchObject(input);
});

it('rolls back goal changes and corrections together with featured selections when audit writing fails', async () => {
  await grant(1000);
  const achievement = getAchievements(db, member.id).achievements.find(
    x => x.metric === 'pointsEarned' && x.target === 1000
  )!;
  setFeaturedAchievement(db, member.id, achievement.id);
  db.exec(
    "CREATE TRIGGER fail_progress_audit BEFORE INSERT ON auditLog BEGIN SELECT RAISE(ABORT,'test audit failure'); END;"
  );
  expect((await grant(-1)).status).toBe(500);
  expect(getAchievements(db, member.id).featuredAchievementId).toBe(achievement.id);
  expect(getAchievements(db, member.id).achievements.find(x => x.id === achievement.id)!.progress).toBe(1000);
  expect(
    (
      await request(app)
        .patch(`/api/admin/achievements/${achievement.id}`)
        .set('Cookie', owner.cookie)
        .set('Origin', origin)
        .send({description: '높은 목표', target: 2000})
    ).status
  ).toBe(500);
  expect(getAchievements(db, member.id).featuredAchievementId).toBe(achievement.id);
  expect(getAchievements(db, member.id).achievements.find(x => x.id === achievement.id)!.target).toBe(1000);
});
