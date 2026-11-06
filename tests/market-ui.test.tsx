// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {Market, ProductDetail} from '../src/pages/Market';
import {AdminMarket} from '../src/components/AdminMarket';
import {MyOrders} from '../src/pages/MyOrders';
import {SessionContext} from '../src/stores/session';

const product = {
  id: 'chalk',
  name: '크루 초크백',
  description: '함께 오르는 날',
  imageUrl: null,
  category: 'gear',
  points: 120,
  stock: 10,
  revision: 1,
  active: true,
  createdAt: '',
  updatedAt: '',
};
const order = {
  id: 'order',
  userId: 'member',
  username: 'crew',
  nickname: '크루',
  productId: 'chalk',
  productName: product.name,
  imageUrl: null,
  points: 120,
  quantity: 1,
  total: 120,
  status: 'pending',
  createdAt: '2026-11-05T00:00:00Z',
  updatedAt: '',
};
const json = (value: unknown) => new Response(JSON.stringify(value), {status: 200});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('retains request ID and revision after uncertain failures and changes intent for a new quantity', async () => {
  const requests: {productId: string; quantity: number; productRevision: number; requestId: string}[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/market/orders') {
        requests.push(JSON.parse(String(init.body)));
        if (requests.length === 2)
          return new Response(JSON.stringify({error: '서버 응답을 확인하지 못했습니다.'}), {status: 503});
        throw new TypeError('응답을 받지 못했습니다.');
      }
      if (url === '/api/me/wallet') return json({balance: 1000, entries: []});
      return json({product});
    })
  );
  render(
    <MemoryRouter initialEntries={['/market/chalk']}>
      <Routes>
        <Route path="/market/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );
  const submit = await screen.findByRole('button', {name: '교환 신청'});
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
  fireEvent.click(submit);
  await screen.findByRole('alert');
  expect(screen.queryByText('교환을 신청했어요.')).toBeNull();
  fireEvent.click(submit);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].requestId).toBe(requests[1].requestId);
  expect(requests[0].productRevision).toBe(1);
  expect(requests[1].productRevision).toBe(1);
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
  fireEvent.click(submit);
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2]).toEqual(requests[0]);
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
  fireEvent.change(screen.getByLabelText('수량'), {target: {value: '2'}});
  fireEvent.click(submit);
  await waitFor(() => expect(requests).toHaveLength(4));
  expect(requests[3].requestId).not.toBe(requests[0].requestId);
  expect(requests[3].quantity).toBe(2);
});

it('refreshes wallet and orders after cancelling a pending exchange', async () => {
  let cancelled = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/cancel')) {
        cancelled = true;
        return json({order: {...order, status: 'cancelled'}});
      }
      if (url === '/api/me/wallet') return json({balance: cancelled ? 1000 : 880, entries: []});
      return json({items: [{...order, status: cancelled ? 'cancelled' : 'pending'}], total: 1, page: 1, pageSize: 12});
    })
  );
  render(
    <MemoryRouter>
      <MyOrders />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole('button', {name: '신청 취소'}));
  await screen.findByText('취소됨');
  await screen.findByText('1,000 P');
  expect(screen.queryByRole('button', {name: '신청 취소'})).toBeNull();
});

it('uses the all category API value and changes category without retaining the page', async () => {
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      paths.push(url);
      if (url === '/api/me/wallet') return json({balance: 1000, entries: []});
      return json({items: [product], total: 1, page: 1, pageSize: 12});
    })
  );
  render(
    <MemoryRouter initialEntries={['/market?page=2']}>
      <SessionContext.Provider value={{user: null, loading: false, error: '', refresh: async () => null}}>
        <Market />
      </SessionContext.Provider>
    </MemoryRouter>
  );
  await screen.findByRole('heading', {name: product.name});
  expect(paths.some(path => path.includes('category=all') && path.includes('page=2'))).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: '이용권'}));
  await waitFor(() =>
    expect(paths.some(path => path.includes('category=voucher') && path.includes('page=1'))).toBe(true)
  );
});

it('shows a successful exchange and refreshes balance and stock', async () => {
  let redeemed = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/market/orders') {
        redeemed = true;
        return json({order});
      }
      if (url === '/api/me/wallet') return json({balance: redeemed ? 880 : 1000, entries: []});
      return json({product: {...product, stock: redeemed ? 9 : 10}});
    })
  );
  render(
    <MemoryRouter initialEntries={['/market/chalk']}>
      <Routes>
        <Route path="/market/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );
  const submit = await screen.findByRole('button', {name: '교환 신청'});
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
  fireEvent.click(submit);
  await screen.findByText('교환을 신청했어요.');
  await screen.findByText('880 P');
  await screen.findByText('9개');
});

it('sends every product input field when stopping sales', async () => {
  let submitted: Record<string, unknown> | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        submitted = JSON.parse(String(init.body));
        return json({product: {...product, active: false}});
      }
      return json({items: [product], total: 1, page: 1, pageSize: 12});
    })
  );
  render(<AdminMarket />);
  fireEvent.click(await screen.findByRole('button', {name: '수정'}));
  fireEvent.change(screen.getByLabelText('판매 상태'), {target: {value: 'false'}});
  fireEvent.click(screen.getByRole('button', {name: '상품 저장'}));
  await screen.findByText('상품을 저장했습니다.');
  expect(submitted).toEqual({
    name: product.name,
    description: product.description,
    imageUrl: null,
    category: 'gear',
    points: 120,
    stock: 10,
    revision: 1,
    active: false,
  });
});

it('keeps unsaved product edits and its original revision after a conflict', async () => {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        requests.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({error: '상품이 변경되었습니다. 새로 불러온 뒤 다시 수정해주세요.'}), {
          status: 409,
        });
      }
      return json({items: [product], total: 1, page: 1, pageSize: 12});
    })
  );
  render(<AdminMarket />);
  fireEvent.click(await screen.findByRole('button', {name: '수정'}));
  fireEvent.change(screen.getByLabelText('상품 이름'), {target: {value: '수정 중인 초크백'}});
  fireEvent.click(screen.getByRole('button', {name: '상품 저장'}));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('상품 이름') as HTMLInputElement).value).toBe('수정 중인 초크백');
  expect(screen.queryByText('상품을 저장했습니다.')).toBeNull();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({name: '수정 중인 초크백', revision: 1});
});

it('reloads the edit values with their revision when reopening a refreshed product', async () => {
  let refreshed = false;
  let submitted: Record<string, unknown> | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        submitted = JSON.parse(String(init.body));
        return json({product});
      }
      if (url.includes('q=chalk')) refreshed = true;
      return json({
        items: [{...product, stock: refreshed ? 9 : 10, revision: refreshed ? 2 : 1}],
        total: 1,
        page: 1,
        pageSize: 12,
      });
    })
  );
  render(<AdminMarket />);
  fireEvent.click(await screen.findByRole('button', {name: '수정'}));
  fireEvent.change(screen.getByLabelText('관리 상품 검색'), {target: {value: 'chalk'}});
  fireEvent.click(screen.getByRole('button', {name: '검색'}));
  await screen.findByText('120 P · 재고 9개');
  fireEvent.click(screen.getByRole('button', {name: '수정'}));
  expect((screen.getByLabelText('재고') as HTMLInputElement).value).toBe('9');
  fireEvent.click(screen.getByRole('button', {name: '상품 저장'}));
  await screen.findByText('상품을 저장했습니다.');
  expect(submitted).toMatchObject({stock: 9, revision: 2});
});

it('refreshes a changed price after a definitive conflict and requires a fresh click', async () => {
  const requests: {requestId: string; productRevision: number}[] = [];
  let revision = 1;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/market/orders') {
        requests.push(JSON.parse(String(init.body)));
        if (requests.length === 1) {
          revision = 2;
          return new Response(JSON.stringify({error: '상품 가격이 변경되었습니다. 새 가격을 확인해주세요.'}), {
            status: 409,
          });
        }
        return json({order: {...order, points: 240, total: 240}});
      }
      if (url === '/api/me/wallet') return json({balance: 1000, entries: []});
      return json({product: {...product, revision, points: revision === 1 ? 120 : 240}});
    })
  );
  render(
    <MemoryRouter initialEntries={['/market/chalk']}>
      <Routes>
        <Route path="/market/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );
  const submit = await screen.findByRole('button', {name: '교환 신청'});
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
  fireEvent.click(submit);
  await screen.findByText('상품 가격이 변경되었습니다. 새 가격을 확인해주세요.');
  await screen.findByText('240 P');
  expect(requests).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', {name: '교환 신청'}));
  await screen.findByText('교환을 신청했어요.');
  expect(requests[0].productRevision).toBe(1);
  expect(requests[1].productRevision).toBe(2);
  expect(requests[1].requestId).not.toBe(requests[0].requestId);
});

it('reuses a point grant request ID after a lost response and resets it on edited intent', async () => {
  const requests: {requestId: string; amount: number; reason: string}[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/admin/points') {
        requests.push(JSON.parse(String(init.body)));
        if (requests.length < 3) throw new TypeError('응답을 받지 못했습니다.');
        return json({balance: 150, entries: []});
      }
      if (url === '/api/admin/users')
        return json({users: [{id: 'member', nickname: '크루', username: 'crew', status: 'approved'}]});
      if (url.startsWith('/api/admin/points?')) return json({balance: 0, entries: []});
      return json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  render(<AdminMarket />);
  fireEvent.click(screen.getByRole('button', {name: '포인트 지급'}));
  fireEvent.change(await screen.findByLabelText('회원 선택'), {target: {value: 'member'}});
  const amount = await screen.findByLabelText('지급·정정 포인트');
  const reason = screen.getByLabelText('사유');
  fireEvent.change(amount, {target: {value: '100'}});
  fireEvent.change(reason, {target: {value: '크루 활동'}});
  fireEvent.click(screen.getByRole('button', {name: '포인트 반영'}));
  await screen.findByRole('alert');
  expect((amount as HTMLInputElement).value).toBe('100');
  expect((reason as HTMLInputElement).value).toBe('크루 활동');
  fireEvent.click(screen.getByRole('button', {name: '포인트 반영'}));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(requests[1].requestId).toBe(requests[0].requestId);
  await waitFor(() => expect(screen.getByRole('button', {name: '포인트 반영'}).hasAttribute('disabled')).toBe(false));
  fireEvent.change(amount, {target: {value: '150'}});
  fireEvent.click(screen.getByRole('button', {name: '포인트 반영'}));
  await screen.findByText('포인트를 반영했습니다.');
  expect(requests[2].requestId).not.toBe(requests[1].requestId);
});

it('resets a point grant request after a definitive error while retaining the form', async () => {
  const requests: {requestId: string}[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/admin/points') {
        requests.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({error: '잔액보다 많이 차감할 수 없습니다.'}), {status: 409});
      }
      if (url === '/api/admin/users')
        return json({users: [{id: 'member', nickname: '크루', username: 'crew', status: 'approved'}]});
      if (url.startsWith('/api/admin/points?')) return json({balance: 0, entries: []});
      return json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  render(<AdminMarket />);
  fireEvent.click(screen.getByRole('button', {name: '포인트 지급'}));
  fireEvent.change(await screen.findByLabelText('회원 선택'), {target: {value: 'member'}});
  const amount = await screen.findByLabelText('지급·정정 포인트');
  fireEvent.change(amount, {target: {value: '-100'}});
  fireEvent.change(screen.getByLabelText('사유'), {target: {value: '포인트 정정'}});
  fireEvent.click(screen.getByRole('button', {name: '포인트 반영'}));
  await screen.findByRole('alert');
  expect((amount as HTMLInputElement).value).toBe('-100');
  fireEvent.click(screen.getByRole('button', {name: '포인트 반영'}));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].requestId).not.toBe(requests[0].requestId);
});
