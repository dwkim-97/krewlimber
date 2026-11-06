import {afterEach, beforeEach, expect, it} from 'vitest';
import request from 'supertest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';

const origin = 'http://localhost:4173';
const password = 'climbing records password';
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp({db, origin, secureCookies: false, trustProxy: false});
});
afterEach(() => db.close());
async function member(username: string, status: 'approved' | 'pending') {
  const user = await createAccount(db, {username, nickname: username, password, role: 'member', status});
  const agent = request.agent(app);
  await agent.post('/api/auth/login').set('Origin', origin).send({username, password}).expect(200);
  return {user, agent};
}
const red = {key: 'red', name: '빨강', hex: '#ef4444', count: 50};
const payload = (gymId: string) => ({date: '2026-10-01', gymId, colors: [red]});
async function gyms(agent: ReturnType<typeof request.agent>) {
  const result = await agent.get('/api/gyms').expect(200);
  expect(result.body.exhaustive).toBe(false);
  return result.body.gyms as {id: string; name: string; franchiseId: string}[];
}
it('restricts the catalog and all records to approved members and their own visits', async () => {
  await request(app).get('/api/gyms').expect(401);
  const pending = await member('waiting.records', 'pending');
  await pending.agent.get('/api/gyms').expect(403);
  await pending.agent.get('/api/me/climbs').expect(403);
  const a = await member('owner.records', 'approved');
  const b = await member('other.records', 'approved');
  const list = await gyms(a.agent);
  const input = payload(list.find(g => g.franchiseId === 'theclimb')!.id);
  const created = await a.agent.post('/api/me/climbs').set('Origin', origin).send(input).expect(201);
  expect((await b.agent.get('/api/me/climbs')).body.records).toEqual([]);
  await b.agent.put(`/api/me/climbs/${created.body.record.id}`).set('Origin', origin).send(input).expect(404);
  await b.agent.delete(`/api/me/climbs/${created.body.record.id}`).set('Origin', origin).expect(404);
  await pending.agent.post('/api/me/climbs').set('Origin', origin).send(input).expect(403);
});
it('counts one visit per date and gym and separates franchise colors from custom colors', async () => {
  const {agent, user} = await member('count.records', 'approved');
  const list = await gyms(agent);
  const branches = list.filter(g => g.franchiseId === 'theclimb');
  const other = list.find(g => g.franchiseId === 'seoulforest')!;
  const first = await agent.post('/api/me/climbs').set('Origin', origin).send(payload(branches[0].id)).expect(201);
  await agent.post('/api/me/climbs').set('Origin', origin).send(payload(branches[0].id)).expect(409);
  await agent
    .post('/api/me/climbs')
    .set('Origin', origin)
    .send({
      ...payload(branches[1].id),
      colors: [
        {...red, count: 2},
        {key: 'custom-123abc', name: '우주색', hex: '#123abc', count: 3},
      ],
    })
    .expect(201);
  await agent
    .post('/api/me/climbs')
    .set('Origin', origin)
    .send({...payload(other.id), colors: [{...red, count: 99}]})
    .expect(201);
  db.prepare("INSERT INTO activityStats VALUES(?, '2026-Q4','red',1000)").run(user.id);
  const titles = (await agent.get('/api/titles?quarter=2026-Q4')).body.categories;
  expect(titles.find((c: {id: string}) => c.id === 'participation').standings[0].value).toBe(3);
  expect(titles.find((c: {id: string}) => c.id === 'red').standings[0].value).toBe(52);
  const summary = (await agent.get('/api/me/climbing-summary')).body;
  expect(summary).toMatchObject({visits: 3, totalSends: 154});
  const group = summary.groups.find((g: {franchiseId: string}) => g.franchiseId === 'theclimb');
  expect(group).toMatchObject({visits: 2, totalSends: 55});
  expect(group.branches).toHaveLength(2);
  expect(group.colors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({key: 'red', count: 52}),
      expect.objectContaining({name: '우주색', hex: '#123abc', count: 3}),
    ])
  );
  await agent
    .patch('/api/me/featured-achievement')
    .set('Origin', origin)
    .send({achievementId: 'theclimb-red-50'})
    .expect(200);
  await agent
    .put(`/api/me/climbs/${first.body.record.id}`)
    .set('Origin', origin)
    .send({...payload(branches[0].id), colors: []})
    .expect(200);
  expect((await agent.get('/api/me/achievements')).body.featuredAchievementId).toBeNull();
  await agent.delete(`/api/me/climbs/${first.body.record.id}`).set('Origin', origin).expect(200);
  expect((await agent.get('/api/me/climbing-summary')).body.visits).toBe(2);
});
it('validates dates, catalog IDs, color identity and count bounds without creating records', async () => {
  const {agent} = await member('validation.records', 'approved');
  const branch = (await gyms(agent)).find(g => g.franchiseId === 'theclimb')!;
  const input = payload(branch.id);
  for (const invalid of [
    {...input, date: '2026-02-30'},
    {...input, date: '2999-01-01'},
    {...input, gymId: 'made-up'},
    {...input, gymId: 'constructor'},
    {...input, gymId: 'toString'},
    {...input, colors: [{...red, count: -1}]},
    {...input, colors: [{...red, count: 1.5}]},
    {...input, colors: [{...red, hex: '#123abc'}]},
    {...input, colors: [red, red]},
    {...input, colors: [{key: 'custom-123abc', name: '', hex: '#123abc', count: 1}]},
  ])
    await agent.post('/api/me/climbs').set('Origin', origin).send(invalid).expect(400);
  expect((await agent.get('/api/me/climbs')).body.records).toEqual([]);
  await agent
    .post('/api/me/climbs')
    .set('Origin', origin)
    .send({...input, colors: []})
    .expect(201);
});
it('uses the visit date for quarters and rolls back a change when the audit write fails', async () => {
  const {agent} = await member('quarter.records', 'approved');
  const branch = (await gyms(agent)).find(g => g.franchiseId === 'theclimb')!;
  const input = {...payload(branch.id), date: '2025-12-31'};
  const created = await agent.post('/api/me/climbs').set('Origin', origin).send(input).expect(201);
  const board = (await agent.get('/api/titles')).body;
  expect(board.quarters).toContain('2025-Q4');
  expect(
    (await agent.get('/api/titles?quarter=2025-Q4')).body.categories.find((c: {id: string}) => c.id === 'red')
      .standings[0].value
  ).toBe(50);
  db.exec(
    "CREATE TRIGGER reject_climb_audit BEFORE INSERT ON auditLog WHEN NEW.action LIKE 'climb.%' BEGIN SELECT RAISE(ABORT,'test audit failure'); END"
  );
  await agent.delete(`/api/me/climbs/${created.body.record.id}`).set('Origin', origin).expect(500);
  expect((await agent.get('/api/me/climbs')).body.records).toHaveLength(1);
});

it('canonicalizes duplicate Kakao listings before duplicate checks, summaries and title aggregation', async () => {
  const {agent} = await member('alias.records', 'approved');
  const catalog = (await agent.get('/api/gyms')).body;
  expect(catalog.gyms.some((g: {id: string}) => g.id === '2003676296')).toBe(false);
  expect(catalog.gyms.find((g: {id: string}) => g.id === '953399573').aliases).toContain('더월클라이밍');
  const input = payload('2003676296');
  const saved = await agent.post('/api/me/climbs').set('Origin', origin).send(input).expect(201);
  expect(saved.body.record.gymId).toBe('953399573');
  expect(saved.body.record.gym.franchiseId).toBe('theclimb');
  await agent.post('/api/me/climbs').set('Origin', origin).send(payload('953399573')).expect(409);
  const board = (await agent.get('/api/titles?quarter=2026-Q4')).body;
  expect(board.categories.find((c: {id: string}) => c.id === 'participation').standings[0].value).toBe(1);
  expect(board.categories.find((c: {id: string}) => c.id === 'red').standings[0].value).toBe(50);
  expect((await agent.get('/api/me/climbing-summary')).body.groups[0]).toMatchObject({
    franchiseId: 'theclimb',
    visits: 1,
    totalSends: 50,
  });
});
