import type {Role} from '../types';

export const ROLE_LABELS: Record<Role, string> = {
  member: '회원',
  staff: '운영진',
  admin: '관리자',
};

export function hasManagementAccess(role: Role | undefined): boolean {
  return role === 'staff' || role === 'admin';
}
