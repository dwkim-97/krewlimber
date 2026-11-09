export const climbingSchema = `
CREATE TABLE IF NOT EXISTS gyms (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', latitude REAL, longitude REAL,
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
`;
