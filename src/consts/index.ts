import type {HonorKind, MemberStatus} from '@/types';

export const SESSION_CHECK_EVENT = 'krew:session-check';

export const GRADES = ['입문', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8+'] as const;
export const STATUS_LABELS: Record<MemberStatus, string> = {
  pending: '승인 대기',
  approved: '활동 중',
  rejected: '가입 반려',
  suspended: '활동 정지',
};
export const HONOR_LABELS: Record<HonorKind, string> = {send: '완등의 순간', growth: '한 뼘의 성장', crew: '크루의 힘'};
