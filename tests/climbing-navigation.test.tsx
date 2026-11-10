// @vitest-environment jsdom
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {ClimbingRedirect} from '../src/pages/Climbing';
afterEach(cleanup);
function Destination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}
it('redirects old record links into the profile tab without losing the selected gym', async () => {
  render(
    <MemoryRouter initialEntries={['/climbing?gym=gym-test']}>
      <Routes>
        <Route path="/climbing" element={<ClimbingRedirect />} />
        <Route path="/me" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByText('/me?tab=climbing&gym=gym-test')).toBeTruthy();
});

it('opens the record form from the profile menu with one page heading', async () => {
  const {vi} = await import('vitest');
  const {fireEvent} = await import('@testing-library/react');
  const {Me} = await import('../src/pages/Me');
  const {SessionContext} = await import('../src/stores/session');
  const user = {
    level: 0,
    id: 'test',
    username: 'test',
    nickname: '테스트',
    instagramUrl: '',
    fullName: '홍길동',
    role: 'member' as const,
    status: 'approved' as const,
    createdAt: '2026-01-01',
    bio: '',
    grade: '입문' as const,
    gym: '',
    location: '',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/gyms'
              ? {gyms: []}
              : url === '/api/me/climbing'
                ? {visits: []}
                : {
                    level: 0,

                    inputs: {visits: 0, sends: 0, gyms: 0, earnedAchievements: [], byGrade: []},
                  }
          )
        )
    )
  );
  try {
    render(
      <SessionContext.Provider value={{user, loading: false, error: '', refresh: async () => user}}>
        <MemoryRouter initialEntries={['/me']}>
          <Me />
        </MemoryRouter>
      </SessionContext.Provider>
    );
    expect(await screen.findByRole('heading', {name: '나의 클라이밍'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: '등반 기록'}));
    expect(await screen.findByRole('heading', {name: '오늘의 기록 남기기'})).toBeTruthy();
    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
    expect(screen.getAllByRole('heading', {name: '나의 클라이밍'})).toHaveLength(1);
    expect(screen.getByRole('heading', {name: '등반 기록', level: 2})).toBeTruthy();
  } finally {
    vi.unstubAllGlobals();
  }
});
