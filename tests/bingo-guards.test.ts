import {randomBytes} from 'node:crypto';
import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {hashToken} from '../server/auth';
import {openDatabase} from '../server/db';
import {openPostgresTestDatabase} from './postgres-test-db';

const origin = 'http://localhost:4173',
  base = '/api/event/bingo';
it.each(['sqlite', 'postgres'])(
  'isolates teams, expires guest access and preserves numbers when resizing (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:');
    try {
      await db
        .prepare("INSERT INTO bingoEvents(id,maxValue,phase,createdAt) VALUES('event',75,'collecting',?)")
        .run(new Date().toISOString());
      for (const [id, code, acquired] of [
        ['ours', 'ABCD2345', [75]],
        ['theirs', 'EFGH6789', [74]],
      ] as const)
        await db
          .prepare('INSERT INTO bingoTeams(id,eventId,name,code,acquired,board) VALUES(?,?,?,?,?,?)')
          .run(id, 'event', id, code, JSON.stringify(acquired), JSON.stringify(Array(25).fill(null)));
      await db
        .prepare(
          "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('staff','guard.staff','hash','운영진','staff','approved',?)"
        )
        .run(new Date().toISOString());
      const token = randomBytes(32).toString('hex');
      await db
        .prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)')
        .run(hashToken(token), 'staff', Date.now() + 60000);
      const app = createApp({db, origin, secureCookies: false, trustProxy: false}),
        guest = request.agent(app),
        other = request.agent(app);
      const joined = await guest
        .post(base + '/join')
        .set('Origin', origin)
        .send({code: 'ABCD2345'});
      expect(joined.body.team.acquired).toEqual([75]);
      expect(JSON.stringify(joined.body)).not.toContain('EFGH6789');
      await other
        .post(base + '/join')
        .set('Origin', origin)
        .send({code: 'ABCD2345'});
      await guest
        .post(base + '/join')
        .set('Origin', origin)
        .send({code: 'EFGH6789'});
      const stale = await guest
        .post(base + '/numbers')
        .set('Origin', origin)
        .send({eventId: 'event', teamId: 'ours', number: 1, revision: 0});
      expect(stale.status).toBe(409);
      expect((await guest.get(base)).body.team.acquired).toEqual([74]);
      await guest
        .post(base + '/join')
        .set('Origin', origin)
        .send({code: 'ABCD2345'});
      const shrink = await request(app)
        .patch(base + '/admin/config')
        .set('Cookie', 'krew_session=' + token)
        .set('Origin', origin)
        .send({eventId: 'event', maxValue: 25, revision: 0});
      expect(shrink.status).toBe(409);
      expect(
        (
          await request(app)
            .post(base + '/admin/start')
            .set('Cookie', 'krew_session=' + token)
            .set('Origin', origin)
            .send({eventId: 'event', revision: 0})
        ).status
      ).toBe(409);
      const enlarged = await request(app)
        .patch(base + '/admin/config')
        .set('Cookie', 'krew_session=' + token)
        .set('Origin', origin)
        .send({eventId: 'event', maxValue: 100, revision: 0});
      expect(enlarged.body.event.maxValue).toBe(100);
      expect(
        (
          await guest
            .put(base + '/board')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', board: Array(25).fill(null), revision: 0})
        ).status
      ).toBe(200);
      expect(
        (
          await guest
            .post(base + '/numbers')
            .set('Origin', origin)
            .send({eventId: 'event', number: 1, revision: 0, teamId: 'theirs'})
        ).status
      ).toBe(409);
      const add = (agent: typeof guest, number: number) =>
        agent
          .post(base + '/numbers')
          .set('Origin', origin)
          .send({eventId: 'event', teamId: 'ours', number, revision: 0});
      const results =
        backend === 'sqlite'
          ? await Promise.all([add(guest, 1), add(other, 2)])
          : [await add(guest, 1), await add(other, 2)];
      expect(results.map(r => r.status).sort()).toEqual([200, 409]);
      expect(
        JSON.parse(String((await db.prepare("SELECT acquired FROM bingoTeams WHERE id='theirs'").get())!.acquired))
      ).toEqual([74]);
      await db.prepare('UPDATE bingoSessions SET expiresAt=0').run();
      expect((await guest.get(base)).body.team).toBeNull();
      expect(
        (
          await guest
            .post(base + '/numbers')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', number: 3, revision: 1})
        ).status
      ).toBe(401);
      if (backend === 'postgres') {
        await db.exec('SET ROLE anon;');
        for (const table of ['bingoEvents', 'bingoTeams', 'bingoSessions'])
          await expect(db.prepare('SELECT * FROM ' + table).all()).rejects.toThrow();
        await db.exec('RESET ROLE;');
      }
    } finally {
      await db.close();
    }
  },
  30000
);

it.each(['sqlite', 'postgres'])(
  'allows clearing a board after acquired numbers drop below 25 (%s)',
  async backend => {
    const db = backend === 'postgres' ? await openPostgresTestDatabase() : openDatabase(':memory:');
    try {
      await db
        .prepare("INSERT INTO bingoEvents(id,maxValue,phase,createdAt) VALUES('event',75,'collecting',?)")
        .run(new Date().toISOString());
      const numbers = Array.from({length: 25}, (_, index) => index + 1);
      await db
        .prepare('INSERT INTO bingoTeams(id,eventId,name,code,acquired,board) VALUES(?,?,?,?,?,?)')
        .run('ours', 'event', '우리 조', 'ABCD2345', JSON.stringify(numbers), JSON.stringify(numbers));
      const guest = request.agent(createApp({db, origin, secureCookies: false, trustProxy: false}));
      await guest
        .post(base + '/join')
        .set('Origin', origin)
        .send({code: 'ABCD2345'});
      const board: (number | null)[] = [...numbers];
      board[24] = null;
      expect(
        (
          await guest
            .put(base + '/board')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', board, revision: 0})
        ).status
      ).toBe(200);
      expect(
        (
          await guest
            .delete(base + '/numbers/25')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', revision: 1})
        ).status
      ).toBe(200);
      board[0] = null;
      const cleared = await guest
        .put(base + '/board')
        .set('Origin', origin)
        .send({eventId: 'event', teamId: 'ours', board, revision: 2});
      expect(cleared.status).toBe(200);
      expect(cleared.body.team.board[0]).toBeNull();
      expect(cleared.body.team.acquired).toHaveLength(24);
      board[0] = 1;
      expect(
        (
          await guest
            .put(base + '/board')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', board, revision: 3})
        ).status
      ).toBe(409);
      expect(
        (
          await guest
            .post(base + '/numbers')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', number: 25, revision: 3})
        ).status
      ).toBe(200);
      expect(
        (
          await guest
            .put(base + '/board')
            .set('Origin', origin)
            .send({eventId: 'event', teamId: 'ours', board, revision: 4})
        ).status
      ).toBe(200);
    } finally {
      await db.close();
    }
  },
  30000
);
