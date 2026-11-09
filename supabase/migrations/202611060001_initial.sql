-- Initial PostgreSQL schema. Apply once using the migration runner.
BEGIN;
CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE ,
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
CREATE TABLE sessions (
      tokenHash TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expiresAt BIGINT NOT NULL
    );
CREATE INDEX sessions_user ON sessions(userId);
CREATE TABLE recoveryTokens (
      userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt BIGINT NOT NULL
    );
CREATE TABLE honors (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('send', 'growth', 'crew')),
      achievedAt TEXT NOT NULL,
      createdBy TEXT NOT NULL REFERENCES users(id),
      createdAt TEXT NOT NULL
    );
CREATE TABLE auditLog (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actorId TEXT NOT NULL REFERENCES users(id),
      targetId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
CREATE TABLE activityStats (
        userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quarter TEXT NOT NULL,
        metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple')),
        value INTEGER NOT NULL CHECK(value >= 0 AND value <= 1000000),
        PRIMARY KEY(userId,quarter,metric)
      );
CREATE TABLE achievementDefinitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        metric TEXT NOT NULL CHECK(metric IN ('participation','hosted','attended','red','pink','purple')),
        target INTEGER NOT NULL CHECK(target > 0 AND target <= 1000000)
      );
CREATE TABLE featuredAchievements (
        userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        achievementId TEXT NOT NULL REFERENCES achievementDefinitions(id) ON DELETE CASCADE
      );
CREATE TABLE notices (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
          views INTEGER NOT NULL DEFAULT 0 CHECK(views >= 0),
          authorId TEXT NOT NULL REFERENCES users(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
CREATE TABLE marketProducts (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, imageUrl TEXT,
          category TEXT NOT NULL CHECK(category IN ('gear','apparel','voucher','other')),
          points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 1000000),
          stock INTEGER NOT NULL CHECK(stock BETWEEN 0 AND 1000000),
          active INTEGER NOT NULL CHECK(active IN (0,1)), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        , revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0));
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
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id),
          amount INTEGER NOT NULL CHECK(amount!=0), reason TEXT NOT NULL,
          actorId TEXT NOT NULL REFERENCES users(id), orderId TEXT REFERENCES marketOrders(id),
          kind TEXT NOT NULL CHECK(kind IN ('grant','purchase','refund')), createdAt TEXT NOT NULL, requestId TEXT,
          CHECK((kind='grant' AND orderId IS NULL) OR (kind='purchase' AND amount<0 AND orderId IS NOT NULL) OR (kind='refund' AND amount>0 AND orderId IS NOT NULL)),
          UNIQUE(orderId,kind)
        );
CREATE INDEX notices_order ON notices(pinned DESC,createdAt DESC,id DESC);
CREATE INDEX pointLedger_user ON pointLedger(userId,id DESC);
CREATE INDEX marketOrders_user ON marketOrders(userId,createdAt DESC,id DESC);
CREATE INDEX marketOrders_status ON marketOrders(status,createdAt DESC,id DESC);
CREATE UNIQUE INDEX pointLedger_request ON pointLedger(actorId,requestId) WHERE requestId IS NOT NULL;
CREATE UNIQUE INDEX users_username_lower ON users(lower(username));
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('theclimb-red-50','적색경보 해제','[더클라임] 빨강 문제 50개 완등','red',50);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('theclimb-red-100','레드 카펫은 내 길','[더클라임] 빨강 문제 100개 완등','red',100);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('theclimb-pink-50','분홍길만 걷자','[더클라임] 핑크 문제 50개 완등','pink',50);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('theclimb-pink-100','핑크빛 집착','[더클라임] 핑크 문제 100개 완등','pink',100);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('theclimb-purple-50','보라카이 말고 보라','[더클라임] 보라 문제 50개 완등','purple',50);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('theclimb-purple-100','보라색 맛 좀 볼래?','[더클라임] 보라 문제 100개 완등','purple',100);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('krew-hosted-50','천둥번개 주식회사','[크루라이머] 번개 50회 개최','hosted',50);
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES('krew-attended-50','또 오셨네요, 단골님','[크루라이머] 번개 50회 참여','attended',50);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE users FROM anon, authenticated;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sessions FROM anon, authenticated;
ALTER TABLE recoveryTokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE recoveryTokens FROM anon, authenticated;
ALTER TABLE honors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE honors FROM anon, authenticated;
ALTER TABLE auditLog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auditLog FROM anon, authenticated;
ALTER TABLE activityStats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE activityStats FROM anon, authenticated;
ALTER TABLE achievementDefinitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE achievementDefinitions FROM anon, authenticated;
ALTER TABLE featuredAchievements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE featuredAchievements FROM anon, authenticated;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE notices FROM anon, authenticated;
ALTER TABLE marketProducts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketProducts FROM anon, authenticated;
ALTER TABLE marketOrders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketOrders FROM anon, authenticated;
ALTER TABLE pointLedger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pointLedger FROM anon, authenticated;
COMMIT;
