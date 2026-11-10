import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {expect, it} from 'vitest';
import {openDatabase} from '../server/db';

const existing = `
  INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('old','old.member','hash','회원','member','approved','2026-01-01');
  UPDATE achievementDefinitions SET target=37 WHERE id='theclimb-red-50';
  INSERT INTO featuredAchievements(userId,achievementId) VALUES('old','theclimb-red-50');
  INSERT INTO achievementConditions(achievementId,gymId,gradeId,operator,difficultyRank) VALUES('theclimb-red-50','gym-theclimb-gangnam','climb-purple','eq',1);
`;

it('upgrades a previous preview database without losing profiles, targets, conditions or selections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'krew-restore-'));
  const path = join(directory, 'preview.sqlite');
  let db = openDatabase(path);
  try {
    db.exec(existing);
    db.exec(
      "DELETE FROM achievementDefinitions WHERE metric IN ('pointsEarned','pointsSpent') OR id='krew-attended-100'; ALTER TABLE users DROP COLUMN instagramUrl; PRAGMA user_version=6;"
    );
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT instagramUrl FROM users').get()).toMatchObject({instagramUrl: ''});
    expect(db.prepare("SELECT target FROM achievementDefinitions WHERE id='theclimb-red-50'").get()).toMatchObject({
      target: 37,
    });
    expect(db.prepare('SELECT achievementId FROM featuredAchievements').get()).toMatchObject({
      achievementId: 'theclimb-red-50',
    });
    expect(db.prepare('SELECT achievementId FROM achievementConditions').get()).toMatchObject({
      achievementId: 'theclimb-red-50',
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    db.exec("DELETE FROM achievementDefinitions WHERE id='market-earned-1000';");
    db.close();
    db = openDatabase(path);
    expect(db.prepare("SELECT id FROM achievementDefinitions WHERE id='market-earned-1000'").get()).toBeUndefined();
    db.exec("DELETE FROM achievementDefinitions WHERE id='theclimb-red-50';");
    expect(db.prepare('SELECT * FROM featuredAchievements').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM achievementConditions').all()).toEqual([]);
  } finally {
    db.close();
    rmSync(directory, {recursive: true, force: true});
  }
});

it('adds the PostgreSQL fields and achievements while preserving prior rows and private access', async () => {
  const engine = new PGlite();
  try {
    await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    const files = readdirSync('supabase/migrations')
      .filter(f => f.endsWith('.sql'))
      .sort();
    const restored = files.find(f => f.endsWith('_restore_profile_titles.sql'))!;
    for (const file of files.filter(f => f !== restored))
      await engine.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
    await engine.exec(existing);
    await engine.exec(readFileSync('supabase/migrations/' + restored, 'utf8'));
    expect((await engine.query('SELECT instagramUrl FROM users')).rows[0]).toEqual({instagramurl: ''});
    expect(
      (await engine.query("SELECT target FROM achievementDefinitions WHERE id='theclimb-red-50'")).rows[0]
    ).toEqual({target: 37});
    expect((await engine.query('SELECT * FROM featuredAchievements')).rows).toHaveLength(1);
    expect((await engine.query('SELECT * FROM achievementConditions')).rows).toHaveLength(1);
    expect((await engine.query('SELECT * FROM achievementDefinitions')).rows).toHaveLength(15);
    await engine.exec('SET ROLE anon;');
    await expect(engine.query('SELECT instagramUrl FROM users')).rejects.toThrow();
  } finally {
    await engine.close();
  }
}, 30000);
