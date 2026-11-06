import {mkdirSync, chmodSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import gymCatalog from './gyms.catalog.json';
import {canonicalGymId} from './gym-catalog';
import {INITIAL_ACHIEVEMENTS, ADDITIONAL_ACHIEVEMENTS} from '../src/consts/progression';

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(path);
  const version = Number(db.prepare('PRAGMA user_version').get()!.user_version);
  if (version > 8) {
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
      for (const achievement of INITIAL_ACHIEVEMENTS)
        insert.run(achievement.id, achievement.name, achievement.description, achievement.metric, achievement.target);
      db.exec('PRAGMA user_version = 2;');
    });
  if (version < 3)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 3) return;
      db.exec(`
        CREATE TABLE notices (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
          views INTEGER NOT NULL DEFAULT 0 CHECK(views >= 0),
          authorId TEXT NOT NULL REFERENCES users(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
        CREATE TABLE marketProducts (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, imageUrl TEXT,
          category TEXT NOT NULL CHECK(category IN ('gear','apparel','voucher','other')),
          points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 1000000 AND typeof(points)='integer'),
          stock INTEGER NOT NULL CHECK(stock BETWEEN 0 AND 1000000 AND typeof(stock)='integer'),
          active INTEGER NOT NULL CHECK(active IN (0,1)), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
        CREATE TABLE marketOrders (
          id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id),
          productId TEXT NOT NULL REFERENCES marketProducts(id), productName TEXT NOT NULL, imageUrl TEXT,
          points INTEGER NOT NULL CHECK(points>0), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
          total INTEGER NOT NULL CHECK(total=points*quantity),
          status TEXT NOT NULL CHECK(status IN ('pending','completed','cancelled')),
          requestId TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
          UNIQUE(userId,requestId)
        );
        CREATE TABLE pointLedger (
          id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL REFERENCES users(id),
          amount INTEGER NOT NULL CHECK(amount!=0 AND typeof(amount)='integer'), reason TEXT NOT NULL,
          actorId TEXT NOT NULL REFERENCES users(id), orderId TEXT REFERENCES marketOrders(id),
          kind TEXT NOT NULL CHECK(kind IN ('grant','purchase','refund')), createdAt TEXT NOT NULL,
          CHECK((kind='grant' AND orderId IS NULL) OR (kind='purchase' AND amount<0 AND orderId IS NOT NULL) OR (kind='refund' AND amount>0 AND orderId IS NOT NULL)),
          UNIQUE(orderId,kind)
        );
        CREATE INDEX notices_order ON notices(pinned DESC,createdAt DESC,id DESC);
        CREATE INDEX pointLedger_user ON pointLedger(userId,id DESC);
        CREATE INDEX marketOrders_user ON marketOrders(userId,createdAt DESC,id DESC);
        CREATE INDEX marketOrders_status ON marketOrders(status,createdAt DESC,id DESC);
        PRAGMA user_version=3;
      `);
    });
  if (version < 4)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 4) return;
      db.exec(
        'ALTER TABLE marketProducts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0); PRAGMA user_version=4;'
      );
    });
  if (version < 5)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 5) return;
      db.exec(
        'ALTER TABLE pointLedger ADD COLUMN requestId TEXT; CREATE UNIQUE INDEX pointLedger_request ON pointLedger(actorId,requestId) WHERE requestId IS NOT NULL; PRAGMA user_version=5;'
      );
    });
  if (version < 6)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 6) return;
      db.exec(`
        CREATE TEMP TABLE preservedFeatured AS SELECT userId,achievementId FROM featuredAchievements;
        DROP TABLE featuredAchievements;
        CREATE TABLE activityStats_v6 (
          userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, quarter TEXT NOT NULL,
          metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple','gray')),
          value INTEGER NOT NULL CHECK(value>=0 AND value<=1000000 AND typeof(value)='integer'),
          PRIMARY KEY(userId,quarter,metric)
        );
        INSERT INTO activityStats_v6 SELECT userId,quarter,metric,value FROM activityStats;
        DROP TABLE activityStats;
        ALTER TABLE activityStats_v6 RENAME TO activityStats;
        CREATE TABLE achievementDefinitions_v6 (
          id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
          metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple','gray','pointsEarned','pointsSpent')),
          target INTEGER NOT NULL CHECK(target>0 AND target<=1000000 AND typeof(target)='integer')
        );
        INSERT INTO achievementDefinitions_v6(rowid,id,name,description,metric,target)
          SELECT rowid,id,name,description,metric,target FROM achievementDefinitions;
        DROP TABLE achievementDefinitions;
        ALTER TABLE achievementDefinitions_v6 RENAME TO achievementDefinitions;
        CREATE TABLE featuredAchievements (
          userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          achievementId TEXT NOT NULL REFERENCES achievementDefinitions(id) ON DELETE CASCADE
        );
        INSERT INTO featuredAchievements SELECT userId,achievementId FROM preservedFeatured;
        DROP TABLE preservedFeatured;
      `);
      const insert = db.prepare(
        'INSERT OR IGNORE INTO achievementDefinitions(id,name,description,metric,target) VALUES(?,?,?,?,?)'
      );
      for (const achievement of ADDITIONAL_ACHIEVEMENTS)
        insert.run(achievement.id, achievement.name, achievement.description, achievement.metric, achievement.target);
      db.exec('PRAGMA user_version=6;');
    });
  if (version < 7)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 7) return;
      db.exec("ALTER TABLE users ADD COLUMN instagramUrl TEXT NOT NULL DEFAULT ''; PRAGMA user_version=7;");
    });
  if (version < 8)
    transaction(db, () => {
      if (Number(db.prepare('PRAGMA user_version').get()!.user_version) >= 8) return;
      db.exec(`
        CREATE TABLE climbingGyms (id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT NOT NULL,region TEXT NOT NULL,franchiseId TEXT NOT NULL,franchiseName TEXT NOT NULL,url TEXT NOT NULL);
        CREATE TABLE climbingVisits (id TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,gymId TEXT NOT NULL REFERENCES climbingGyms(id),date TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,UNIQUE(userId,date,gymId));
        CREATE TABLE climbingColors (visitId TEXT NOT NULL REFERENCES climbingVisits(id) ON DELETE CASCADE,colorKey TEXT NOT NULL,name TEXT NOT NULL,hex TEXT NOT NULL,count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 1000 AND typeof(count)='integer'),PRIMARY KEY(visitId,colorKey));
        CREATE INDEX climbingVisits_user ON climbingVisits(userId,date DESC,id);
        DELETE FROM featuredAchievements WHERE achievementId IN (SELECT id FROM achievementDefinitions WHERE metric IN ('participation','red','pink','purple','gray'));
        PRAGMA user_version=8;
      `);
    });
  transaction(db, () => {
    const insert =
      db.prepare(`INSERT INTO climbingGyms(id,name,address,region,franchiseId,franchiseName,url) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address,region=excluded.region,franchiseId=excluded.franchiseId,franchiseName=excluded.franchiseName,url=excluded.url`);
    for (const gym of gymCatalog.gyms) {
      const canonical = gymCatalog.gyms.find(g => g.id === canonicalGymId(gym.id))!;
      insert.run(gym.id, gym.name, gym.address, gym.region, canonical.franchiseId, canonical.franchiseName, gym.url);
    }
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
