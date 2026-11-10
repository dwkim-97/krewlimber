import {randomUUID} from 'node:crypto';
import {expect, it} from 'vitest';
import {openDatabase} from '../server/db';
import {createAccount} from '../server/auth';
import {getAchievements, getTitleBoard, setFeaturedAchievement, decorateMembers} from '../server/progression';
import {openPostgresTestDatabase} from './postgres-test-db';
import type {Database} from '../server/database';
import {transaction} from '../server/database';
import {adjustPoints, changeOrder} from '../server/market';

it.each(['sqlite', 'postgres'])(
  'clears point achievement selections after corrections and cancellations (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:');
    try {
      const {user, grant, order} = await fixture(db);
      await grant(1200, new Date().toISOString());
      await setFeaturedAchievement(db, user.id, 'market-earned-1000');
      await transaction(db, () => adjustPoints(db, user.id, user.id, -300, '정정', randomUUID()));
      await transaction(db, () => adjustPoints(db, user.id, user.id, 300, '재지급', randomUUID()));
      expect((await getAchievements(db, user.id)).featuredAchievementId).toBeNull();
      const id = await order(1000, new Date().toISOString(), 'pending');
      await setFeaturedAchievement(db, user.id, 'market-spent-1000');
      await transaction(db, () => changeOrder(db, user, id, 'cancelled', async () => {}));
      await order(1000, new Date().toISOString(), 'pending');
      expect((await getAchievements(db, user.id)).featuredAchievementId).toBeNull();
    } finally {
      await db.close();
    }
  },
  30000
);

async function fixture(db: Database) {
  const user = await createAccount(db, {
    username: 'restore.member',
    nickname: '복원회원',
    password: 'testpass',
    role: 'member',
    status: 'approved',
  });
  const grant = async (amount: number, date: string) => {
    await db
      .prepare('INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt) VALUES(?,?,?,?,?,?)')
      .run(user.id, amount, '점검', user.id, 'grant', date);
  };
  const order = async (total: number, date: string, status: string) => {
    const productId = randomUUID(),
      id = randomUUID();
    await db
      .prepare(
        'INSERT INTO marketProducts(id,name,description,category,points,stock,active,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)'
      )
      .run(productId, '상품', '', 'gear', total, 1, 1, date, date);
    await db
      .prepare(
        'INSERT INTO marketOrders(id,userId,productId,productName,points,quantity,total,status,requestId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
      )
      .run(id, user.id, productId, '상품', total, 1, total, status, randomUUID(), date, date);
    return id;
  };
  return {user, grant, order};
}

it.each(['sqlite', 'postgres'])(
  'restores titles and lifetime achievements with net point history (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:');
    try {
      const {user, grant, order} = await fixture(db);
      await grant(11000, '2026-03-31T14:59:59.000Z');
      await grant(-1000, '2026-03-31T14:59:59.500Z');
      await grant(2000, '2026-03-31T15:00:00.000Z');
      const cancelled = await order(1000, '2026-03-31T14:59:59.000Z', 'pending');
      await order(5000, '2026-03-31T14:00:00.000Z', 'completed');
      await order(5000, '2026-03-31T15:00:00.000Z', 'pending');
      await db.prepare('UPDATE marketOrders SET status=? WHERE id=?').run('cancelled', cancelled);
      await db
        .prepare('INSERT INTO activityStats(userId,quarter,metric,value) VALUES(?,?,?,?)')
        .run(user.id, '2026-Q1', 'attended', 100);
      const q1 = await getTitleBoard(db, '2026-Q1');
      expect(q1.categories).toHaveLength(9);
      expect(q1.categories.find(c => c.id === 'purple')!.name).toBe('보라 클래스');
      expect(q1.categories.find(c => c.id === 'attended')).toMatchObject({
        name: '번개 붙박이',
        standings: [{value: 100, rank: 1}],
      });
      expect(q1.categories.find(c => c.id === 'pointsEarned')!.standings[0].value).toBe(10000);
      expect(q1.categories.find(c => c.id === 'pointsSpent')!.standings[0].value).toBe(5000);
      const q2 = await getTitleBoard(db, '2026-Q2');
      expect(q2.categories.find(c => c.id === 'pointsEarned')!.standings[0].value).toBe(2000);
      expect(q2.quarters).toEqual(expect.arrayContaining(['2026-Q1', '2026-Q2']));
      const collection = await getAchievements(db, user.id);
      expect(collection.achievements).toHaveLength(15);
      expect(collection.achievements.find(a => a.id === 'krew-attended-100')).toMatchObject({
        earned: true,
        progress: 100,
      });
      expect(collection.achievements.find(a => a.id === 'market-earned-10000')).toMatchObject({
        earned: true,
        progress: 12000,
      });
      expect(collection.achievements.find(a => a.id === 'market-spent-10000')).toMatchObject({
        earned: true,
        progress: 10000,
      });
      await setFeaturedAchievement(db, user.id, 'market-spent-10000');
      const [decorated] = await decorateMembers(db, [user], '2026-Q1');
      expect(decorated.featuredAchievement!.id).toBe('market-spent-10000');
      expect(decorated.titles.map(t => t.id)).toEqual(
        expect.arrayContaining(['attended', 'pointsEarned', 'pointsSpent'])
      );
      await grant(-12000, '2026-04-01T00:00:00.000Z');
      expect((await getAchievements(db, user.id)).achievements.find(a => a.id === 'market-earned-1000')).toMatchObject({
        progress: 0,
        earned: false,
      });
    } finally {
      await db.close();
    }
  },
  30000
);

it.each(['sqlite', 'postgres'])(
  'counts The Climb gray sends for the right quarter and excludes other brands (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:');
    try {
      const {user} = await fixture(db);
      await db
        .prepare('INSERT INTO gymGrades(id,gymId,name,color,createdAt) VALUES(?,?,?,?,?)')
        .run('theclimb-gray', 'gym-theclimb-gangnam', '회색', '#888888', '2026-01-01');
      for (const [gymId, gradeId, count, visitedOn] of [
        ['gym-theclimb-gangnam', 'theclimb-gray', 8, '2026-03-31'],
        ['gym-climbingpark-gangnam', 'park-gray', 90, '2026-03-31'],
        ['gym-theclimb-gangnam', 'theclimb-gray', 2, '2026-04-01'],
      ] as const) {
        const id = randomUUID();
        await db
          .prepare(
            'INSERT INTO climbingVisits(id,userId,gymId,visitedOn,note,requestId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)'
          )
          .run(id, user.id, gymId, visitedOn, '', randomUUID(), visitedOn, visitedOn);
        await db.prepare('INSERT INTO visitSends(visitId,gradeId,count) VALUES(?,?,?)').run(id, gradeId, count);
      }
      const board = await getTitleBoard(db, '2026-Q1');
      expect(board.categories.find(c => c.id === 'gray')).toMatchObject({
        name: '세계관 최강자',
        standings: [{userId: user.id, value: 8}],
      });
      expect((await getTitleBoard(db, '2026-Q2')).categories.find(c => c.id === 'gray')!.standings[0].value).toBe(2);
      await db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(user.id);
      expect((await getTitleBoard(db, '2026-Q1')).categories.every(c => c.standings.length === 0)).toBe(true);
    } finally {
      await db.close();
    }
  },
  30000
);
