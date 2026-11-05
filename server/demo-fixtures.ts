import {existsSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import type {ActivityCounts, Grade, MemberStatus, Role} from '../src/types';
import {EMPTY_COUNTS} from '../src/consts/progression';
import {createAccount} from './auth';
import {transaction} from './db';
import {currentQuarter, getAchievements, setActivityCounts, setFeaturedAchievement} from './progression';

export const DEMO_PASSWORD = 'Krew-Test-2026!';
interface DemoUser {
  username: string;
  nickname: string;
  role: Role;
  status: MemberStatus;
  grade: Grade;
  current: ActivityCounts;
  previous: ActivityCounts;
  featured: string | null;
}
const fixtures: DemoUser[] = [
  {
    username: 'test.admin',
    nickname: '운영진 · 테스트',
    role: 'admin',
    status: 'approved',
    grade: 'V4',
    current: {participation: 18, hosted: 12, attended: 20, red: 60, pink: 45, purple: 26},
    previous: {participation: 20, hosted: 20, attended: 35, red: 80, pink: 25, purple: 30},
    featured: 'theclimb-purple-50',
  },
  {
    username: 'test.aiden',
    nickname: '에이든 · 테스트',
    role: 'member',
    status: 'approved',
    grade: 'V6',
    current: {participation: 64, hosted: 16, attended: 54, red: 95, pink: 110, purple: 83},
    previous: {participation: 40, hosted: 40, attended: 20, red: 20, pink: 20, purple: 20},
    featured: 'theclimb-pink-100',
  },
  {
    username: 'test.red',
    nickname: '레드 · 테스트',
    role: 'member',
    status: 'approved',
    grade: 'V5',
    current: {participation: 30, hosted: 3, attended: 20, red: 120, pink: 18, purple: 4},
    previous: {...EMPTY_COUNTS, red: 50},
    featured: 'theclimb-red-100',
  },
  {
    username: 'test.host',
    nickname: '번개 · 테스트',
    role: 'member',
    status: 'approved',
    grade: 'V3',
    current: {participation: 20, hosted: 51, attended: 12, red: 10, pink: 12, purple: 1},
    previous: {...EMPTY_COUNTS, hosted: 4},
    featured: 'krew-hosted-50',
  },
  {
    username: 'test.twin',
    nickname: '보라 · 테스트',
    role: 'member',
    status: 'approved',
    grade: 'V5',
    current: {participation: 45, hosted: 7, attended: 45, red: 50, pink: 50, purple: 83},
    previous: {...EMPTY_COUNTS, attended: 15, purple: 5},
    featured: 'theclimb-purple-50',
  },
  {
    username: 'test.badge',
    nickname: '초크 · 테스트',
    role: 'member',
    status: 'approved',
    grade: 'V2',
    current: {participation: 14, hosted: 3, attended: 14, red: 30, pink: 5, purple: 0},
    previous: {...EMPTY_COUNTS, participation: 20, red: 30, attended: 20},
    featured: 'theclimb-red-50',
  },
  {
    username: 'test.unset',
    nickname: '단골 · 테스트',
    role: 'member',
    status: 'approved',
    grade: 'V3',
    current: {participation: 10, hosted: 0, attended: 20, red: 60, pink: 20, purple: 4},
    previous: {...EMPTY_COUNTS, attended: 40, red: 50},
    featured: null,
  },
  {
    username: 'test.rookie',
    nickname: '루키 · 테스트',
    role: 'member',
    status: 'approved',
    grade: '입문',
    current: {...EMPTY_COUNTS, participation: 4, hosted: 1, attended: 4, red: 2},
    previous: {...EMPTY_COUNTS},
    featured: null,
  },
  {
    username: 'test.pending',
    nickname: '새싹 · 테스트',
    role: 'member',
    status: 'pending',
    grade: '입문',
    current: {...EMPTY_COUNTS},
    previous: {...EMPTY_COUNTS},
    featured: null,
  },
  {
    username: 'test.rest',
    nickname: '휴식 · 테스트',
    role: 'member',
    status: 'suspended',
    grade: 'V7',
    current: {participation: 999, hosted: 999, attended: 999, red: 999, pink: 999, purple: 999},
    previous: {...EMPTY_COUNTS},
    featured: null,
  },
];

export function assertDemoDatabase(path: string, environment: 'development' | 'production') {
  if (environment === 'production') throw new Error('Demo seeding is disabled in production.');
  const file = resolve(path);
  const parent = dirname(file);
  if (!existsSync(parent) || !['test.sqlite', 'demo.sqlite'].includes(basename(file)))
    throw new Error('Use a dedicated temporary demo database.');
  const directory = realpathSync(parent);
  const roots = [tmpdir(), '/tmp', '/private/tmp'].filter(existsSync).map(path => realpathSync(path));
  if (!roots.includes(dirname(directory)) || !/^krewlimber-preview\.[a-zA-Z0-9]+$/.test(basename(directory)))
    throw new Error('Only a dedicated temporary preview directory is allowed.');
  if (existsSync(file) && realpathSync(file) !== resolve(directory, basename(file)))
    throw new Error('Database symlinks are not allowed.');
}

export async function seedDemoUsers(db: DatabaseSync) {
  const quarter = currentQuarter(new Date());
  const [year, part] = quarter.split('-Q');
  const previous = Number(part) === 1 ? `${Number(year) - 1}-Q4` : `${year}-Q${Number(part) - 1}`;
  for (const fixture of fixtures) {
    const existing = db.prepare('SELECT id FROM users WHERE username=?').get(fixture.username) as
      {id: string} | undefined;
    const user =
      existing ??
      (await createAccount(db, {
        username: fixture.username,
        password: DEMO_PASSWORD,
        nickname: fixture.nickname,
        role: fixture.role,
        status: fixture.status,
      }));
    transaction(db, () => {
      db.prepare('UPDATE users SET nickname=?,grade=?,bio=?,location=?,gym=? WHERE id=?').run(
        fixture.nickname,
        fixture.grade,
        '화면 확인용 테스트 유저입니다.',
        '테스트 지역',
        '더클라임 · 테스트',
        user.id
      );
      setActivityCounts(db, user.id, previous, fixture.previous);
      setActivityCounts(db, user.id, quarter, fixture.current);
      if (
        fixture.featured &&
        getAchievements(db, user.id).achievements.some(item => item.id === fixture.featured && item.earned)
      )
        setFeaturedAchievement(db, user.id, fixture.featured);
      else if (fixture.featured === null) setFeaturedAchievement(db, user.id, null);
    });
  }
  return {users: fixtures.length, quarter};
}
