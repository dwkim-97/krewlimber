import type {AchievementDefinition, ActivityCounts, ActivityMetric, MetricDefinition, TitleCategory} from '../types';

export const ACTIVITY_METRICS: MetricDefinition<ActivityMetric>[] = [
  {id: 'participation', label: '클라이밍 참여', unit: '회'},
  {id: 'hosted', label: '번개 개최', unit: '회'},
  {id: 'attended', label: '번개 참여', unit: '회'},
  {id: 'red', label: '[더클라임] 빨강 완등', unit: '개'},
  {id: 'pink', label: '[더클라임] 핑크 완등', unit: '개'},
  {id: 'purple', label: '[더클라임] 보라 완등', unit: '개'},
  {id: 'gray', label: '[더클라임] 회색 완등', unit: '개'},
];
export const EMPTY_COUNTS: ActivityCounts = {
  participation: 0,
  hosted: 0,
  attended: 0,
  red: 0,
  pink: 0,
  purple: 0,
  gray: 0,
};
export const PROGRESSION_METRICS: MetricDefinition[] = [
  ...ACTIVITY_METRICS,
  {id: 'pointsEarned', label: '[마켓] 포인트 순획득', unit: 'P'},
  {id: 'pointsSpent', label: '[마켓] 포인트 실사용', unit: 'P'},
];
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
    name: '보라 클래스',
    description: '[더클라임] 보라 완등 1위',
    metric: 'purple',
    unit: '개',
    accent: 'purple',
  },
  {
    id: 'gray',
    name: '세계관 최강자',
    description: '[더클라임] 회색 완등 1위',
    metric: 'gray',
    unit: '개',
    accent: 'gray',
  },
  {
    id: 'attended',
    name: '번개 붙박이',
    description: '번개 참여 횟수 1위',
    metric: 'attended',
    unit: '회',
    accent: 'lime',
  },
  {
    id: 'pointsEarned',
    name: '포인트 채굴왕',
    description: '포인트 순획득 1위',
    metric: 'pointsEarned',
    unit: 'P',
    accent: 'yellow',
  },
  {
    id: 'pointsSpent',
    name: '마켓 큰손',
    description: '포인트 실사용 1위',
    metric: 'pointsSpent',
    unit: 'P',
    accent: 'yellow',
  },
];
export const INITIAL_ACHIEVEMENTS: AchievementDefinition[] = [
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

export const ADDITIONAL_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'krew-attended-100',
    name: '번개가 나를 부른다',
    description: '[크루라이머] 번개 100회 참여',
    metric: 'attended',
    target: 100,
  },
  {
    id: 'market-earned-1000',
    name: '티끌 모아 초크백',
    description: '[마켓] 포인트 순획득 1,000P 달성',
    metric: 'pointsEarned',
    target: 1000,
  },
  {
    id: 'market-earned-5000',
    name: '포인트가 복사가 된다고',
    description: '[마켓] 포인트 순획득 5,000P 달성',
    metric: 'pointsEarned',
    target: 5000,
  },
  {
    id: 'market-earned-10000',
    name: '크루의 금고지기',
    description: '[마켓] 포인트 순획득 10,000P 달성',
    metric: 'pointsEarned',
    target: 10000,
  },
  {
    id: 'market-spent-1000',
    name: '첫 지름의 맛',
    description: '[마켓] 포인트 실사용 1,000P 달성',
    metric: 'pointsSpent',
    target: 1000,
  },
  {
    id: 'market-spent-5000',
    name: '포인트는 거들 뿐',
    description: '[마켓] 포인트 실사용 5,000P 달성',
    metric: 'pointsSpent',
    target: 5000,
  },
  {
    id: 'market-spent-10000',
    name: '이 구역 큰손은 나야',
    description: '[마켓] 포인트 실사용 10,000P 달성',
    metric: 'pointsSpent',
    target: 10000,
  },
];

export function quarterLabel(quarter: string) {
  const [year, number] = quarter.split('-Q');
  return `${year}년 ${number}분기`;
}
