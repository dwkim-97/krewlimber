BEGIN;
WITH bounds AS (SELECT gymId,MAX(sortOrder) AS highest FROM gymGrades GROUP BY gymId)
UPDATE gymGrades SET sortOrder=bounds.highest-gymGrades.sortOrder FROM bounds WHERE gymGrades.gymId=bounds.gymId;
ALTER TABLE achievementConditions DROP CONSTRAINT achievementconditions_operator_check;
UPDATE achievementConditions SET operator='gte' WHERE operator='lte';
UPDATE achievementConditions SET difficultyRank=gymGrades.sortOrder+1 FROM gymGrades WHERE gymGrades.id=achievementConditions.gradeId;
ALTER TABLE achievementConditions ADD CONSTRAINT achievementconditions_operator_check CHECK(operator IN ('eq','gte'));
COMMIT;
