BEGIN;
CREATE TABLE achievementConditions (
 achievementId TEXT PRIMARY KEY REFERENCES achievementDefinitions(id) ON DELETE CASCADE,
 gymId TEXT NOT NULL REFERENCES gyms(id),
 gradeId TEXT NOT NULL REFERENCES gymGrades(id),
 operator TEXT NOT NULL CHECK(operator IN ('eq','lte')),
 difficultyRank INTEGER NOT NULL CHECK(difficultyRank>=1 AND difficultyRank<=40)
);
CREATE INDEX achievementConditions_grade ON achievementConditions(gradeId);
ALTER TABLE achievementConditions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE achievementConditions FROM anon,authenticated;
COMMIT;
