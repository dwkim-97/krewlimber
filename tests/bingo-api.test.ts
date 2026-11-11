import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';
import {openPostgresTestDatabase} from './postgres-test-db';

const origin = 'http://localhost:4173';
const base = '/api/event/bingo';
it.each(['sqlite', 'postgres'])(
  'shares a board while enforcing phases, revisions and member-only marks (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:');
    try {
      const app = createApp({db, origin, secureCookies: false, trustProxy: false});
      const guest = request.agent(app),
        other = request.agent(app),
        admin = request.agent(app),
        member = request.agent(app);
      const account = await createAccount(db, {
        username: 'bingo.member',
        nickname: '빙고회원',
        password: 'testpass',
        role: 'member',
        status: 'approved',
      });
      await createAccount(db, {
        username: 'bingo.admin',
        nickname: '운영진',
        password: 'testpass',
        role: 'staff',
        status: 'approved',
      });
      expect((await guest.get(base)).body).toMatchObject({
        event: null,
        team: null,
        isMember: false,
        canMark: false,
        rankings: [],
      });
      expect((await guest.get(base + '/admin')).status).toBe(401);
      for (const [agent, username] of [
        [admin, 'bingo.admin'],
        [member, 'bingo.member'],
      ] as const)
        expect(
          (await agent.post('/api/auth/login').set('Origin', origin).send({username, password: 'testpass'})).status
        ).toBe(200);
      expect((await member.get(base + '/admin')).status).toBe(403);
      expect(
        (
          await admin
            .post(base + '/admin/events')
            .set('Origin', origin)
            .send({maxValue: 24})
        ).status
      ).toBe(400);
      let adminState = (
        await admin
          .post(base + '/admin/events')
          .set('Origin', origin)
          .send({maxValue: 75})
      ).body;
      expect(adminState.event).toMatchObject({maxValue: 75, phase: 'collecting'});
      expect(
        (
          await admin
            .post(base + '/admin/events')
            .set('Origin', origin)
            .send({maxValue: 75})
        ).status
      ).toBe(409);
      adminState = (
        await admin
          .post(base + '/admin/teams')
          .set('Origin', origin)
          .send({eventId: adminState.event.id, name: '1조'})
      ).body;
      const code = adminState.teams[0].code;
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(
        (
          await admin
            .post(base + '/admin/teams')
            .set('Origin', origin)
            .send({eventId: adminState.event.id, name: '1조'})
        ).status
      ).toBe(409);
      expect(
        (
          await guest
            .post(base + '/join')
            .set('Origin', origin)
            .send({code: 'UNKNOWN1'})
        ).status
      ).toBe(404);
      const join = await guest
        .post(base + '/join')
        .set('Origin', origin)
        .send({code});
      expect(join.status).toBe(200);
      expect(String(join.headers['set-cookie'])).toContain('HttpOnly');
      expect(JSON.stringify(join.body)).not.toContain(code);
      await other
        .post(base + '/join')
        .set('Origin', origin)
        .send({code});
      await member
        .post(base + '/join')
        .set('Origin', origin)
        .send({code});
      let state = join.body;
      const target = () => ({eventId: state.event.id, teamId: state.team.id, revision: state.team.revision});
      expect((await guest.post(base + '/numbers').send({number: 1, ...target()})).status).toBe(403);
      expect(
        (
          await guest
            .post(base + '/numbers')
            .set('Origin', origin)
            .send({number: 76, ...target()})
        ).status
      ).toBe(400);
      for (let number = 1; number <= 25; number++) {
        const saved = await guest
          .post(base + '/numbers')
          .set('Origin', origin)
          .send({number, ...target()});
        expect(saved.status).toBe(200);
        state = saved.body;
      }
      expect((await other.get(base)).body.team.acquired).toHaveLength(25);
      expect(
        (
          await other
            .post(base + '/numbers')
            .set('Origin', origin)
            .send({eventId: state.event.id, teamId: state.team.id, number: 26, revision: 0})
        ).status
      ).toBe(409);
      expect(
        (
          await guest
            .put(base + '/board')
            .set('Origin', origin)
            .send({board: Array(25).fill(1), ...target()})
        ).status
      ).toBe(400);
      expect(
        (
          await guest
            .put(base + '/board')
            .set('Origin', origin)
            .send({board: Array.from({length: 25}, (_, i) => i + 2), ...target()})
        ).status
      ).toBe(400);
      const board = Array.from({length: 25}, (_, i) => i + 1);
      const beforeBoardRevision = (await admin.get(base + '/admin')).body.event.revision;
      state = (
        await guest
          .put(base + '/board')
          .set('Origin', origin)
          .send({board, ...target()})
      ).body;
      expect(state.team.ready).toBe(true);
      expect(
        (
          await admin
            .post(base + '/admin/start')
            .set('Origin', origin)
            .send({eventId: state.event.id, revision: beforeBoardRevision})
        ).status
      ).toBe(409);
      expect(
        (
          await guest
            .delete(base + '/numbers/1')
            .set('Origin', origin)
            .send({...target()})
        ).status
      ).toBe(409);
      adminState = (await admin.get(base + '/admin')).body;
      adminState = (
        await admin
          .post(base + '/admin/start')
          .set('Origin', origin)
          .send({eventId: adminState.event.id, revision: adminState.event.revision})
      ).body;
      expect(adminState.event.phase).toBe('playing');
      expect(
        (
          await guest
            .post(base + '/numbers')
            .set('Origin', origin)
            .send({number: 26, ...target()})
        ).status
      ).toBe(409);
      expect(
        (
          await guest
            .put(base + '/marks')
            .set('Origin', origin)
            .send({number: 1, checked: true, ...target()})
        ).status
      ).toBe(401);
      state = (await member.get(base)).body;
      expect(state.canMark).toBe(true);
      expect(
        (
          await member
            .put(base + '/marks')
            .set('Origin', origin)
            .send({number: 26, checked: true, ...target()})
        ).status
      ).toBe(400);
      for (let number = 1; number <= 25; number++) {
        const checked = await member
          .put(base + '/marks')
          .set('Origin', origin)
          .send({number, checked: true, ...target()});
        expect(checked.status).toBe(200);
        state = checked.body;
      }
      expect(state.team.lines).toBe(12);
      expect(state.rankings).toMatchObject([{name: '1조', lines: 12, rank: 1}]);
      expect((await guest.get(base)).body.rankings).toMatchObject([{name: '1조', lines: 12, rank: 1}]);
      expect((await request(app).get(base)).body.rankings).toEqual([]);
      expect((await admin.get(base + '/admin')).body.rankings).toMatchObject([{name: '1조', lines: 12, rank: 1}]);
      expect((await other.get(base)).body.team.marked).toHaveLength(25);
      await db.prepare("UPDATE users SET status='pending' WHERE id=?").run(account.id);
      expect(
        (
          await member
            .put(base + '/marks')
            .set('Origin', origin)
            .send({number: 1, checked: false, ...target()})
        ).status
      ).toBe(403);
      await db.prepare("UPDATE users SET status='approved' WHERE id=?").run(account.id);
      adminState = (
        await admin
          .post(base + '/admin/finish')
          .set('Origin', origin)
          .send({eventId: adminState.event.id, revision: adminState.event.revision})
      ).body;
      expect(adminState.rankings).toMatchObject([{name: '1조', lines: 12, rank: 1}]);
      state = (await guest.get(base)).body;
      expect(state.rankings).toMatchObject([{name: '1조', lines: 12, rank: 1}]);
      expect((await request(app).get(base)).body.rankings).toEqual([]);
      expect(state.canMark).toBe(false);
      expect(
        (
          await member
            .put(base + '/marks')
            .set('Origin', origin)
            .send({number: 1, checked: false, ...target()})
        ).status
      ).toBe(409);
      expect(
        (
          await admin
            .post(base + '/admin/events')
            .set('Origin', origin)
            .send({maxValue: 50})
        ).status
      ).toBe(201);
      expect((await guest.get(base)).body.team).toBeNull();
      expect(
        (
          await guest
            .post(base + '/join')
            .set('Origin', origin)
            .send({code})
        ).status
      ).toBe(404);
    } finally {
      await db.close();
    }
  },
  30000
);
