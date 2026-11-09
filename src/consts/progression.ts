import type {AchievementDefinition, ActivityCounts, MetricDefinition, TitleCategory} from '../types';

export const ACTIVITY_METRICS: MetricDefinition[] = [
  {id: 'participation', label: '클라이밍 참여', unit: '회'},
  {id: 'hosted', label: '번개 개최', unit: '회'},
  {id: 'attended', label: '번개 참여', unit: '회'},
  {id: 'red', label: '[더클라임] 빨강 완등', unit: '개'},
  {id: 'pink', label: '[더클라임] 핑크 완등', unit: '개'},
  {id: 'purple', label: '[더클라임] 보라 완등', unit: '개'},
];
export const EMPTY_COUNTS: ActivityCounts = {participation: 0, hosted: 0, attended: 0, red: 0, pink: 0, purple: 0};
export const TITLE_DEFINITIONS: Omit<TitleCategory, 'standings'>[] = [
  {
    id: 'participation',
    name: '암장 지박령',
    description: '클라이밍 참여 횟수 1위',
    metric: 'participation',
    unit: '회',
    accent: 'lime',
  },
  {
    id: 'hosted',
    name: '번개 공장장',
    description: '번개 개최 횟수 1위',
    metric: 'hosted',
    unit: '회',
    accent: 'yellow',
  },
  {id: 'red', name: '빨강불도 직진', description: '[더클라임] 빨강 완등 1위', metric: 'red', unit: '개', accent: 'red'},
  {
    id: 'pink',
    name: '핑크빛 광기',
    description: '[더클라임] 핑크 완등 1위',
    metric: 'pink',
    unit: '개',
    accent: 'pink',
  },
  {
    id: 'purple',
    name: '보라클레스',
    description: '[더클라임] 보라 완등 1위',
    metric: 'purple',
    unit: '개',
    accent: 'purple',
  },
];
export const DEFAULT_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'theclimb-red-50',
    name: '적색경보 해제',
    description: '[더클라임] 빨강 문제 50개 완등',
    metric: 'red',
    target: 50,
  },
  {
    id: 'theclimb-red-100',
    name: '레드 카펫은 내 길',
    description: '[더클라임] 빨강 문제 100개 완등',
    metric: 'red',
    target: 100,
  },
  {
    id: 'theclimb-pink-50',
    name: '분홍길만 걷자',
    description: '[더클라임] 핑크 문제 50개 완등',
    metric: 'pink',
    target: 50,
  },
  {
    id: 'theclimb-pink-100',
    name: '핑크빛 집착',
    description: '[더클라임] 핑크 문제 100개 완등',
    metric: 'pink',
    target: 100,
  },
  {
    id: 'theclimb-purple-50',
    name: '보라카이 말고 보라',
    description: '[더클라임] 보라 문제 50개 완등',
    metric: 'purple',
    target: 50,
  },
  {
    id: 'theclimb-purple-100',
    name: '보라색 맛 좀 볼래?',
    description: '[더클라임] 보라 문제 100개 완등',
    metric: 'purple',
    target: 100,
  },
  {
    id: 'krew-hosted-50',
    name: '천둥번개 주식회사',
    description: '[크루라이머] 번개 50회 개최',
    metric: 'hosted',
    target: 50,
  },
  {
    id: 'krew-attended-50',
    name: '또 오셨네요, 단골님',
    description: '[크루라이머] 번개 50회 참여',
    metric: 'attended',
    target: 50,
  },
];

export function quarterLabel(quarter: string) {
  const [year, number] = quarter.split('-Q');
  return `${year}년 ${number}분기`;
}
