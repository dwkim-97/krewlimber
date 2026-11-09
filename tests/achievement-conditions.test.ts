import {expect, it} from 'vitest';
import request from 'supertest';
import {openDatabase} from '../server/db';
import {createAccount} from '../server/auth';
import {createApp} from '../server/app';
import {openPostgresTestDatabase} from './postgres-test-db';
it.each(['sqlite', 'postgres'])(
  'counts branch-specific ascending conditions and reordered boundaries (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:'),
      origin = 'http://localhost:4173';
    try {
      await createAccount(db, {
        username: 'manager',
        nickname: '관리자',
        password: 'testpass',
        role: 'admin',
        status: 'approved',
      });
      await createAccount(db, {
        username: 'member',
        nickname: '회원',
        password: 'testpass',
        role: 'member',
        status: 'approved',
      });
      const app = createApp({db, origin, secureCookies: false, trustProxy: false}),
        admin = request.agent(app),
        member = request.agent(app);
      for (const [a, username] of [
        [admin, 'manager'],
        [member, 'member'],
      ] as const)
        await a.post('/api/auth/login').set('Origin', origin).send({username, password: 'testpass'});
      const create = async (name: string) =>
        (
          await admin
            .post('/api/gyms')
            .set('Origin', origin)
            .send({
              name,
              address: '테스트',
              grades: [
                {name: '파랑', color: '#4488bb'},
                {name: '빨강', color: '#bb4444'},
                {name: '보라', color: '#8844bb'},
              ],
            })
        ).body.gym;
      let gym = await create('지점 A');
      const other = await create('지점 B');
      const visit = await member
        .post('/api/me/climbing')
        .set('Origin', origin)
        .send({
          requestId: crypto.randomUUID(),
          gymId: gym.id,
          visitedOn: '2026-01-01',
          sends: [
            {gradeId: gym.grades[0].id, count: 3},
            {gradeId: gym.grades[1].id, count: 4},
            {gradeId: gym.grades[2].id, count: 2},
          ],
        });
      await member
        .post('/api/me/climbing')
        .set('Origin', origin)
        .send({
          requestId: crypto.randomUUID(),
          gymId: other.id,
          visitedOn: '2026-01-01',
          sends: [{gradeId: other.grades[1].id, count: 100}],
        });
      const id = 'saved-condition';
      await db
        .prepare('INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES(?,?,?,?,?)')
        .run(id, '저장된 업적', '기존 조건', 'participation', 6);
      await db
        .prepare(
          'INSERT INTO achievementConditions(achievementId,gymId,gradeId,operator,difficultyRank) VALUES(?,?,?,?,?)'
        )
        .run(id, gym.id, gym.grades[1].id, 'gte', 2);
      const find = async () =>
        (await member.get('/api/me/achievements')).body.achievements.find((a: {id: string}) => a.id === id);
      expect(await find()).toMatchObject({
        progress: 6,
        earned: true,
        condition: {difficultyRank: 2, operator: 'gte', gymId: gym.id},
      });
      await member.patch('/api/me/featured-achievement').set('Origin', origin).send({achievementId: id});
      expect(
        (await member.get('/api/members')).body.members.find((m: {nickname: string}) => m.nickname === '회원')
          .featuredAchievement.id
      ).toBe(id);
      const reordered = await member
        .patch(`/api/gyms/${gym.id}`)
        .set('Origin', origin)
        .send({revision: gym.revision, name: gym.name, grades: [gym.grades[0], gym.grades[2], gym.grades[1]]});
      expect(reordered.status).toBe(200);
      gym = reordered.body.gym;
      expect(await find()).toMatchObject({progress: 4, earned: false, condition: {difficultyRank: 3}});
      expect(
        (
          await member
            .patch(`/api/gyms/${gym.id}`)
            .set('Origin', origin)
            .send({revision: gym.revision, name: gym.name, grades: [gym.grades[0], gym.grades[1]]})
        ).status
      ).toBe(409);
      await member.delete(`/api/me/climbing/${visit.body.visit.id}`).set('Origin', origin);
      expect(await find()).toMatchObject({progress: 0, earned: false});
    } finally {
      await db.close();
    }
  },
  30000
);

it('upgrades persisted descending SQLite conditions without losing their grade boundary', async () => {
  const {mkdtempSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const directory = mkdtempSync(`${tmpdir()}/krew-rank-`),
    file = `${directory}/test.sqlite`;
  let db = openDatabase(file);
  try {
    db.exec(
      "INSERT INTO gymGrades(id,gymId,name,color,sortOrder,createdAt) VALUES('easy','gym-theclimb-gangnam','파랑','#4488bb',1,'2026-01-01'); UPDATE gymGrades SET sortOrder=0 WHERE id='climb-purple'; DROP TABLE achievementConditions; CREATE TABLE achievementConditions(achievementId TEXT PRIMARY KEY,gymId TEXT,gradeId TEXT,operator TEXT CHECK(operator IN ('eq','lte')),difficultyRank INTEGER); INSERT INTO achievementConditions SELECT id,'gym-theclimb-gangnam','climb-purple','lte',1 FROM achievementDefinitions LIMIT 1; PRAGMA user_version=5;"
    );
    db.close();
    db = openDatabase(file);
    expect(db.prepare('SELECT operator,difficultyRank,gradeId FROM achievementConditions').get()).toMatchObject({
      operator: 'gte',
      difficultyRank: 2,
      gradeId: 'climb-purple',
    });
    expect(db.prepare("SELECT sortOrder FROM gymGrades WHERE id='easy'").get()).toMatchObject({sortOrder: 0});
  } finally {
    db.close();
    rmSync(directory, {recursive: true, force: true});
  }
});
