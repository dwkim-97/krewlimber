import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {openDatabase} from '../server/db';

it('extends v5 metric constraints without losing records, definition order or featured selections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'krew-gray-'));
  const path = join(dir, 'test.sqlite');
  try {
    let db = openDatabase(path);
    db.exec(`
      DROP TABLE featuredAchievements; DROP TABLE activityStats; DROP TABLE achievementDefinitions;
      CREATE TABLE activityStats(userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,quarter TEXT NOT NULL,
        metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple')),
        value INTEGER NOT NULL CHECK(value>=0 AND value<=1000000 AND typeof(value)='integer'),PRIMARY KEY(userId,quarter,metric));
      CREATE TABLE achievementDefinitions(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL,
        metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple')),
        target INTEGER NOT NULL CHECK(target>0 AND target<=1000000 AND typeof(target)='integer'));
      CREATE TABLE featuredAchievements(userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        achievementId TEXT NOT NULL REFERENCES achievementDefinitions(id) ON DELETE CASCADE);
      INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('old','old.user','keep-hash','기존 회원','member','approved','2026-01-01');
      INSERT INTO sessions VALUES('keep-session','old',9999999999999);
      INSERT INTO activityStats VALUES('old','2026-Q4','purple',12);
      INSERT INTO achievementDefinitions(rowid,id,name,description,metric,target) VALUES(7,'custom','기존 업적','보존','purple',10);
      INSERT INTO featuredAchievements VALUES('old','custom');
      INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt) VALUES('old',500,'기존 지급','old','grant','2026-10-01T00:00:00.000Z');
      PRAGMA user_version=5;
    `);
    db.close();
    db = openDatabase(path);
    expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(6);
    expect(db.prepare("SELECT passwordHash FROM users WHERE id='old'").get()!.passwordHash).toBe('keep-hash');
    expect(db.prepare('SELECT * FROM featuredAchievements').get()).toMatchObject({
      userId: 'old',
      achievementId: 'custom',
    });
    expect(db.prepare("SELECT rowid,* FROM achievementDefinitions WHERE id='custom'").get()).toMatchObject({
      rowid: 7,
      name: '기존 업적',
    });
    expect(db.prepare("SELECT value FROM activityStats WHERE metric='purple'").get()!.value).toBe(12);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n).toBe(1);
    expect(db.prepare('SELECT SUM(amount) AS n FROM pointLedger').get()!.n).toBe(500);
    db.prepare("INSERT INTO activityStats VALUES('old','2026-Q4','gray',5)").run();
    db.prepare("INSERT INTO achievementDefinitions VALUES('gray-test','회색 테스트','조건','gray',10)").run();
    expect(() => db.prepare("INSERT INTO activityStats VALUES('old','2026-Q4','unknown',1)").run()).toThrow();
    expect(() => db.prepare("UPDATE activityStats SET value=-1 WHERE metric='gray'").run()).toThrow();
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.prepare("SELECT id FROM achievementDefinitions WHERE id='theclimb-red-50'").get()).toBeUndefined();
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT achievementId FROM featuredAchievements').get()!.achievementId).toBe('custom');
    expect(db.prepare("SELECT COUNT(*) AS n FROM achievementDefinitions WHERE metric='pointsEarned'").get()!.n).toBe(3);
    db.close();
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
