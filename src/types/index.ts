export type Role = 'member' | 'admin';
export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Grade = '입문' | 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8+';
export type HonorKind = 'send' | 'growth' | 'crew';

export interface Profile {
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

export interface Member extends Profile {
  id: string;
  createdAt: string;
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

export interface HonorInput {
  userId: string;
  title: string;
  description: string;
  kind: HonorKind;
  achievedAt: string;
}
