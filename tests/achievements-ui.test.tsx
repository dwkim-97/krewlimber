// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {Me} from '../src/pages/Me';
import {SessionContext} from '../src/stores/session';
import {Achievements} from '../src/components/Achievements';
import {TitleList} from '../src/components/TitleList';
import type {AchievementCollection, TitleCategory, User} from '../src/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows short conditions, prevents unearned selection, and updates the featured achievement', async () => {
  let collection: AchievementCollection = {
    featuredAchievementId: null,
    achievements: [
      {
        id: 'red50',
        name: '적색경보 해제',
        description: '[더클라임] 빨강 문제 50개 완등',
        metric: 'red',
        target: 50,
        progress: 60,
        earned: true,
        featured: false,
      },
      {
        id: 'red100',
        name: '레드 카펫은 내 길',
        description: '[더클라임] 빨강 문제 100개 완등',
        metric: 'red',
        target: 100,
        progress: 60,
        earned: false,
        featured: false,
      },
    ],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit) => {
      if (url === '/api/me/featured-achievement') {
        const {achievementId} = JSON.parse(String(options.body));
        collection = {
          featuredAchievementId: achievementId,
          achievements: collection.achievements.map(x => ({...x, featured: x.id === achievementId})),
        };
      }
      return new Response(JSON.stringify(collection), {status: 200});
    })
  );
  render(<Achievements />);
  const list = await screen.findByRole('group', {name: '업적 목록'});
  expect(within(list).getByText('[더클라임] 빨강 문제 50개 완등')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: /레드 카펫은 내 길/, pressed: false}));
  expect((screen.getByRole('button', {name: '대표로 선택'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: /적색경보 해제/, pressed: false}));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: '대표로 선택'}));
  });
  await screen.findByRole('button', {name: '대표 업적 해제'});
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: '대표 업적 해제'}));
  });
  await screen.findByRole('button', {name: '대표로 선택'});
});

it('shows all tied title holders and expands the actual standings', () => {
  const category: TitleCategory = {
    id: 'participation',
    name: '암장 지박령',
    description: '클라이밍 참여 횟수 1위',
    metric: 'participation',
    unit: '회',
    accent: 'lime',
    standings: [
      {userId: 'a', nickname: '에이든', value: 12, rank: 1},
      {userId: 'b', nickname: '초크', value: 12, rank: 1},
      {userId: 'c', nickname: '루키', value: 3, rank: 3},
    ],
  };
  render(<TitleList categories={[category]} />);
  expect(screen.getByText('에이든, 초크')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: /암장 지박령/, expanded: false}));
  expect(within(screen.getByRole('list', {name: '암장 지박령 순위'})).getByText('루키')).toBeTruthy();
  expect(screen.getByRole('button', {name: /암장 지박령/, expanded: true}).getAttribute('aria-expanded')).toBe('true');
});

it('clears the previous account achievements when the active session changes', async () => {
  let activeId = 'a';
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/me/level'
              ? {
                  level: 0,

                  inputs: {visits: 0, sends: 0, gyms: 0, earnedAchievements: [], byGrade: []},
                }
              : {
                  featuredAchievementId: null,
                  achievements: [
                    {
                      id: activeId,
                      name: `${activeId}의 업적`,
                      description: `${activeId}의 기록`,
                      metric: 'red',
                      target: 50,
                      progress: 50,
                      earned: true,
                      featured: false,
                    },
                  ],
                }
          ),
          {status: 200}
        )
    )
  );
  const user: User = {
    level: 0,
    instagramUrl: '',
    fullName: '홍길동',
    id: 'a',
    username: 'account.a',
    nickname: '계정 A',
    role: 'member',
    status: 'approved',
    grade: 'V1',
    bio: '',
    location: '',
    gym: '',
    createdAt: '2026-01-01',
  };
  const tree = (account: User) => (
    <SessionContext.Provider value={{user: account, loading: false, error: '', refresh: async () => account}}>
      <MemoryRouter initialEntries={['/me?tab=achievements']}>
        <Me />
      </MemoryRouter>
    </SessionContext.Provider>
  );
  const view = render(tree(user));
  await screen.findByRole('button', {name: /a의 업적/, pressed: true});
  activeId = 'b';
  view.rerender(tree({...user, id: 'b', username: 'account.b', nickname: '계정 B'}));
  expect(screen.queryByRole('button', {name: /a의 업적/, pressed: true})).toBeNull();
  await screen.findByRole('button', {name: /b의 업적/, pressed: true});
});
