export type Role = 'member' | 'staff' | 'admin';
export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Grade = '입문' | 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8+';
export type HonorKind = 'send' | 'growth' | 'crew';

export interface Profile {
  instagramUrl: string;
  fullName: string;
  nickname: string;
  bio: string;
  location: string;
  gym: string;
  grade: Grade;
}

export interface User extends Profile {
  level: number;
  id: string;
  username: string;
  role: Role;
  status: MemberStatus;
  createdAt: string;
}

export interface MemberProfile extends Profile {
  id: string;
  createdAt: string;
}

export interface Member extends MemberProfile {
  role: Role;
  points: number;
  level: number;
  titles: TitleBadge[];
  featuredAchievement: FeaturedAchievement | null;
}

export type ActivityMetric = 'participation' | 'hosted' | 'attended' | 'red' | 'pink' | 'purple';
export type ActivityCounts = Record<ActivityMetric, number>;
export type ProgressMetric = ActivityMetric | 'gray' | 'pointsEarned' | 'pointsSpent';
export type ProgressCounts = Record<ProgressMetric, number>;
export type Accent = 'lime' | 'yellow' | 'red' | 'pink' | 'purple' | 'gray';

export interface MetricDefinition {
  id: ActivityMetric;
  label: string;
  unit: '회' | '개';
}
export interface AchievementCondition {
  gymId: string;
  gradeId: string;
  gymName: string;
  gradeName: string;
  operator: 'eq' | 'gte';
  difficultyRank: number;
}
export interface AchievementDefinition {
  condition?: AchievementCondition;
  id: string;
  name: string;
  description: string;
  metric: ProgressMetric;
  target: number;
}
export interface AchievementProgress extends AchievementDefinition {
  progress: number;
  earned: boolean;
  featured: boolean;
}
export interface AchievementCollection {
  achievements: AchievementProgress[];
  featuredAchievementId: string | null;
}
export interface FeaturedAchievement {
  id: string;
  name: string;
  description: string;
}
export interface TitleBadge {
  id: string;
  name: string;
  description: string;
  quarter: string;
  accent: Accent;
}
export interface TitleStanding {
  userId: string;
  nickname: string;
  value: number;
  rank: number;
}
export interface TitleCategory {
  id: string;
  name: string;
  description: string;
  metric: ProgressMetric;
  unit: '회' | '개' | 'P';
  accent: Accent;
  standings: TitleStanding[];
}
export interface TitleBoard {
  quarter: string;
  quarters: string[];
  categories: TitleCategory[];
}
export interface ActivityMember {
  id: string;
  username: string;
  nickname: string;
  status: MemberStatus;
  counts: ActivityCounts;
}
export interface AdminProgression {
  quarter: string;
  quarters: string[];
  metrics: MetricDefinition[];
  users: ActivityMember[];
  achievements: AchievementDefinition[];
}

export interface Honor {
  id: string;
  userId: string;
  nickname: string;
  grade: Grade;
  title: string;
  description: string;
  kind: HonorKind;
  achievedAt: string;
  createdAt: string;
}
