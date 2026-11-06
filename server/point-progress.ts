import type {DatabaseSync, SQLInputValue} from 'node:sqlite';
import type {PointMetric} from '../src/types';

type PointCounts = Record<PointMetric, number>;
function quarterRange(quarter: string) {
  const [year, part] = quarter.split('-Q');
  function boundary(month: number) {
    const date = new Date(0);
    date.setUTCFullYear(Number(year), month, 1);
    date.setUTCHours(-9, 0, 0, 0);
    return date.toISOString();
  }
  return [boundary((Number(part) - 1) * 3), boundary(Number(part) * 3)];
}
export function getPointCounts(db: DatabaseSync, quarter: string | null, userId: string | null) {
  const conditions: string[] = [];
  const values: SQLInputValue[] = [];
  if (quarter) {
    conditions.push('createdAt>=? AND createdAt<?');
    values.push(...quarterRange(quarter));
  }
  if (userId) {
    conditions.push('userId=?');
    values.push(userId);
  }
  const filter = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
  const counts = new Map<string, PointCounts>();
  const grants = db
    .prepare(`SELECT userId,SUM(amount) AS value FROM pointLedger WHERE kind='grant'${filter} GROUP BY userId`)
    .all(...values) as unknown as {userId: string; value: number}[];
  for (const row of grants) counts.set(row.userId, {pointsEarned: Math.max(0, row.value), pointsSpent: 0});
  const orders = db
    .prepare(`SELECT userId,SUM(total) AS value FROM marketOrders WHERE status!='cancelled'${filter} GROUP BY userId`)
    .all(...values) as unknown as {userId: string; value: number}[];
  for (const row of orders)
    counts.set(row.userId, {pointsEarned: counts.get(row.userId)?.pointsEarned ?? 0, pointsSpent: row.value});
  return counts;
}
export function pointQuarters(db: DatabaseSync): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT strftime('%Y',createdAt,'+9 hours') || '-Q' || ((CAST(strftime('%m',createdAt,'+9 hours') AS INTEGER)+2)/3) AS quarter
    FROM (SELECT createdAt FROM pointLedger WHERE kind='grant' UNION ALL SELECT createdAt FROM marketOrders)`
    )
    .all() as {quarter: string | null}[];
  return rows.map(row => row.quarter).filter((quarter): quarter is string => quarter !== null);
}
