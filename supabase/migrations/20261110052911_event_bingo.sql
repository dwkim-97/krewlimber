BEGIN;

CREATE TABLE bingoEvents (
 ordinal BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id TEXT NOT NULL UNIQUE,
 maxValue INTEGER NOT NULL CHECK(maxValue BETWEEN 25 AND 1000),
 phase TEXT NOT NULL CHECK(phase IN ('collecting','playing','finished')),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), createdAt TEXT NOT NULL
);
CREATE TABLE bingoTeams (
 id TEXT PRIMARY KEY, eventId TEXT NOT NULL REFERENCES bingoEvents(id),
 name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, acquired TEXT NOT NULL DEFAULT '[]',
 board TEXT NOT NULL, marked TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 UNIQUE(eventId,name)
);
CREATE INDEX bingoTeams_event ON bingoTeams(eventId);
CREATE TABLE bingoSessions (
 tokenHash TEXT PRIMARY KEY, teamId TEXT NOT NULL REFERENCES bingoTeams(id) ON DELETE CASCADE,
 expiresAt BIGINT NOT NULL
);
CREATE INDEX bingoSessions_expiry ON bingoSessions(expiresAt);

ALTER TABLE bingoEvents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bingoEvents FROM anon,authenticated;
ALTER TABLE bingoTeams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bingoTeams FROM anon,authenticated;
ALTER TABLE bingoSessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bingoSessions FROM anon,authenticated;
COMMIT;
