import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {PostgresDatabase} from '../server/database';

it('runs signup, session and profile APIs against PostgreSQL', async () => {
  const engine = new PGlite();
  await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await engine.exec(readFileSync('supabase/migrations/202611060001_initial.sql', 'utf8'));
  await engine.exec(readFileSync('supabase/migrations/202611060002_rate_limits.sql', 'utf8'));
  await engine.exec(readFileSync('supabase/migrations/202611060003_staff_role.sql', 'utf8'));
  const db = new PostgresDatabase({
    query: async (sql, values) => {
      const r = await engine.query(sql, values);
      return {rows: r.rows as Record<string, unknown>[], rowCount: r.affectedRows ?? r.rows.length};
    },
    connect: async () => ({
      query: async (sql, values) => {
        const r = await engine.query(sql, values);
        return {rows: r.rows as Record<string, unknown>[], rowCount: r.affectedRows ?? r.rows.length};
      },
      release() {},
    }),
    end: async () => engine.close(),
  });
  try {
    const origin = 'http://localhost:4173';
    const app = createApp({db, origin, secureCookies: false, trustProxy: false});
    const agent = request.agent(app);
    expect(
      (
        await agent
          .post('/api/auth/signup')
          .set('Origin', origin)
          .send({username: 'pg.member', password: '1234', nickname: '크루'})
      ).status
    ).toBe(201);
    const current = await agent.get('/api/me');
    expect(current.body.user).toMatchObject({username: 'pg.member', status: 'pending', nickname: '크루'});
    expect(current.body.user.passwordHash).toBeUndefined();
    expect((await agent.get('/api/members')).status).toBe(403);
    await db.prepare("UPDATE users SET status='approved' WHERE username=?").run('pg.member');
    const members = await agent.get('/api/members');
    expect(members.status).toBe(200);
    expect(members.body.members[0]).toMatchObject({nickname: '크루', titles: [], featuredAchievement: null});
    expect((await agent.get('/api/titles')).status).toBe(200);
    expect((await agent.get('/api/me/achievements')).body.achievements).toHaveLength(8);
    expect((await agent.get('/api/notices')).body.items).toEqual([]);
    expect((await agent.get('/api/market/products')).body.items).toEqual([]);
    expect((await agent.get('/api/me/wallet')).body.balance).toBe(0);
    expect((await agent.post('/api/auth/logout').set('Origin', origin)).status).toBe(200);
    expect((await agent.get('/api/me')).body.user).toBeNull();
  } finally {
    await db.close();
  }
}, 30000);
