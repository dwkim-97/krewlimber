// @vitest-environment jsdom
import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {Protected} from '../src/components/Protected';
import {useResource} from '../src/hooks/useResource';
import {SessionContext} from '../src/stores/session';
import type {User} from '../src/types';
function WalletView() {
  const {data, loading} = useResource<{balance: number}>('/me/wallet');
  return <output>{loading ? 'loading' : String(data?.balance)}</output>;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('removes old private resources immediately when the authenticated member changes', async () => {
  let balance = 1700;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({balance})))
  );
  const user: User = {
 level:0,
    fullName: '홍길동',
    id: 'a',
    username: 'account.a',
    nickname: '회원 A',
    role: 'member',
    status: 'approved',
    grade: 'V1',
    bio: '',
    gym: '',
    location: '',
    createdAt: '2026-01-01',
  };
  const view = (account: User) => (
    <MemoryRouter>
      <SessionContext.Provider value={{user: account, loading: false, error: '', refresh: async () => account}}>
        <Protected access="member">
          <WalletView />
        </Protected>
      </SessionContext.Provider>
    </MemoryRouter>
  );
  const rendered = render(view(user));
  await screen.findByText('1700');
  balance = 50;
  rendered.rerender(view({...user, id: 'b', username: 'account.b', nickname: '회원 B'}));
  expect(screen.queryByText('1700')).toBeNull();
  await screen.findByText('50');
});
