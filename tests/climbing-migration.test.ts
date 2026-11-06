import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {openDatabase} from '../server/db';
import {getAchievements, getTitleBoard} from '../server/progression';

it('preserves the v6 account and legacy inputs while switching climbing totals to visit records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'krew-visits-'));
  const path = join(dir, 'test.sqlite');
  try {
    let db = openDatabase(path);
    db.exec(`
      INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('old','existing','keep-hash','기존회원','member','approved','2026-01-01');
      INSERT INTO sessions VALUES('keep-session','old',9999999999999);
      INSERT INTO activityStats VALUES('old','2026-Q4','red',50),('old','2026-Q4','hosted',51);
      INSERT INTO featuredAchievements VALUES('old','theclimb-red-50');
      DROP TABLE climbingColors;DROP TABLE climbingVisits;DROP TABLE climbingGyms;
      ALTER TABLE users DROP COLUMN instagramUrl;PRAGMA user_version=6;
    `);
    db.close();
    db = openDatabase(path);
    expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(8);
    expect(db.prepare("SELECT passwordHash,instagramUrl FROM users WHERE id='old'").get()).toMatchObject({
      passwordHash: 'keep-hash',
      instagramUrl: '',
    });
    expect(db.prepare('SELECT * FROM sessions').get()!.tokenHash).toBe('keep-session');
    expect(db.prepare("SELECT value FROM activityStats WHERE metric='red'").get()!.value).toBe(50);
    const board = getTitleBoard(db, '2026-Q4');
    expect(board.categories.find(c => c.id === 'red')!.standings).toEqual([]);
    expect(board.categories.find(c => c.id === 'hosted')!.standings[0].value).toBe(51);
    expect(getAchievements(db, 'old').featuredAchievementId).toBeNull();
    expect(db.prepare('SELECT * FROM featuredAchievements').all()).toEqual([]);
    const gym = db.prepare("SELECT id FROM climbingGyms WHERE franchiseId='theclimb' LIMIT 1").get()!;
    db.prepare('INSERT INTO climbingVisits VALUES(?,?,?,?,?,?)').run(
      'visit',
      'old',
      gym.id,
      '2026-11-01',
      'created',
      'updated'
    );
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT * FROM climbingVisits').all()).toHaveLength(1);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    db.close();
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
