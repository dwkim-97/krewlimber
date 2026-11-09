import type {SQLInputValue} from 'node:sqlite';
import type {Database} from './database';
import type {ProgressCounts, ActivityMetric} from '../src/types';
import {EMPTY_COUNTS} from '../src/consts/progression';
import {gymBrand} from '../src/consts/gym-brands';

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

export async function progressionCounts(db: Database, quarter: string | null, userId: string | null) {
  const counts = new Map<string, ProgressCounts>();
  function own(id: string) {
    let found = counts.get(id);
    if (!found) {
      found = {...EMPTY_COUNTS, gray: 0, pointsEarned: 0, pointsSpent: 0};
      counts.set(id, found);
    }
    return found;
  }
  const filters: string[] = [];
  const values: SQLInputValue[] = [];
  if (quarter) {
    filters.push('quarter=?');
    values.push(quarter);
  }
  if (userId) {
    filters.push('userId=?');
    values.push(userId);
  }
  const manual = await db
    .prepare(
      `SELECT userId,metric,SUM(value) AS value FROM activityStats ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''} GROUP BY userId,metric`
    )
    .all(...values);
  for (const row of manual) own(String(row.userId))[row.metric as ActivityMetric] = Number(row.value);

  const dated: string[] = [];
  const datedValues: SQLInputValue[] = [];
  if (quarter) {
    dated.push('createdAt>=? AND createdAt<?');
    datedValues.push(...quarterRange(quarter));
  }
  if (userId) {
    dated.push('userId=?');
    datedValues.push(userId);
  }
  const filter = dated.length ? ' AND ' + dated.join(' AND ') : '';
  const grants = await db
    .prepare(`SELECT userId,SUM(amount) AS value FROM pointLedger WHERE kind='grant'${filter} GROUP BY userId`)
    .all(...datedValues);
  for (const row of grants) own(String(row.userId)).pointsEarned = Math.max(0, Number(row.value));
  const orders = await db
    .prepare(`SELECT userId,SUM(total) AS value FROM marketOrders WHERE status!='cancelled'${filter} GROUP BY userId`)
    .all(...datedValues);
  for (const row of orders) own(String(row.userId)).pointsSpent = Number(row.value);

  const visits: string[] = ["lower(d.name) IN ('회색','gray','grey')"];
  const visitValues: SQLInputValue[] = [];
  if (quarter) {
    visits.push('substr(v.visitedOn,1,4)=? AND substr(v.visitedOn,6,2) BETWEEN ? AND ?');
    const [year, part] = quarter.split('-Q');
    visitValues.push(
      year,
      String((Number(part) - 1) * 3 + 1).padStart(2, '0'),
      String(Number(part) * 3).padStart(2, '0')
    );
  }
  if (userId) {
    visits.push('v.userId=?');
    visitValues.push(userId);
  }
  const gray = await db
    .prepare(
      `SELECT v.userId,g.name,g.brandName,SUM(s.count) AS value FROM climbingVisits v JOIN gyms g ON g.id=v.gymId JOIN visitSends s ON s.visitId=v.id JOIN gymGrades d ON d.id=s.gradeId WHERE ${visits.join(' AND ')} GROUP BY v.userId,g.name,g.brandName`
    )
    .all(...visitValues);
  for (const row of gray)
    if (gymBrand(String(row.brandName || row.name))?.id === 'theclimb')
      own(String(row.userId)).gray += Number(row.value);
  return counts;
}
