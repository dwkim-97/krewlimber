import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {createAccount, hashPassword} from '../server/auth';
import {openDatabase} from '../server/db';
import {transaction, type Database} from '../server/database';

it('does not retain a session issued concurrently with a password reset', async () => {
  const source = openDatabase(':memory:');
  const user = await createAccount(source, {
    username: 'race.member',
    password: '1234',
    nickname: '크루',
    role: 'member',
    status: 'approved',
  });
  const nextHash = await hashPassword('5678');
  let reset: Promise<void> | undefined;
  const db: Database = {
    prepare(sql) {
      const statement = source.prepare(sql);
      return {
        get(...values) {
          const row = statement.get(...values);
          if (sql === 'SELECT * FROM users WHERE id = ?' && !reset) {
            reset = transaction(db, () => {
              source.prepare('UPDATE users SET passwordHash=? WHERE id=?').run(nextHash, user.id);
              source.prepare('DELETE FROM sessions WHERE userId=?').run(user.id);
            });
          }
          return row;
        },
        all: (...values) => statement.all(...values),
        run: (...values) => statement.run(...values),
      };
    },
    exec: sql => source.exec(sql),
    close: () => source.close(),
  };
  try {
    const agent = request.agent(
      createApp({db, origin: 'http://localhost:4173', secureCookies: false, trustProxy: false})
    );
    const result = await agent
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:4173')
      .send({username: 'race.member', password: '1234'});
    expect([200, 401]).toContain(result.status);
    expect(reset).toBeDefined();
    await reset;
    expect((await agent.get('/api/me')).body.user).toBeNull();
  } finally {
    source.close();
  }
});
