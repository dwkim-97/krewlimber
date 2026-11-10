import type {Database} from './database';
import {PostgresDatabase} from './database';
import type {
  AchievementCollection,
  ActivityCounts,
  ActivityMetric,
  ProgressMetric,
  AdminProgression,
  Member,
  MemberProfile,
  Role,
  TitleBadge,
  TitleBoard,
  TitleCategory,
  TitleStanding,
} from '../src/types';
import {ACTIVITY_METRICS, EMPTY_COUNTS, TITLE_DEFINITIONS} from '../src/consts/progression';
import {achievementDefinitions, conditionProgress} from './achievement-conditions';
import {ApiError} from './errors';
import {progressionCounts} from './progression-counts';

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

async function quarters(db: Database, selected: string) {
  const pointQuarter =
    db instanceof PostgresDatabase
      ? `to_char(createdAt::timestamptz AT TIME ZONE 'Asia/Seoul', 'YYYY-"Q"Q')`
      : "strftime('%Y',createdAt,'+9 hours') || '-Q' || ((CAST(strftime('%m',createdAt,'+9 hours') AS INTEGER)+2)/3)";
  const stored = await db
    .prepare(
      `SELECT quarter FROM activityStats
    UNION SELECT ${pointQuarter} AS quarter FROM (SELECT createdAt FROM pointLedger WHERE kind='grant' UNION ALL SELECT createdAt FROM marketOrders) events
    UNION SELECT substr(visitedOn,1,4) || '-Q' || ((CAST(substr(visitedOn,6,2) AS INTEGER)+2)/3) AS quarter FROM climbingVisits`
    )
    .all();
  return [...new Set([selected, currentQuarter(new Date()), ...stored.map(row => String(row.quarter))])]
    .sort()
    .reverse();
}

async function titleCategories(db: Database, quarter: string): Promise<TitleCategory[]> {
  const counts = await progressionCounts(db, quarter, null);
  const members = await db
    .prepare("SELECT id,nickname FROM users WHERE status='approved' ORDER BY nickname COLLATE NOCASE,id")
    .all();
  return TITLE_DEFINITIONS.map(definition => {
    const matching = members
      .map(member => ({
        userId: String(member.id),
        nickname: String(member.nickname),
        value: counts.get(String(member.id))?.[definition.metric] ?? 0,
      }))
      .filter(record => record.value > 0)
      .sort((a, b) => b.value - a.value);
    let rank = 0;
    let previous = -1;
    const standings: TitleStanding[] = matching.map((record, index) => {
      if (record.value !== previous) rank = index + 1;
      previous = record.value;
      return {userId: record.userId, nickname: record.nickname, value: record.value, rank};
    });
    return {...definition, standings};
  });
}

export async function getTitleBoard(db: Database, quarter: string): Promise<TitleBoard> {
  return {quarter, quarters: await quarters(db, quarter), categories: await titleCategories(db, quarter)};
}

export async function getAchievements(db: Database, userId: string): Promise<AchievementCollection> {
  const definitions = await achievementDefinitions(db);
  const recorded = new Map((await conditionProgress(db, userId)).map(r => [r.achievementId, Number(r.value)]));
  const counts = (await progressionCounts(db, null, userId)).get(userId);
  const selected = (await db.prepare('SELECT achievementId FROM featuredAchievements WHERE userId=?').get(userId)) as
    {achievementId: string} | undefined;
  const achievements = definitions.map(definition => {
    const progress = definition.condition ? (recorded.get(definition.id) ?? 0) : (counts?.[definition.metric] ?? 0);
    const earned = progress >= definition.target;
    return {...definition, progress, earned, featured: earned && selected?.achievementId === definition.id};
  });
  return {achievements, featuredAchievementId: achievements.find(achievement => achievement.featured)?.id ?? null};
}

export async function setFeaturedAchievement(db: Database, userId: string, achievementId: string | null) {
  if (achievementId === null) {
    await db.prepare('DELETE FROM featuredAchievements WHERE userId=?').run(userId);
    return;
  }
  const achievement = (await getAchievements(db, userId)).achievements.find(item => item.id === achievementId);
  if (!achievement) throw new ApiError(404, '업적을 찾을 수 없습니다.');
  if (!achievement.earned) throw new ApiError(400, '획득한 업적만 대표로 선택할 수 있습니다.');
  await db
    .prepare(
      `INSERT INTO featuredAchievements(userId,achievementId) VALUES(?,?)
    ON CONFLICT(userId) DO UPDATE SET achievementId=excluded.achievementId`
    )
    .run(userId, achievementId);
}

export async function setActivityCounts(db: Database, userId: string, quarter: string, counts: ActivityCounts) {
  if (!(await db.prepare('SELECT id FROM users WHERE id=?').get(userId)))
    throw new ApiError(404, '회원을 찾을 수 없습니다.');
  const upsert = db.prepare(`INSERT INTO activityStats(userId,quarter,metric,value) VALUES(?,?,?,?)
    ON CONFLICT(userId,quarter,metric) DO UPDATE SET value=excluded.value`);
  for (const metric of ACTIVITY_METRICS) await upsert.run(userId, quarter, metric.id, counts[metric.id]);
  await clearUnearnedFeaturedAchievement(db, userId);
}

export async function clearUnearnedFeaturedAchievement(db: Database, userId: string) {
  if (!(await getAchievements(db, userId)).featuredAchievementId)
    await db.prepare('DELETE FROM featuredAchievements WHERE userId=?').run(userId);
}

export async function decorateMembers(
  db: Database,
  members: (MemberProfile & {role?: Role; points?: number; level?: number})[],
  quarter: string
): Promise<Member[]> {
  const titlesByUser = new Map<string, TitleBadge[]>();
  for (const category of await titleCategories(db, quarter))
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
  const featured = await db
    .prepare(
      'SELECT f.userId,d.id,d.name,d.description,d.metric,d.target,c.achievementId AS conditionId FROM featuredAchievements f JOIN achievementDefinitions d ON d.id=f.achievementId LEFT JOIN achievementConditions c ON c.achievementId=d.id'
    )
    .all();
  const totals = await progressionCounts(db, null, null);
  const recorded = await conditionProgress(db);
  const featuredByUser = new Map(
    featured
      .filter(
        f =>
          Number(
            f.conditionId
              ? (recorded.find(r => r.userId === f.userId && r.achievementId === f.id)?.value ?? 0)
              : (totals.get(String(f.userId))?.[f.metric as ProgressMetric] ?? 0)
          ) >= Number(f.target)
      )
      .map(f => [String(f.userId), {id: String(f.id), name: String(f.name), description: String(f.description)}])
  );
  return members.map(member => ({
    ...member,
    role: member.role ?? 'member',
    points: Number(member.points ?? 0),
    level: member.level ?? 0,
    titles: titlesByUser.get(member.id) ?? [],
    featuredAchievement: featuredByUser.get(member.id) ?? null,
  }));
}

export async function getAdminProgression(db: Database, quarter: string): Promise<AdminProgression> {
  const users = (await db
    .prepare('SELECT id,username,nickname,status FROM users ORDER BY nickname COLLATE NOCASE')
    .all()) as unknown as Omit<AdminProgression['users'][number], 'counts'>[];
  const stats = (await db
    .prepare('SELECT userId,metric,value FROM activityStats WHERE quarter=?')
    .all(quarter)) as unknown as {
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
    quarters: await quarters(db, quarter),
    metrics: ACTIVITY_METRICS,
    users: users.map(user => ({...user, counts: byUser.get(user.id) ?? {...EMPTY_COUNTS}})),
    achievements: await achievementDefinitions(db),
  };
}
