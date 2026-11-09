// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {Climbing} from '../src/pages/Climbing';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps date, counts and memo after a failed save so a member can retry', async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/gyms')
      return new Response(
        JSON.stringify({
          gyms: [
            {
              id: 'gym',
              name: '테스트 암장',
              address: '',
              latitude: null,
              longitude: null,
              grades: [{id: 'gray', gymId: 'gym', name: '회색', color: '#888888'}],
            },
          ],
        })
      );
    if (url === '/api/me/level')
      return new Response(
        JSON.stringify({
          level: 0,

          inputs: {visits: 0, sends: 0, gyms: 0, earnedAchievements: [], byGrade: []},
        })
      );
    if (init?.method === 'POST') return new Response(JSON.stringify({error: '저장 실패'}), {status: 503});
    return new Response(JSON.stringify({visits: []}));
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter initialEntries={['/climbing?gym=gym']}>
      <Climbing />
    </MemoryRouter>
  );
  const counter = await screen.findByRole('spinbutton', {name: '회색'});
  fireEvent.change(counter, {target: {value: '10'}});
  fireEvent.change(screen.getByLabelText('한 줄 메모 (선택)'), {target: {value: '내 기록'}});
  fireEvent.click(screen.getByRole('button', {name: '기록 저장'}));
  await screen.findByRole('alert');
  expect((counter as HTMLInputElement).value).toBe('10');
  expect((screen.getByLabelText('한 줄 메모 (선택)') as HTMLTextAreaElement).value).toBe('내 기록');
  await waitFor(() => expect(screen.getByRole('button', {name: '기록 저장'}).hasAttribute('disabled')).toBe(false));
  const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
    gymId: 'gym',
    note: '내 기록',
    sends: [{gradeId: 'gray', count: 10}],
  });
});
