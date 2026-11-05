// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {Link, MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '../src/components/SessionProvider';
import {useSession} from '../src/hooks/useSession';
import {api} from '../src/apis/client';
import type {User} from '../src/types';

const approved: User = {
  id: 'user-1',
  username: 'aiden.dw',
  nickname: '에이든',
  bio: '',
  location: '',
  gym: '',
  grade: '입문',
  role: 'member',
  status: 'approved',
  createdAt: '2026-11-05T00:00:00.000Z',
};
let serverUser: User | null;
beforeEach(() => {
  serverUser = {...approved};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/me') return new Response(JSON.stringify({user: serverUser}), {status: 200});
      return new Response(JSON.stringify({error: '로그인이 필요합니다.'}), {status: 401});
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function State() {
  const {user, loading} = useSession();
  return (
    <>
      <div>{loading ? '확인 중' : user ? `${user.nickname}:${user.status}` : '로그인이 필요해요'}</div>
      <Link to="/members">이동</Link>
    </>
  );
}
function showSession() {
  render(
    <MemoryRouter>
      <SessionProvider>
        <State />
      </SessionProvider>
    </MemoryRouter>
  );
}

it('clears a revoked session after a protected API returns 401 so login becomes reachable', async () => {
  showSession();
  await screen.findByText('에이든:approved');
  serverUser = null;
  await act(async () => {
    await expect(api('/members')).rejects.toThrow('로그인이 필요합니다.');
  });
  await waitFor(() => expect(screen.getByText('로그인이 필요해요')).toBeTruthy());
});

it('rechecks current membership when the window regains focus', async () => {
  showSession();
  await screen.findByText('에이든:approved');
  serverUser = {...approved, status: 'pending'};
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(screen.getByText('에이든:pending')).toBeTruthy());
});

it('keeps a valid session when a credential validation request alone returns 401', async () => {
  showSession();
  await screen.findByText('에이든:approved');
  await act(async () => {
    await expect(api('/me/password', {method: 'PATCH', body: '{}'})).rejects.toThrow();
  });
  expect(screen.getByText('에이든:approved')).toBeTruthy();
});

it('rechecks membership on navigation', async () => {
  showSession();
  await screen.findByText('에이든:approved');
  serverUser = {...approved, status: 'pending'};
  fireEvent.click(screen.getByRole('link', {name: '이동'}));
  await screen.findByText('에이든:pending');
});

it('never restores a revoked user from a slower older response', async () => {
  showSession();
  await screen.findByText('에이든:approved');
  let resolveOld: (value: Response) => void = () => {
    throw new Error('No pending request');
  };
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>(resolve => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValue(new Response(JSON.stringify({user: null}), {status: 200}))
  );
  fireEvent(window, new Event('focus'));
  fireEvent(window, new Event('focus'));
  await screen.findByText('로그인이 필요해요');
  await act(async () => {
    resolveOld(new Response(JSON.stringify({user: approved}), {status: 200}));
  });
  expect(screen.getByText('로그인이 필요해요')).toBeTruthy();
});
