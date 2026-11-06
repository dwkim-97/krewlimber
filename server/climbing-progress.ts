import type {DatabaseSync, SQLInputValue} from 'node:sqlite';
import type {ActivityMetric} from '../src/types';

export interface ActivityRow {
  userId: string;
  quarter: string;
  metric: ActivityMetric;
  value: number;
}
export function activityRows(db: DatabaseSync, quarter: string | null, userId: string | null): ActivityRow[] {
  const filters: string[] = [];
  const params: SQLInputValue[] = [];
  if (quarter) {
    filters.push('quarter=?');
    params.push(quarter);
  }
  if (userId) {
    filters.push('userId=?');
    params.push(userId);
  }
  const dateQuarter = "substr(v.date,1,4) || '-Q' || ((CAST(substr(v.date,6,2) AS INTEGER)+2)/3)";
  return db
    .prepare(
      `SELECT userId,quarter,metric,SUM(value) AS value FROM (
    SELECT userId,quarter,metric,value FROM activityStats WHERE metric IN ('hosted','attended')
    UNION ALL SELECT v.userId,${dateQuarter} AS quarter,'participation' AS metric,COUNT(*) AS value FROM climbingVisits v GROUP BY v.userId,quarter
    UNION ALL SELECT v.userId,${dateQuarter} AS quarter,c.colorKey AS metric,SUM(c.count) AS value FROM climbingVisits v
      JOIN climbingGyms g ON g.id=v.gymId JOIN climbingColors c ON c.visitId=v.id
      WHERE g.franchiseId='theclimb' AND c.colorKey IN ('red','pink','purple','gray') GROUP BY v.userId,quarter,c.colorKey
  ) ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''} GROUP BY userId,quarter,metric`
    )
    .all(...params) as unknown as ActivityRow[];
}
