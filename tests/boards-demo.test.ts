import {expect, it} from 'vitest';
import {openDatabase} from '../server/db';
import {seedBoardDemo} from '../server/boards-demo';
import {getWallet} from '../server/market';

it('seeds board examples idempotently without resetting balances, orders or credentials', async () => {
  const db = openDatabase(':memory:');
  try {
    const id = '33333333-3333-4333-8333-333333333333';
    await db
      .prepare(
        "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES(?,'test.admin','keep-password','운영진','admin','approved','2026-01-01')"
      )
      .run(id);
    await seedBoardDemo(db);
    const before = await getWallet(db, id);
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM marketOrders').get())!.n;
    await seedBoardDemo(db);
    expect(await getWallet(db, id)).toEqual(before);
    expect(before.balance).toBe(1700);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM marketOrders').get())!.n).toBe(count);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM notices').get())!.n).toBe(14);
    expect((await db.prepare('SELECT passwordHash FROM users WHERE id=?').get(id))!.passwordHash).toBe('keep-password');
  } finally {
    db.close();
  }
});
