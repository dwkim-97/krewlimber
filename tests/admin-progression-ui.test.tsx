// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {AdminProgression} from '../src/components/AdminProgression';
import {ACTIVITY_METRICS, EMPTY_COUNTS, PROGRESSION_METRICS} from '../src/consts/progression';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('can load an unrecorded past quarter on a fresh database', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const quarter = new URL(url, 'http://test.local').searchParams.get('quarter') ?? '2026-Q4';
      return new Response(
        JSON.stringify({
          quarter,
          quarters: ['2026-Q4'],
          metrics: ACTIVITY_METRICS,
          achievementMetrics: PROGRESSION_METRICS,
          achievements: [],
          users: [
            {
              id: 'member',
              username: 'climber',
              nickname: '크루',
              status: 'approved',
              counts: {...EMPTY_COUNTS, participation: quarter === '2025-Q2' ? 7 : 0},
            },
          ],
        }),
        {status: 200}
      );
    })
  );
  render(<AdminProgression mode="activity" />);
  const year = await screen.findByLabelText('활동 기록 연도');
  fireEvent.change(year, {target: {value: '2025'}});
  fireEvent.change(screen.getByLabelText('활동 기록 분기'), {target: {value: '2'}});
  fireEvent.click(screen.getByRole('button', {name: '분기 조회'}));
  await waitFor(() =>
    expect((screen.getByRole('spinbutton', {name: /클라이밍 참여/}) as HTMLInputElement).value).toBe('7')
  );
});

it('lets staff change an achievement description and goal while keeping point counters automatic', async () => {
  let saved: Record<string, unknown> | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        saved = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ok: true}));
      }
      return new Response(
        JSON.stringify({
          quarter: '2026-Q4',
          quarters: ['2026-Q4'],
          metrics: ACTIVITY_METRICS,
          achievementMetrics: PROGRESSION_METRICS,
          users: [],
          achievements: [
            {id: 'earned', name: '티끌 모아 초크백', description: '1,000P 획득', metric: 'pointsEarned', target: 1000},
          ],
        })
      );
    })
  );
  render(<AdminProgression mode="achievements" />);
  fireEvent.click(await screen.findByText('조건 수정'));
  fireEvent.change(screen.getByLabelText('티끌 모아 초크백 목표 수량'), {target: {value: '2000'}});
  fireEvent.change(screen.getByLabelText('티끌 모아 초크백 설명'), {target: {value: '2,000P 순획득'}});
  fireEvent.click(screen.getByRole('button', {name: '조건 저장'}));
  await screen.findByText('업적 조건을 수정했습니다.');
  expect(saved).toEqual({description: '2,000P 순획득', target: 2000});
  expect(screen.getByRole('option', {name: '[마켓] 포인트 순획득'})).toBeTruthy();
});
