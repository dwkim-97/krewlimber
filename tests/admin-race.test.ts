import {randomBytes} from 'node:crypto';
import request from 'supertest';
import {expect, it} from 'vitest';
import {createApp} from '../server/app';
import {createAccount, hashToken} from '../server/auth';
import {openDatabase} from '../server/db';
import {transaction, type Database} from '../server/database';
it('cannot restore administrator privileges with a request queued before demotion', async () => {
  const source = openDatabase(':memory:');
  const actor = await createAccount(source, {
    username: 'admin.race',
    password: '1234',
    nickname: '관리자',
    role: 'admin',
    status: 'approved',
  });
  await createAccount(source, {
    username: 'admin.owner',
    password: '1234',
    nickname: '운영진',
    role: 'admin',
    status: 'approved',
  });
  const token = randomBytes(32).toString('hex');
  source
    .prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)')
    .run(hashToken(token), actor.id, Date.now() + 60000);
  let demotion: Promise<void> | undefined;
  const db: Database = {
    prepare(sql) {
      const statement = source.prepare(sql);
      return {
        get(...values) {
          const row = statement.get(...values);
          if (sql.includes('FROM sessions s JOIN users') && !demotion) {
            demotion = transaction(db, () => {
              source.prepare("UPDATE users SET role='member' WHERE id=?").run(actor.id);
              source.prepare('DELETE FROM sessions WHERE userId=?').run(actor.id);
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
    const response = await request(
      createApp({db, origin: 'http://localhost:4173', secureCookies: false, trustProxy: false})
    )
      .patch(`/api/admin/users/${actor.id}`)
      .set('Origin', 'http://localhost:4173')
      .set('Cookie', `krew_session=${token}`)
      .send({role: 'admin', status: 'approved', reason: '권한 변경'});
    await demotion;
    expect([401, 403]).toContain(response.status);
    expect(source.prepare('SELECT role FROM users WHERE id=?').get(actor.id)!.role).toBe('member');
  } finally {
    source.close();
  }
});
