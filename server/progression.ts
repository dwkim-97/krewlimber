import type {DatabaseSync} from 'node:sqlite';
import type {
  AchievementCollection,
  AchievementDefinition,
  ActivityCounts,
  ProgressMetric,
  AdminProgression,
  FeaturedAchievement,
  Member,
  MemberProfile,
  TitleBadge,
  TitleBoard,
  TitleStanding,
} from '../src/types';
import {ACTIVITY_METRICS, PROGRESSION_METRICS, EMPTY_COUNTS, TITLE_DEFINITIONS} from '../src/consts/progression';
import {ApiError} from './errors';
import {activityRows} from './climbing-progress';
import {getPointCounts, pointQuarters} from './point-progress';

export function currentQuarter(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')!.value;
  const month = Number(parts.find(part => part.type === 'month')!.value);
  return `${year}-Q${Math.ceil(month / 3)}`;
}

function quarters(db: DatabaseSync, selected: string) {
  const stored = db.prepare('SELECT DISTINCT quarter FROM activityStats').all() as {quarter: string}[];
  return [
    ...new Set([
      selected,
      currentQuarter(new Date()),
      ...stored.map(row => row.quarter),
      ...pointQuarters(db),
      ...activityRows(db, null, null).map(row => row.quarter),
    ]),
  ]
    .sort()
    .reverse();
}

export function getTitleBoard(db: DatabaseSync, quarter: string): TitleBoard {
  const approved = db
    .prepare("SELECT id,nickname FROM users WHERE status='approved' ORDER BY nickname COLLATE NOCASE,id")
    .all() as {id: string; nickname: string}[];
  const names = new Map(approved.map(p => [p.id, p.nickname]));
  const ordering = new Map(approved.map((p, i) => [p.id, i]));
  const records: {userId: string; nickname: string; metric: ProgressMetric; value: number}[] = activityRows(
    db,
    quarter,
    null
  )
    .filter(row => names.has(row.userId) && row.value > 0)
    .map(row => ({...row, nickname: names.get(row.userId)!}));
  const points = getPointCounts(db, quarter, null);
  for (const person of approved) {
    const counts = points.get(person.id);
    if (!counts) continue;
    for (const metric of ['pointsEarned', 'pointsSpent'] as const)
      if (counts[metric] > 0)
        records.push({userId: person.id, nickname: person.nickname, metric, value: counts[metric]});
  }
  return {
    quarter,
    quarters: quarters(db, quarter),
    categories: TITLE_DEFINITIONS.map(definition => {
      const matching = records
        .filter(record => record.metric === definition.metric)
        .sort((a, b) => b.value - a.value || ordering.get(a.userId)! - ordering.get(b.userId)!);
      let rank = 0;
      let previous = -1;
      const standings: TitleStanding[] = matching.map((record, index) => {
        if (record.value !== previous) rank = index + 1;
        previous = record.value;
        return {userId: record.userId, nickname: record.nickname, value: record.value, rank};
      });
      return {...definition, standings};
    }),
  };
}

export function getAchievements(db: DatabaseSync, userId: string): AchievementCollection {
  const definitions = db
    .prepare('SELECT id,name,description,metric,target FROM achievementDefinitions ORDER BY rowid')
    .all() as unknown as AchievementDefinition[];
  const totals = activityRows(db, null, userId);
  const points = getPointCounts(db, null, userId).get(userId);
  const counts = {...EMPTY_COUNTS, pointsEarned: points?.pointsEarned ?? 0, pointsSpent: points?.pointsSpent ?? 0};
  for (const row of totals) counts[row.metric] += row.value;
  const selected = db.prepare('SELECT achievementId FROM featuredAchievements WHERE userId=?').get(userId) as
    {achievementId: string} | undefined;
  const achievements = definitions.map(definition => {
    const progress = counts[definition.metric];
    const earned = progress >= definition.target;
    return {...definition, progress, earned, featured: earned && selected?.achievementId === definition.id};
  });
  return {achievements, featuredAchievementId: achievements.find(achievement => achievement.featured)?.id ?? null};
}

export function setFeaturedAchievement(db: DatabaseSync, userId: string, achievementId: string | null) {
  if (achievementId === null) {
    db.prepare('DELETE FROM featuredAchievements WHERE userId=?').run(userId);
    return;
  }
  const achievement = getAchievements(db, userId).achievements.find(item => item.id === achievementId);
  if (!achievement) throw new ApiError(404, '업적을 찾을 수 없습니다.');
  if (!achievement.earned) throw new ApiError(400, '획득한 업적만 대표로 선택할 수 있습니다.');
  db.prepare(
    `INSERT INTO featuredAchievements(userId,achievementId) VALUES(?,?)
    ON CONFLICT(userId) DO UPDATE SET achievementId=excluded.achievementId`
  ).run(userId, achievementId);
}

export function setActivityCounts(db: DatabaseSync, userId: string, quarter: string, counts: ActivityCounts) {
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(userId)) throw new ApiError(404, '회원을 찾을 수 없습니다.');
  const upsert = db.prepare(`INSERT INTO activityStats(userId,quarter,metric,value) VALUES(?,?,?,?)
    ON CONFLICT(userId,quarter,metric) DO UPDATE SET value=excluded.value`);
  for (const metric of ACTIVITY_METRICS.filter(metric => metric.id === 'hosted' || metric.id === 'attended'))
    upsert.run(userId, quarter, metric.id, counts[metric.id]);
  clearUnearnedFeaturedAchievement(db, userId);
}
export function clearUnearnedFeaturedAchievement(db: DatabaseSync, userId: string) {
  if (!getAchievements(db, userId).featuredAchievementId)
    db.prepare('DELETE FROM featuredAchievements WHERE userId=?').run(userId);
}

export function decorateMembers(db: DatabaseSync, members: MemberProfile[], quarter: string): Member[] {
  const titlesByUser = new Map<string, TitleBadge[]>();
  for (const category of getTitleBoard(db, quarter).categories)
    for (const holder of category.standings.filter(person => person.rank === 1)) {
      const badges = titlesByUser.get(holder.userId) ?? [];
      badges.push({
        id: category.id,
        name: category.name,
        description: category.description,
        quarter,
        accent: category.accent,
      });
      titlesByUser.set(holder.userId, badges);
    }
  const featured = db
    .prepare(
      'SELECT f.userId,d.id,d.name,d.description,d.metric,d.target FROM featuredAchievements f JOIN achievementDefinitions d ON d.id=f.achievementId'
    )
    .all() as unknown as (FeaturedAchievement & {userId: string; metric: ProgressMetric; target: number})[];
  const points = getPointCounts(db, null, null);
  const counts = new Map<string, ActivityCounts>();
  for (const row of activityRows(db, null, null)) {
    const value = counts.get(row.userId) ?? {...EMPTY_COUNTS};
    value[row.metric] += row.value;
    counts.set(row.userId, value);
  }
  const featuredByUser = new Map<string, FeaturedAchievement>();
  for (const row of featured) {
    const progress =
      row.metric === 'pointsEarned' || row.metric === 'pointsSpent'
        ? (points.get(row.userId)?.[row.metric] ?? 0)
        : (counts.get(row.userId)?.[row.metric] ?? 0);
    if (progress >= row.target)
      featuredByUser.set(row.userId, {id: row.id, name: row.name, description: row.description});
  }
  return members.map(member => ({
    ...member,
    titles: titlesByUser.get(member.id) ?? [],
    featuredAchievement: featuredByUser.get(member.id) ?? null,
  }));
}

export function getAdminProgression(db: DatabaseSync, quarter: string): AdminProgression {
  const users = db
    .prepare('SELECT id,username,nickname,status FROM users ORDER BY nickname COLLATE NOCASE')
    .all() as unknown as Omit<AdminProgression['users'][number], 'counts'>[];
  const stats = activityRows(db, quarter, null);
  const byUser = new Map<string, ActivityCounts>();
  for (const row of stats) {
    const counts = byUser.get(row.userId) ?? {...EMPTY_COUNTS};
    counts[row.metric] = row.value;
    byUser.set(row.userId, counts);
  }
  return {
    quarter,
    quarters: quarters(db, quarter),
    metrics: ACTIVITY_METRICS,
    achievementMetrics: PROGRESSION_METRICS,
    users: users.map(user => ({...user, counts: byUser.get(user.id) ?? {...EMPTY_COUNTS}})),
    achievements: db
      .prepare('SELECT id,name,description,metric,target FROM achievementDefinitions ORDER BY rowid')
      .all() as unknown as AchievementDefinition[],
  };
}
