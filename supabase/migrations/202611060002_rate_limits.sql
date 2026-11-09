BEGIN;
ALTER TABLE achievementDefinitions ADD COLUMN sortOrder BIGINT GENERATED ALWAYS AS IDENTITY;
CREATE TABLE rateLimits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK(hits >= 0),
  resetAt BIGINT NOT NULL
);
CREATE INDEX rateLimits_expiry ON rateLimits(resetAt);
ALTER TABLE rateLimits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE rateLimits FROM anon, authenticated;
COMMIT;
