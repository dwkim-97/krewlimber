import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {openDatabase} from '../server/db';

it('migrates v2 without changing existing accounts, sessions or achievement definitions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'krew-boards-'));
  const file = join(directory, 'test.sqlite');
  try {
    let db = openDatabase(file);
    await db
      .prepare(
        "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('existing','existing.user','old-hash','기존 회원','admin','approved','2026-01-01')"
      )
      .run();
    await db
      .prepare("INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES('session','existing',9999999999999)")
      .run();
    await db.prepare("DELETE FROM achievementDefinitions WHERE id='theclimb-red-50'").run();
    db.exec(
      'DROP TABLE pointLedger;DROP TABLE marketOrders;DROP TABLE marketProducts;DROP TABLE notices;PRAGMA user_version=2;'
    );
    db.close();
    db = openDatabase(file);
    expect((await db.prepare('PRAGMA user_version').get())!.user_version).toBe(7);
    expect((await db.prepare("SELECT passwordHash FROM users WHERE id='existing'").get())!.passwordHash).toBe(
      'old-hash'
    );
    expect((await db.prepare('SELECT count(*) AS n FROM sessions').get())!.n).toBe(1);
    expect((await db.prepare('SELECT count(*) AS n FROM achievementDefinitions').get())!.n).toBe(14);
    expect((await db.prepare('SELECT count(*) AS n FROM marketProducts').get())!.n).toBe(0);
    db.close();
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
