import {mkdirSync, chmodSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_ACHIEVEMENTS} from '../src/consts/progression';

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(path);
  const version = Number(db.prepare('PRAGMA user_version').get()!.user_version);
  if (version > 2) {
    db.close();
    throw new Error('Unsupported database version.');
  }
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      passwordHash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      gym TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '입문',
      role TEXT NOT NULL CHECK(role IN ('member', 'admin')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'suspended')),
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      tokenHash TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expiresAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(userId);
    CREATE TABLE IF NOT EXISTS recoveryTokens (
      userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS honors (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('send', 'growth', 'crew')),
      achievedAt TEXT NOT NULL,
      createdBy TEXT NOT NULL REFERENCES users(id),
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auditLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actorId TEXT NOT NULL REFERENCES users(id),
      targetId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  if (version < 2)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 2) return;
      db.exec(`
      CREATE TABLE activityStats (
        userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quarter TEXT NOT NULL,
        metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple')),
        value INTEGER NOT NULL CHECK(value >= 0 AND value <= 1000000 AND typeof(value) = 'integer'),
        PRIMARY KEY(userId,quarter,metric)
      );
      CREATE TABLE achievementDefinitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple')),
        target INTEGER NOT NULL CHECK(target > 0 AND target <= 1000000 AND typeof(target) = 'integer')
      );
      CREATE TABLE featuredAchievements (
        userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        achievementId TEXT NOT NULL REFERENCES achievementDefinitions(id) ON DELETE CASCADE
      );
    `);
      const insert = db.prepare(
        'INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES(?,?,?,?,?)'
      );
      for (const achievement of DEFAULT_ACHIEVEMENTS)
        insert.run(achievement.id, achievement.name, achievement.description, achievement.metric, achievement.target);
      db.exec('PRAGMA user_version = 2;');
    });
  return db;
}

export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
