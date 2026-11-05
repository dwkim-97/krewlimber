import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase, transaction} from '../server/db';
import {
  currentQuarter,
  getAchievements,
  getTitleBoard,
  decorateMembers,
  setActivityCounts,
  setFeaturedAchievement,
} from '../server/progression';
import type {ActivityCounts, MemberProfile} from '../src/types';

const password = 'progression test passphrase';
const origin = 'http://localhost:4173';
const zero: ActivityCounts = {participation: 0, hosted: 0, attended: 0, red: 0, pink: 0, purple: 0};
let db: ReturnType<typeof openDatabase>;
beforeEach(() => {
  db = openDatabase(':memory:');
});
afterEach(() => db.close());
async function member(username: string, status: 'approved' | 'pending' | 'suspended' = 'approved') {
  return createAccount(db, {username, password, nickname: username, role: 'member', status});
}
function record(id: string, quarter: string, counts: ActivityCounts) {
  transaction(db, () => setActivityCounts(db, id, quarter, counts));
}

describe('quarterly titles', () => {
  it('uses Korean quarter boundaries', () => {
    expect(currentQuarter(new Date('2026-03-31T14:59:59Z'))).toBe('2026-Q1');
    expect(currentQuarter(new Date('2026-03-31T15:00:00Z'))).toBe('2026-Q2');
  });
  it('ranks positive counts, includes all tied winners, and excludes inactive members', async () => {
    const a = await member('climber.a');
    const b = await member('climber.b');
    const c = await member('climber.c');
    const inactive = await member('inactive', 'suspended');
    record(a.id, '2026-Q4', {...zero, participation: 20, red: 50});
    record(b.id, '2026-Q4', {...zero, participation: 20, hosted: 8});
    record(c.id, '2026-Q4', {...zero, participation: 4});
    record(inactive.id, '2026-Q4', {...zero, participation: 999, red: 999});
    const board = getTitleBoard(db, '2026-Q4');
    expect(
      board.categories.find(x => x.id === 'participation')!.standings.map(x => [x.nickname, x.rank, x.value])
    ).toEqual([
      ['climber.a', 1, 20],
      ['climber.b', 1, 20],
      ['climber.c', 3, 4],
    ]);
    expect(board.categories.find(x => x.id === 'purple')!.standings).toEqual([]);
    expect(getTitleBoard(db, '2026-Q3').categories.every(x => x.standings.length === 0)).toBe(true);
  });
});

describe('achievements', () => {
  it('sums lifetime activity and permits only earned featured achievements', async () => {
    const user = await member('climber');
    record(user.id, '2026-Q3', {...zero, red: 24});
    record(user.id, '2026-Q4', {...zero, red: 25});
    expect(getAchievements(db, user.id).achievements.find(x => x.id === 'theclimb-red-50')).toMatchObject({
      progress: 49,
      earned: false,
      featured: false,
    });
    expect(() => setFeaturedAchievement(db, user.id, 'theclimb-red-50')).toThrow();
    record(user.id, '2026-Q4', {...zero, red: 26});
    setFeaturedAchievement(db, user.id, 'theclimb-red-50');
    expect(getAchievements(db, user.id).achievements.find(x => x.id === 'theclimb-red-50')).toMatchObject({
      progress: 50,
      earned: true,
      featured: true,
    });
    expect(getAchievements(db, user.id).achievements.find(x => x.id === 'theclimb-red-100')!.earned).toBe(false);
    setFeaturedAchievement(db, user.id, null);
    expect(getAchievements(db, user.id).featuredAchievementId).toBeNull();
  });
  it('clears a selection when records are corrected below the requirement', async () => {
    const user = await member('climber');
    record(user.id, '2026-Q4', {...zero, red: 50});
    setFeaturedAchievement(db, user.id, 'theclimb-red-50');
    record(user.id, '2026-Q4', {...zero, red: 49});
    expect(getAchievements(db, user.id).featuredAchievementId).toBeNull();
    record(user.id, '2026-Q4', {...zero, red: 50});
    expect(getAchievements(db, user.id).featuredAchievementId).toBeNull();
  });
  it('decorates members with current titles and the same saved featured achievement', async () => {
    const user = await member('climber');
    const quarter = currentQuarter(new Date());
    record(user.id, quarter, {...zero, participation: 10, red: 50});
    setFeaturedAchievement(db, user.id, 'theclimb-red-50');
    const base = db
      .prepare('SELECT id,nickname,bio,location,gym,grade,createdAt FROM users WHERE id=?')
      .all(user.id) as unknown as MemberProfile[];
    const [decorated] = decorateMembers(db, base, quarter);
    expect(decorated.featuredAchievement).toMatchObject({id: 'theclimb-red-50', name: '적색경보 해제'});
    expect(decorated.titles.map(x => x.id)).toEqual(['participation', 'red']);
  });
  it('migrates existing data and never restores intentionally deleted default definitions', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'krew-progression-'));
    const file = join(directory, 'test.sqlite');
    try {
      let persistent = openDatabase(file);
      persistent
        .prepare(
          "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('old','old.user','old-hash','기존회원','member','approved','2026-01-01')"
        )
        .run();
      persistent.exec(
        'DROP TABLE featuredAchievements; DROP TABLE activityStats; DROP TABLE achievementDefinitions; PRAGMA user_version=1;'
      );
      persistent.close();
      persistent = openDatabase(file);
      expect(persistent.prepare("SELECT nickname FROM users WHERE id='old'").get()).toMatchObject({
        nickname: '기존회원',
      });
      expect(persistent.prepare('SELECT count(*) AS n FROM achievementDefinitions').get()).toMatchObject({n: 8});
      persistent.prepare("DELETE FROM achievementDefinitions WHERE id='theclimb-red-50'").run();
      persistent.close();
      persistent = openDatabase(file);
      expect(
        persistent.prepare("SELECT id FROM achievementDefinitions WHERE id='theclimb-red-50'").get()
      ).toBeUndefined();
      persistent.close();
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });
});

describe('progression API', () => {
  async function login(username: string) {
    const app = createApp({db, origin, secureCookies: false, trustProxy: false});
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/login').set('Origin', origin).send({username, password})).status).toBe(200);
    return {agent, app};
  }
  it('protects counters and definitions and validates inputs before changing data', async () => {
    const user = await member('climber');
    await createAccount(db, {username: 'owner', password, nickname: '운영진', role: 'admin', status: 'approved'});
    const regular = await login('climber');
    const admin = await login('owner');
    expect((await request(regular.app).get('/api/titles')).status).toBe(401);
    expect(
      (
        await regular.agent
          .put(`/api/admin/activity/${user.id}`)
          .set('Origin', origin)
          .send({quarter: '2026-Q4', counts: zero})
      ).status
    ).toBe(403);
    expect(
      (
        await admin.agent
          .put(`/api/admin/activity/${user.id}`)
          .set('Origin', origin)
          .send({quarter: '2026-Q9', counts: zero})
      ).status
    ).toBe(400);
    expect(
      (
        await admin.agent
          .put(`/api/admin/activity/${user.id}`)
          .set('Origin', origin)
          .send({quarter: '2026-Q4', counts: {...zero, red: -1}})
      ).status
    ).toBe(400);
    expect(
      (
        await admin.agent
          .put(`/api/admin/activity/${user.id}`)
          .set('Origin', origin)
          .send({quarter: '2026-Q4', counts: {...zero, red: 50}})
      ).status
    ).toBe(200);
    expect(
      (
        await regular.agent
          .patch('/api/me/featured-achievement')
          .set('Origin', origin)
          .send({achievementId: 'theclimb-red-100', userId: 'owner'})
      ).status
    ).toBe(400);
    expect(
      (
        await regular.agent
          .patch('/api/me/featured-achievement')
          .set('Origin', origin)
          .send({achievementId: 'theclimb-red-50'})
      ).status
    ).toBe(200);
    expect(
      (await regular.agent.get('/api/members')).body.members.find((x: {id: string}) => x.id === user.id)
        .featuredAchievement.name
    ).toBe('적색경보 해제');
    const definition = {name: '빨강 맛보기', description: '[더클라임] 빨강 문제 10개 완등', metric: 'red', target: 10};
    expect((await regular.agent.post('/api/admin/achievements').set('Origin', origin).send(definition)).status).toBe(
      403
    );
    const created = await admin.agent.post('/api/admin/achievements').set('Origin', origin).send(definition);
    expect(created.status).toBe(201);
    expect(
      (await regular.agent.get('/api/me/achievements')).body.achievements.find(
        (x: {id: string}) => x.id === created.body.achievement.id
      ).earned
    ).toBe(true);
    expect((await admin.agent.delete('/api/admin/achievements/theclimb-red-50').set('Origin', origin)).status).toBe(
      200
    );
    expect((await regular.agent.get('/api/me/achievements')).body.featuredAchievementId).toBeNull();
    expect((await admin.agent.delete('/api/admin/achievements/missing').set('Origin', origin)).status).toBe(404);
  });
  it('allows pending users to read their own locked catalog but not internal titles', async () => {
    await member('waiting', 'pending');
    const {agent} = await login('waiting');
    expect((await agent.get('/api/me/achievements')).status).toBe(200);
    expect((await agent.get('/api/titles')).status).toBe(403);
    expect(
      (await agent.patch('/api/me/featured-achievement').set('Origin', origin).send({achievementId: 'theclimb-red-50'}))
        .status
    ).toBe(400);
  });
});
