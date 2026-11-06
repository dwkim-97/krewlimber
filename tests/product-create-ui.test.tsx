// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {Market} from '../src/pages/Market';
import {ProductCreate} from '../src/pages/ProductCreate';
import {Protected} from '../src/components/Protected';
import {SessionContext} from '../src/stores/session';
import type {User} from '../src/types';

const user: User = {
  id: 'admin',
  username: 'test.admin',
  nickname: '운영진',
  role: 'admin',
  status: 'approved',
  bio: '',
  grade: '입문',
  location: '',
  gym: '',
  createdAt: '2026-11-06T00:00:00Z',
};
const json = (value: unknown) => new Response(JSON.stringify(value));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(['admin', 'member'] as const)(
  'shows the product registration link only to an administrator (%s)',
  async role => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/me/wallet' ? json({balance: 0, entries: []}) : json({items: [], total: 0, page: 1, pageSize: 12})
      )
    );
    render(
      <SessionContext.Provider value={{user: {...user, role}, loading: false, error: '', refresh: async () => user}}>
        <MemoryRouter>
          <Market />
        </MemoryRouter>
      </SessionContext.Provider>
    );
    await screen.findByText('상품을 준비하고 있어요');
    if (role === 'admin')
      expect(screen.getByRole('link', {name: '상품 등록'}).getAttribute('href')).toBe('/market/new');
    else expect(screen.queryByRole('link', {name: '상품 등록'})).toBeNull();
  }
);

function mountCreate(account: User | null) {
  render(
    <SessionContext.Provider value={{user: account, loading: false, error: '', refresh: async () => account}}>
      <MemoryRouter initialEntries={['/market/new']}>
        <Routes>
          <Route
            path="/market/new"
            element={
              <Protected access="admin">
                <ProductCreate />
              </Protected>
            }
          />
          <Route path="/market" element={<Market />} />
          <Route path="/me/orders" element={<h1>교환 내역 화면</h1>} />
          <Route path="/login" element={<h1>로그인</h1>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>
  );
}

it.each([null, {...user, role: 'member' as const}, {...user, status: 'pending' as const}])(
  'blocks registration for a non-administrator or unapproved session (%s)',
  async account => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mountCreate(account);
    expect(screen.queryByLabelText('상품 이름')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  }
);

it('creates a complete product, retains values on failure and returns to the market on success', async () => {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/admin/market/products' && init.method === 'POST') {
        requests.push(JSON.parse(String(init.body)));
        if (requests.length === 1)
          return new Response(JSON.stringify({error: '상품을 등록하지 못했습니다.'}), {status: 500});
        return json({product: {...requests[0], id: 'new-product', revision: 1, createdAt: '', updatedAt: ''}});
      }
      return url === '/api/me/wallet'
        ? json({balance: 0, entries: []})
        : json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  mountCreate(user);
  fireEvent.change(screen.getByLabelText('상품 이름'), {target: {value: '  크루 양말  '}});
  fireEvent.change(screen.getByLabelText('카테고리'), {target: {value: 'apparel'}});
  fireEvent.change(screen.getByLabelText('포인트 가격'), {target: {value: '250'}});
  fireEvent.change(screen.getByLabelText('재고'), {target: {value: '12'}});
  fireEvent.change(screen.getByLabelText('상품 설명'), {target: {value: '  크루 전용 양말  '}});
  fireEvent.click(screen.getByRole('button', {name: '상품 등록'}));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('상품 이름') as HTMLInputElement).value).toBe('  크루 양말  ');
  expect(requests[0]).toEqual({
    name: '크루 양말',
    category: 'apparel',
    points: 250,
    stock: 12,
    description: '크루 전용 양말',
    imageUrl: null,
    active: true,
  });
  fireEvent.click(screen.getByRole('button', {name: '상품 등록'}));
  await screen.findByRole('heading', {name: '포인트 마켓'});
  expect((await screen.findByRole('status')).textContent).toContain('상품을 등록했습니다.');
  expect(requests).toHaveLength(2);
});

it('returns to the market without saving when registration is cancelled', async () => {
  const mutations: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'POST') mutations.push(url);
      return url === '/api/me/wallet'
        ? json({balance: 0, entries: []})
        : json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  mountCreate(user);
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  await screen.findByRole('heading', {name: '포인트 마켓'});
  expect(mutations).toEqual([]);
});

it('does not redirect another page when a departed registration finishes saving', async () => {
  let finishSave: (response: Response) => void = () => {
    throw new Error('저장 요청이 아직 없습니다.');
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/admin/market/products' && init.method === 'POST')
        return new Promise<Response>(resolve => {
          finishSave = resolve;
        });
      return url === '/api/me/wallet'
        ? json({balance: 0, entries: []})
        : json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  mountCreate(user);
  fireEvent.change(screen.getByLabelText('상품 이름'), {target: {value: '크루 양말'}});
  fireEvent.click(screen.getByRole('button', {name: '상품 등록'}));
  await screen.findByRole('button', {name: '저장 중…'});
  fireEvent.click(screen.getByRole('link', {name: '마켓으로'}));
  fireEvent.click(await screen.findByRole('link', {name: '내 교환 내역'}));
  await screen.findByRole('heading', {name: '교환 내역 화면'});
  await act(async () => {
    finishSave(json({product: {id: 'saved-product'}}));
  });
  expect(screen.getByRole('heading', {name: '교환 내역 화면'})).toBeTruthy();
  expect(screen.queryByRole('heading', {name: '포인트 마켓'})).toBeNull();
});
