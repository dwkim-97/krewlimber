export const bingoSchema = `
CREATE TABLE IF NOT EXISTS bingoEvents (
 ordinal INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
 maxValue INTEGER NOT NULL CHECK(maxValue BETWEEN 25 AND 1000),
 phase TEXT NOT NULL CHECK(phase IN ('collecting','playing','finished')),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bingoTeams (
 id TEXT PRIMARY KEY, eventId TEXT NOT NULL REFERENCES bingoEvents(id),
 name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, acquired TEXT NOT NULL DEFAULT '[]',
 board TEXT NOT NULL, marked TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 UNIQUE(eventId,name)
);
CREATE INDEX IF NOT EXISTS bingoTeams_event ON bingoTeams(eventId);
CREATE TABLE IF NOT EXISTS bingoSessions (
 tokenHash TEXT PRIMARY KEY, teamId TEXT NOT NULL REFERENCES bingoTeams(id) ON DELETE CASCADE,
 expiresAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bingoSessions_expiry ON bingoSessions(expiresAt);
`;
