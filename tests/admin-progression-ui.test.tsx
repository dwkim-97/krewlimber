// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {AdminProgression} from '../src/components/AdminProgression';
import {ACTIVITY_METRICS, EMPTY_COUNTS} from '../src/consts/progression';

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
