import {afterEach, beforeEach, expect, it} from 'vitest';
import request from 'supertest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';
const origin = 'http://localhost:4173';
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false});
});
afterEach(() => db.close());
async function member(name: string, status: 'approved' | 'pending' = 'approved') {
  await createAccount(db, {username: name, nickname: name, password: 'testpass', role: 'member', status});
  const agent = request.agent(app);
  await agent.post('/api/auth/login').set('Origin', origin).send({username: name, password: 'testpass'});
  return agent;
}
it('keeps records personal, validates gym grades and derives rating inputs after edits/deletes', async () => {
  const a = await member('one'),
    b = await member('two');
  expect((await request(app).get('/api/gyms')).status).toBe(401);
  expect((await (await member('waiting', 'pending')).get('/api/gyms')).status).toBe(403);
  const gyms = (await a.get('/api/gyms')).body.gyms;
  expect(gyms.length).toBeGreaterThan(1);
  const gym = gyms[0],
    grade = gym.grades[0];
  const payload = {
    requestId: crypto.randomUUID(),
    gymId: gym.id,
    visitedOn: '2026-01-01',
    note: '즐거운 운동',
    sends: [{gradeId: grade.id, count: 10}],
  };
  const saved = await a.post('/api/me/climbing').set('Origin', origin).send(payload);
  expect(saved.status).toBe(201);
  const id = saved.body.visit.id;
  expect((await a.post('/api/me/climbing').set('Origin', origin).send(payload)).status).toBe(200);
  expect(
    (
      await a
        .post('/api/me/climbing')
        .set('Origin', origin)
        .send({...payload, note: '변경된 요청'})
    ).status
  ).toBe(409);
  expect((await a.get('/api/me/climbing')).body.visits).toHaveLength(1);
  expect((await b.get('/api/me/climbing')).body.visits).toHaveLength(0);
  expect((await b.delete(`/api/me/climbing/${id}`).set('Origin', origin)).status).toBe(404);
  for (const invalid of [
    {...payload, requestId: crypto.randomUUID(), visitedOn: '2026-02-30'},
    {...payload, requestId: crypto.randomUUID(), visitedOn: '2999-01-01'},
    {...payload, requestId: crypto.randomUUID(), sends: [{gradeId: gyms[1].grades[0].id, count: 1}]},
    {...payload, requestId: crypto.randomUUID(), sends: [{gradeId: grade.id, count: -1}]},
    {
      ...payload,
      requestId: crypto.randomUUID(),
      sends: [
        {gradeId: grade.id, count: 1},
        {gradeId: grade.id, count: 1},
      ],
    },
  ])
    expect((await a.post('/api/me/climbing').set('Origin', origin).send(invalid)).status).toBe(400);
  expect(
    (
      await a
        .patch(`/api/me/climbing/${id}`)
        .set('Origin', origin)
        .send({...payload, sends: [{gradeId: grade.id, count: 8}]})
    ).status
  ).toBe(200);
  expect((await a.get('/api/me/level')).body).toMatchObject({
    level: 0,
    inputs: {visits: 1, sends: 8},
  });
  await a.delete(`/api/me/climbing/${id}`).set('Origin', origin);
  expect((await a.get('/api/me/level')).body.inputs.sends).toBe(0);
});
it('lets members share gyms and grades without duplicates', async () => {
  const a = await member('one');
  const input = {name: '새 암장', address: '서울 테스트', latitude: null, longitude: null};
  const gym = await a.post('/api/gyms').set('Origin', origin).send(input);
  expect(gym.status).toBe(201);
  expect((await a.post('/api/gyms').set('Origin', origin).send(input)).status).toBe(409);
  const grade = {name: '회색', color: '#888888'};
  expect((await a.post(`/api/gyms/${gym.body.gym.id}/grades`).set('Origin', origin).send(grade)).status).toBe(201);
  expect((await a.post(`/api/gyms/${gym.body.gym.id}/grades`).set('Origin', origin).send(grade)).status).toBe(409);
});

it('adds a missing location without duplicating a gym or losing its grades', async () => {
  const a = await member('locator');
  const gym = (await a.get('/api/gyms')).body.gyms[0];
  const input = {address: '테스트 주소', latitude: 37.5, longitude: 127.03};
  const r = await a.patch(`/api/gyms/${gym.id}/location`).set('Origin', origin).send(input);
  expect(r.status).toBe(200);
  expect(r.body.gym.grades).toEqual(gym.grades);
  expect((await a.get('/api/gyms')).body.gyms).toHaveLength(2);
  expect((await a.patch(`/api/gyms/${gym.id}/location`).set('Origin', origin).send(input)).status).toBe(409);
});
it('registers a shared place and its grades together, then lets members discuss it', async () => {
  const a = await member('author'),
    b = await member('reader');
  const input = {
    name: '테스트 공용 암장',
    address: '테스트 주소',
    placeId: '123456',
    latitude: 37.5,
    longitude: 127.03,
    grades: [
      {name: '회색', color: '#888888'},
      {name: '보라', color: '#7755aa'},
    ],
  };
  const created = await a.post('/api/gyms').set('Origin', origin).send(input);
  expect(created.status).toBe(201);
  const gym = created.body.gym;
  expect(gym.grades).toHaveLength(2);
  expect((await b.get('/api/gyms')).body.gyms.find((g: {id: string}) => g.id === gym.id).grades).toHaveLength(2);
  expect(
    (
      await b
        .post('/api/gyms')
        .set('Origin', origin)
        .send({...input, name: '다른 이름'})
    ).status
  ).toBe(409);
  const comment = await a
    .post(`/api/gyms/${gym.id}/comments`)
    .set('Origin', origin)
    .send({body: '오늘 새 세팅 했어요!'});
  expect(comment.status).toBe(201);
  const read = await b.get(`/api/gyms/${gym.id}/comments`);
  expect(read.body.comments[0]).toMatchObject({body: '오늘 새 세팅 했어요!', author: 'author', canDelete: false});
  expect((await b.delete(`/api/gyms/${gym.id}/comments/${comment.body.comment.id}`).set('Origin', origin)).status).toBe(
    404
  );
  expect(
    (
      await a
        .patch(`/api/gyms/${gym.id}/comments/${comment.body.comment.id}`)
        .set('Origin', origin)
        .send({body: '수정된 최신 정보'})
    ).status
  ).toBe(200);
  expect((await a.post(`/api/gyms/${gym.id}/comments`).set('Origin', origin).send({body: ' '})).status).toBe(400);
  expect((await a.delete(`/api/gyms/${gym.id}/comments/${comment.body.comment.id}`).set('Origin', origin)).status).toBe(
    200
  );
  expect((await b.get(`/api/gyms/${gym.id}/comments`)).body.comments).toHaveLength(0);
});
it('edits gym details and ordered grades without detaching recorded sends or overwriting newer edits', async () => {
  const a = await member('editor');
  let gym = (await a.get('/api/gyms')).body.gyms[0];
  const grade = gym.grades[0];
  await a
    .post('/api/me/climbing')
    .set('Origin', origin)
    .send({
      requestId: crypto.randomUUID(),
      gymId: gym.id,
      visitedOn: '2026-01-01',
      note: '',
      sends: [{gradeId: grade.id, count: 3}],
    });
  const input = {
    revision: gym.revision,
    name: gym.name + ' 수정',
    grades: [
      {name: '검정', color: '#303238'},
      {id: grade.id, name: grade.name, color: grade.color},
    ],
  };
  const result = await a.patch(`/api/gyms/${gym.id}`).set('Origin', origin).send(input);
  expect(result.status).toBe(200);
  gym = result.body.gym;
  expect(gym.grades.map((g: {name: string}) => g.name)).toEqual(['검정', grade.name]);
  expect(gym.grades[1].id).toBe(grade.id);
  expect((await a.patch(`/api/gyms/${gym.id}`).set('Origin', origin).send(input)).status).toBe(409);
  expect(
    (
      await a
        .patch(`/api/gyms/${gym.id}`)
        .set('Origin', origin)
        .send({revision: gym.revision, name: gym.name, grades: []})
    ).status
  ).toBe(409);
  expect((await a.get('/api/me/climbing')).body.visits[0].sends[0]).toMatchObject({gradeId: grade.id, count: 3});
});
it('keeps the grade addition limit consistent with the editor', async () => {
  const a = await member('limit');
  const gym = (await a.get('/api/gyms')).body.gyms[0];
  for (let i = 0; i < 39; i++)
    await db
      .prepare('INSERT INTO gymGrades(id,gymId,name,color,createdAt,sortOrder) VALUES(?,?,?,?,?,?)')
      .run(`limit-${i}`, gym.id, `난이도${i}`, '#888888', '2026-01-01', i + 1);
  expect(
    (await a.post(`/api/gyms/${gym.id}/grades`).set('Origin', origin).send({name: '초과', color: '#888888'})).status
  ).toBe(400);
});
