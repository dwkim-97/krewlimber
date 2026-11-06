BEGIN;

CREATE TABLE IF NOT EXISTS gyms (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
 createdBy TEXT REFERENCES users(id), createdAt TEXT NOT NULL, UNIQUE(name,address)
);
CREATE TABLE IF NOT EXISTS gymGrades (
 id TEXT PRIMARY KEY, gymId TEXT NOT NULL REFERENCES gyms(id), name TEXT NOT NULL, color TEXT NOT NULL,
 createdBy TEXT REFERENCES users(id), createdAt TEXT NOT NULL, UNIQUE(gymId,name)
);
CREATE TABLE IF NOT EXISTS climbingVisits (
 id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 gymId TEXT NOT NULL REFERENCES gyms(id), visitedOn TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 requestId TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(userId,requestId)
);
CREATE TABLE IF NOT EXISTS visitSends (
 visitId TEXT NOT NULL REFERENCES climbingVisits(id) ON DELETE CASCADE,
 gradeId TEXT NOT NULL REFERENCES gymGrades(id), count INTEGER NOT NULL CHECK(count>0 AND count<=999), PRIMARY KEY(visitId,gradeId)
);
CREATE INDEX IF NOT EXISTS climbingVisits_user ON climbingVisits(userId,visitedOn DESC);

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymGrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE climbingVisits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitSends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gyms,gymGrades,climbingVisits,visitSends FROM anon,authenticated;
INSERT INTO gyms(id,name,address,createdAt) VALUES('gym-climbingpark-gangnam','클라이밍파크 강남점','','2026-11-06'),('gym-theclimb-gangnam','더클라임 강남점','','2026-11-06') ON CONFLICT DO NOTHING;
INSERT INTO gymGrades(id,gymId,name,color,createdAt) VALUES('park-gray','gym-climbingpark-gangnam','회색','#888888','2026-11-06'),('climb-purple','gym-theclimb-gangnam','보라','#8654ad','2026-11-06') ON CONFLICT DO NOTHING;
COMMIT;
