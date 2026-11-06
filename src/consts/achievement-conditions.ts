import type {AchievementCondition} from '@/types';
export function conditionLabel(c: AchievementCondition, target: number) {
  return `${c.gymName} · ${c.difficultyRank}단계 ${c.gradeName}${c.operator === 'gte' ? ' 이상' : '만'} · 누적 ${target.toLocaleString()}개`;
}
