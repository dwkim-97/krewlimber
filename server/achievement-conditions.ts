import type {Database} from './database';
import type {AchievementDefinition} from '../src/types';
export const achievementConditionsSchema = `CREATE TABLE IF NOT EXISTS achievementConditions (
 achievementId TEXT PRIMARY KEY REFERENCES achievementDefinitions(id) ON DELETE CASCADE,
 gymId TEXT NOT NULL REFERENCES gyms(id),gradeId TEXT NOT NULL REFERENCES gymGrades(id),
 operator TEXT NOT NULL CHECK(operator IN ('eq','gte')),difficultyRank INTEGER NOT NULL CHECK(difficultyRank>=1 AND difficultyRank<=40)
); CREATE INDEX IF NOT EXISTS achievementConditions_grade ON achievementConditions(gradeId);`;
export async function achievementDefinitions(db: Database): Promise<AchievementDefinition[]> {
  const definitions = await db
    .prepare('SELECT id,name,description,metric,target FROM achievementDefinitions ORDER BY rowid')
    .all();
  const conditions = await db
    .prepare(
      'SELECT c.achievementId,c.gymId,c.gradeId,c.operator,c.difficultyRank,g.name AS gymName,d.name AS gradeName FROM achievementConditions c JOIN gyms g ON g.id=c.gymId JOIN gymGrades d ON d.id=c.gradeId'
    )
    .all();
  return definitions.map(d => {
    const found = conditions.find(c => c.achievementId === d.id);
    if (!found) return d as unknown as AchievementDefinition;
    const condition = Object.fromEntries(Object.entries(found).filter(([key]) => key !== 'achievementId'));
    return {...d, condition} as unknown as AchievementDefinition;
  });
}
export async function conditionProgress(db: Database, userId?: string) {
  return (await db
    .prepare(
      `SELECT v.userId,c.achievementId,SUM(s.count) AS value FROM achievementConditions c
 JOIN climbingVisits v ON v.gymId=c.gymId JOIN visitSends s ON s.visitId=v.id
 JOIN gymGrades g ON g.id=s.gradeId AND g.gymId=c.gymId
 WHERE ((c.operator='eq' AND s.gradeId=c.gradeId) OR (c.operator='gte' AND g.sortOrder+1>=c.difficultyRank)) ${userId ? 'AND v.userId=?' : ''}
 GROUP BY v.userId,c.achievementId`
    )
    .all(...(userId ? [userId] : []))) as unknown as {userId: string; achievementId: string; value: number}[];
}
