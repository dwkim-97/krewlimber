import {expect, it} from 'vitest';
import {createAccount, verifyPassword} from '../server/auth';
import {openDatabase} from '../server/db';
import {assertDemoDatabase, seedDemoUsers} from '../server/demo-fixtures';
import {currentQuarter, getAchievements, getTitleBoard} from '../server/progression';

it('refuses production and ordinary member database paths', () => {
  expect(() => assertDemoDatabase('/private/tmp/krewlimber-preview.ABC123/test.sqlite', 'production')).toThrow();
  expect(() => assertDemoDatabase('/Users/aiden/Sites/krewlimber/data/krewlimber.sqlite', 'development')).toThrow();
});
it('seeds varied demo cases idempotently without replacing existing admin credentials or sessions', async () => {
  const db = openDatabase(':memory:');
  try {
    const admin = await createAccount(db, {
      username: 'test.admin',
      nickname: '기존 관리자',
      password: 'an existing private password',
      role: 'admin',
      status: 'approved',
    });
    db.prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)').run(
      'existing',
      admin.id,
      Date.now() + 60000
    );
    await seedDemoUsers(db);
    await seedDemoUsers(db);
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toMatchObject({n: 10});
    expect(db.prepare('SELECT userId FROM sessions WHERE tokenHash=?').get('existing')).toMatchObject({
      userId: admin.id,
    });
    const row = db.prepare('SELECT passwordHash FROM users WHERE id=?').get(admin.id) as {passwordHash: string};
    expect(await verifyPassword('an existing private password', row.passwordHash)).toBe(true);
    const board = getTitleBoard(db, currentQuarter(new Date()));
    expect(board.categories.find(x => x.id === 'participation')!.standings[0].nickname).toBe('에이든 · 테스트');
    expect(board.categories.find(x => x.id === 'purple')!.standings.filter(x => x.rank === 1)).toHaveLength(2);
    const rookie = db.prepare("SELECT id FROM users WHERE username='test.rookie'").get() as {id: string};
    expect(getAchievements(db, rookie.id).achievements.some(x => x.earned)).toBe(false);
  } finally {
    db.close();
  }
}, 15000);
