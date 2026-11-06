import {expect, it} from 'vitest';
import request from 'supertest';
import {openPostgresTestDatabase} from './postgres-test-db';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
it('persists gym-specific sends and reads rating inputs through PostgreSQL names', async () => {
  const db = await openPostgresTestDatabase();
  const origin = 'http://localhost:4173';
  try {
    const app = createApp({db, origin, secureCookies: false, trustProxy: false});
    await createAccount(db, {
      username: 'local',
      nickname: '로컬',
      password: 'testpass',
      role: 'member',
      status: 'approved',
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('Origin', origin).send({username: 'local', password: 'testpass'});
    const gym = (await agent.get('/api/gyms')).body.gyms[0];
    expect(gym.grades.length).toBeGreaterThan(0);
    const saved = await agent
      .post('/api/me/climbing')
      .set('Origin', origin)
      .send({
        requestId: crypto.randomUUID(),
        gymId: gym.id,
        visitedOn: '2026-01-01',
        note: 'test',
        sends: [{gradeId: gym.grades[0].id, count: 10}],
      });
    expect(saved.status).toBe(201);
    expect(saved.body.visit).toMatchObject({gymId: gym.id, visitedOn: '2026-01-01'});
    const rating = await agent.get('/api/me/level');
    expect(rating.status).toBe(200);
    expect(rating.body.inputs).toMatchObject({visits: 1, sends: 10});
    expect(rating.body.inputs.byGrade[0].gymName).toBe(gym.name);
    const community = await agent
      .post('/api/gyms')
      .set('Origin', origin)
      .send({
        name: '테스트 공동 암장 서울점',
        brandName: '테스트 공동 암장',
        branchName: '서울점',
        address: '테스트',
        placeId: '111222',
        latitude: 37.5,
        longitude: 127.03,
        grades: [
          {name: '회색', color: '#888888'},
          {name: '보라', color: '#7755aa'},
        ],
      });
    expect(community.status).toBe(201);
    expect(community.body.gym).toMatchObject({
      brandName: '테스트 공동 암장',
      branchName: '서울점',
      name: '테스트 공동 암장 서울점',
    });
    expect(community.body.gym.grades.map((g: {name: string}) => g.name)).toEqual(['회색', '보라']);
    const edited = await agent
      .patch(`/api/gyms/${community.body.gym.id}`)
      .set('Origin', origin)
      .send({
        revision: community.body.gym.revision,
        name: community.body.gym.name,
        grades: [...community.body.gym.grades].reverse(),
      });
    expect(edited.status).toBe(200);
    expect(edited.body.gym.grades.map((g: {name: string}) => g.name)).toEqual(['보라', '회색']);
    const comment = await agent
      .post(`/api/gyms/${community.body.gym.id}/comments`)
      .set('Origin', origin)
      .send({body: '현황 공유'});
    expect(comment.status).toBe(201);
    expect((await agent.get(`/api/gyms/${community.body.gym.id}/comments`)).body.comments[0].body).toBe('현황 공유');
  } finally {
    await db.close();
  }
}, 30000);
