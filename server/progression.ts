import type {DatabaseSync} from 'node:sqlite';
import type {
  AchievementCollection,
  AchievementDefinition,
  ActivityCounts,
  ActivityMetric,
  AdminProgression,
  FeaturedAchievement,
  Member,
  MemberProfile,
  TitleBadge,
  TitleBoard,
  TitleStanding,
} from '../src/types';
import {ACTIVITY_METRICS, EMPTY_COUNTS, TITLE_DEFINITIONS} from '../src/consts/progression';
import {ApiError} from './errors';

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
  return [...new Set([selected, currentQuarter(new Date()), ...stored.map(row => row.quarter)])].sort().reverse();
}

export function getTitleBoard(db: DatabaseSync, quarter: string): TitleBoard {
  const records = db
    .prepare(
      `SELECT a.userId,u.nickname,a.metric,a.value FROM activityStats a
    JOIN users u ON u.id=a.userId WHERE a.quarter=? AND u.status='approved' AND a.value>0
    ORDER BY a.value DESC,u.nickname COLLATE NOCASE ASC,u.id ASC`
    )
    .all(quarter) as unknown as {userId: string; nickname: string; metric: ActivityMetric; value: number}[];
  return {
    quarter,
    quarters: quarters(db, quarter),
    categories: TITLE_DEFINITIONS.map(definition => {
      const matching = records.filter(record => record.metric === definition.metric);
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
  const totals = db
    .prepare('SELECT metric,SUM(value) AS value FROM activityStats WHERE userId=? GROUP BY metric')
    .all(userId) as unknown as {metric: ActivityMetric; value: number}[];
  const counts = {...EMPTY_COUNTS};
  for (const row of totals) counts[row.metric] = row.value;
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
  for (const metric of ACTIVITY_METRICS) upsert.run(userId, quarter, metric.id, counts[metric.id]);
  const collection = getAchievements(db, userId);
  if (!collection.featuredAchievementId) db.prepare('DELETE FROM featuredAchievements WHERE userId=?').run(userId);
}

export function decorateMembers(db: DatabaseSync, members: MemberProfile[], quarter: string): Member[] {
  const titlesByUser = new Map<string, TitleBadge[]>();
  for (const category of getTitleBoard(db, quarter).categories)
    for (const holder of category.standings.filter(person => person.rank === 1)) {
      const badges = titlesByUser.get(holder.userId) ?? [];
      badges.push({id: category.id, name: category.name, quarter, accent: category.accent});
      titlesByUser.set(holder.userId, badges);
    }
  const featured = db
    .prepare(
      `SELECT f.userId,d.id,d.name,d.description FROM featuredAchievements f
    JOIN achievementDefinitions d ON d.id=f.achievementId
    LEFT JOIN activityStats a ON a.userId=f.userId AND a.metric=d.metric
    GROUP BY f.userId,d.id HAVING COALESCE(SUM(a.value),0)>=d.target`
    )
    .all() as unknown as (FeaturedAchievement & {userId: string})[];
  const featuredByUser = new Map(
    featured.map(row => [row.userId, {id: row.id, name: row.name, description: row.description}])
  );
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
  const stats = db.prepare('SELECT userId,metric,value FROM activityStats WHERE quarter=?').all(quarter) as unknown as {
    userId: string;
    metric: ActivityMetric;
    value: number;
  }[];
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
    users: users.map(user => ({...user, counts: byUser.get(user.id) ?? {...EMPTY_COUNTS}})),
    achievements: db
      .prepare('SELECT id,name,description,metric,target FROM achievementDefinitions ORDER BY rowid')
      .all() as unknown as AchievementDefinition[],
  };
}
