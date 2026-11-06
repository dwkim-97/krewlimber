export type Role = 'member' | 'admin';
export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Grade = '입문' | 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8+';
export type HonorKind = 'send' | 'growth' | 'crew';

export interface Profile {
  instagramUrl: string;
  nickname: string;
  bio: string;
  location: string;
  gym: string;
  grade: Grade;
}

export interface User extends Profile {
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
  titles: TitleBadge[];
  featuredAchievement: FeaturedAchievement | null;
}

export type ActivityMetric = 'participation' | 'hosted' | 'attended' | 'red' | 'pink' | 'purple' | 'gray';
export type ActivityCounts = Record<ActivityMetric, number>;
export type PointMetric = 'pointsEarned' | 'pointsSpent';
export type ProgressMetric = ActivityMetric | PointMetric;
export type Accent = 'lime' | 'yellow' | 'red' | 'pink' | 'purple' | 'gray';

export interface MetricDefinition<T extends ProgressMetric = ProgressMetric> {
  id: T;
  label: string;
  unit: '회' | '개' | 'P';
}
export interface AchievementDefinition {
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
  metrics: MetricDefinition<ActivityMetric>[];
  achievementMetrics: MetricDefinition[];
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
