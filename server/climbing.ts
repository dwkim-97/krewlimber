import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {
  BranchSummary,
  ClimbInput,
  ClimbRecord,
  ClimbingSummary,
  ColorCount,
  FranchiseSummary,
  Gym,
} from '../src/types/climbing';
import {gymColors} from '../src/consts/climbing';
import {ApiError} from './errors';
import {canonicalGymId, sameGymIds, gymAliases} from './gym-catalog';

export function findGym(db: DatabaseSync, id: string): Gym | null {
  const gym = db.prepare('SELECT * FROM climbingGyms WHERE id=?').get(canonicalGymId(id)) as unknown as
    Omit<Gym, 'aliases'> | undefined;
  return gym ? {...gym, aliases: gymAliases(gym.id)} : null;
}
export function climbRecords(db: DatabaseSync, userId: string): ClimbRecord[] {
  const visits = db
    .prepare('SELECT * FROM climbingVisits WHERE userId=? ORDER BY date DESC,createdAt DESC,id')
    .all(userId) as unknown as Omit<ClimbRecord, 'colors' | 'gym'>[];
  const colors = db
    .prepare(
      'SELECT c.visitId,c.colorKey AS key,c.name,c.hex,c.count FROM climbingColors c JOIN climbingVisits v ON v.id=c.visitId WHERE v.userId=? ORDER BY c.rowid'
    )
    .all(userId) as unknown as (ColorCount & {visitId: string})[];
  const gyms = db.prepare('SELECT * FROM climbingGyms').all() as unknown as Gym[];
  const byGym = new Map(gyms.map(g => [g.id, {...g, aliases: gymAliases(g.id)}]));
  const byVisit = new Map<string, ColorCount[]>();
  for (const c of colors) {
    const list = byVisit.get(c.visitId) ?? [];
    list.push({key: c.key, name: c.name, hex: c.hex, count: c.count});
    byVisit.set(c.visitId, list);
  }
  return visits.map(v => ({
    ...v,
    gymId: canonicalGymId(v.gymId),
    gym: byGym.get(canonicalGymId(v.gymId))!,
    colors: byVisit.get(v.id) ?? [],
  }));
}
export function saveClimb(db: DatabaseSync, userId: string, id: string | null, input: ClimbInput): string {
  if (id && !db.prepare('SELECT id FROM climbingVisits WHERE id=? AND userId=?').get(id, userId))
    throw new ApiError(404, '기록을 찾을 수 없습니다.');
  input = {...input, gymId: canonicalGymId(input.gymId)};
  const equivalentIds = sameGymIds(input.gymId);
  const duplicate = db
    .prepare(
      `SELECT id FROM climbingVisits WHERE userId=? AND date=? AND gymId IN (${equivalentIds.map(() => '?').join(',')})`
    )
    .get(userId, input.date, ...equivalentIds) as {id: string} | undefined;
  if (duplicate && duplicate.id !== id)
    throw new ApiError(409, '같은 날짜의 암장 기록이 있어요. 기존 기록을 수정해주세요.');
  const recordId = id ?? randomUUID();
  const now = new Date().toISOString();
  if (id) {
    db.prepare('UPDATE climbingVisits SET gymId=?,date=?,updatedAt=? WHERE id=? AND userId=?').run(
      input.gymId,
      input.date,
      now,
      id,
      userId
    );
    db.prepare('DELETE FROM climbingColors WHERE visitId=?').run(id);
  } else
    db.prepare('INSERT INTO climbingVisits VALUES(?,?,?,?,?,?)').run(
      recordId,
      userId,
      input.gymId,
      input.date,
      now,
      now
    );
  const insert = db.prepare('INSERT INTO climbingColors(visitId,colorKey,name,hex,count) VALUES(?,?,?,?,?)');
  for (const c of input.colors) insert.run(recordId, c.key, c.name, c.hex, c.count);
  return recordId;
}
function mergeColors(target: ColorCount[], source: ColorCount[]) {
  for (const color of source) {
    const existing = target.find(c => c.key === color.key && c.name === color.name && c.hex === color.hex);
    if (existing) existing.count += color.count;
    else target.push({...color});
  }
}
export function climbingSummary(db: DatabaseSync, userId: string): ClimbingSummary {
  const records = climbRecords(db, userId);
  const byGroup = new Map<string, FranchiseSummary>();
  for (const record of records) {
    const group = byGroup.get(record.gym.franchiseId) ?? {
      franchiseId: record.gym.franchiseId,
      franchiseName: record.gym.franchiseName,
      visits: 0,
      totalSends: 0,
      colors: [],
      branches: [],
    };
    let branch = group.branches.find(b => b.gym.id === record.gymId);
    if (!branch) {
      branch = {gym: record.gym, visits: 0, totalSends: 0, colors: []} satisfies BranchSummary;
      group.branches.push(branch);
    }
    const count = record.colors.reduce((n, c) => n + c.count, 0);
    group.visits++;
    group.totalSends += count;
    branch.visits++;
    branch.totalSends += count;
    mergeColors(group.colors, record.colors);
    mergeColors(branch.colors, record.colors);
    byGroup.set(group.franchiseId, group);
  }
  for (const group of byGroup.values()) {
    const order = new Map(gymColors(group.franchiseId).map((color, index) => [color.key, index]));
    const sort = (colors: ColorCount[]) =>
      colors.sort(
        (a, b) => (order.get(a.key) ?? 100) - (order.get(b.key) ?? 100) || a.name.localeCompare(b.name, 'ko')
      );
    sort(group.colors);
    for (const branch of group.branches) sort(branch.colors);
  }
  const groups = [...byGroup.values()].sort(
    (a, b) => b.visits - a.visits || a.franchiseName.localeCompare(b.franchiseName, 'ko')
  );
  return {visits: records.length, totalSends: groups.reduce((n, g) => n + g.totalSends, 0), groups};
}
