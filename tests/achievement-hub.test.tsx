// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {AchievementHub} from '../src/pages/AchievementHub';
vi.mock('../src/hooks/useSession', () => ({useSession: () => ({user: {role: 'admin'}})}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps cumulative achievements and quarterly hall of fame in distinct tabs', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/me/achievements'
              ? {
                  featuredAchievementId: null,
                  achievements: [
                    {
                      id: 'one',
                      name: '누적 업적',
                      description: '참여 10회',
                      metric: 'participation',
                      target: 10,
                      progress: 12,
                      earned: true,
                      featured: false,
                    },
                  ],
                }
              : {quarter: '2026-Q4', quarters: ['2026-Q4'], categories: []}
          )
        )
    )
  );
  render(
    <MemoryRouter initialEntries={['/achievements']}>
      <AchievementHub />
    </MemoryRouter>
  );
  expect(await screen.findByRole('button', {name: /누적 업적/, pressed: true})).toBeTruthy();
  expect(screen.getByRole('link', {name: '업적 관리'}).getAttribute('href')).toBe('/admin?tab=achievements');
  fireEvent.click(screen.getByRole('button', {name: '명예의 전당'}));
  expect(await screen.findByLabelText('명예의 전당 분기')).toBeTruthy();
  expect(screen.queryByRole('group', {name: '업적 목록'})).toBeNull();
  expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', {name: '업적 목록'}));
  expect(await screen.findByRole('button', {name: /누적 업적/, pressed: true})).toBeTruthy();
});
