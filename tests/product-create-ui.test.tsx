// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {Market, ProductDetail} from '../src/pages/Market';
import {ProductCreate, ProductEdit} from '../src/pages/ProductCreate';
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

it('previews a selected file, uploads it and reuses its saved URL after a product save failure', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test-product');
      static revokeObjectURL = vi.fn();
    }
  );
  const file = new File(['image'], 'chalk.png', {type: 'image/png'});
  let uploads = 0;
  const products: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/admin/market/images') {
        uploads++;
        expect(init.body).toBe(file);
        expect(init.headers).toMatchObject({'Content-Type': 'image/png'});
        return json({imageUrl: '/api/market/images/saved.webp'});
      }
      if (url === '/api/admin/market/products' && init.method === 'POST') {
        products.push(JSON.parse(String(init.body)));
        if (products.length === 1) return new Response(JSON.stringify({error: '저장 실패'}), {status: 500});
        return json({product: {id: 'saved'}});
      }
      return url === '/api/me/wallet'
        ? json({balance: 0, entries: []})
        : json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  mountCreate(user);
  fireEvent.change(screen.getByLabelText('상품 이름'), {target: {value: '사진 있는 초크백'}});
  fireEvent.change(screen.getByLabelText('상품 이미지'), {target: {files: [file]}});
  expect(screen.getByRole('img', {name: '상품 이미지 미리보기'}).getAttribute('src')).toBe('blob:test-product');
  fireEvent.click(screen.getByRole('button', {name: '상품 등록'}));
  await screen.findByText('저장 실패');
  expect(products[0].imageUrl).toBe('/api/market/images/saved.webp');
  fireEvent.click(screen.getByRole('button', {name: '상품 등록'}));
  await screen.findByRole('heading', {name: '포인트 마켓'});
  expect(uploads).toBe(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-product');
});

it('rejects invalid file types and large images without sending a request', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  mountCreate(user);
  fireEvent.change(screen.getByLabelText('상품 이미지'), {
    target: {files: [new File(['<svg/>'], 'unsafe.svg', {type: 'image/svg+xml'})]},
  });
  expect((await screen.findByRole('alert')).textContent).toContain('JPG');
  fireEvent.change(screen.getByLabelText('상품 이미지'), {
    target: {files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {type: 'image/png'})]},
  });
  expect((await screen.findByRole('alert')).textContent).toContain('5MB');
  expect(fetcher).not.toHaveBeenCalled();
});

it('lets an administrator stop an existing product with its current revision and remove its image', async () => {
  const product = {
    id: 'existing',
    name: '판매 중인 초크백',
    description: '기존 상품',
    imageUrl: '/images/old.webp',
    category: 'gear',
    points: 300,
    stock: 10,
    active: true,
    revision: 4,
    createdAt: '',
    updatedAt: '',
  };
  let saved: Record<string, unknown> | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        saved = JSON.parse(String(init.body));
        return json({product: {...product, ...saved}});
      }
      if (url === '/api/admin/market/products/existing') return json({product});
      return url === '/api/me/wallet'
        ? json({balance: 0, entries: []})
        : json({items: [], total: 0, page: 1, pageSize: 12});
    })
  );
  render(
    <SessionContext.Provider value={{user, loading: false, error: '', refresh: async () => user}}>
      <MemoryRouter initialEntries={['/market/existing/edit']}>
        <Routes>
          <Route
            path="/market/:id/edit"
            element={
              <Protected access="admin">
                <ProductEdit />
              </Protected>
            }
          />
          <Route path="/market" element={<Market />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>
  );
  await screen.findByDisplayValue(product.name);
  fireEvent.change(screen.getByLabelText('판매 상태'), {target: {value: 'false'}});
  fireEvent.click(screen.getByRole('button', {name: '이미지 제거'}));
  fireEvent.click(screen.getByRole('button', {name: '상품 저장'}));
  await screen.findByRole('heading', {name: '포인트 마켓'});
  expect(saved).toMatchObject({active: false, revision: 4, imageUrl: null, name: product.name, points: 300, stock: 10});
  expect((await screen.findByRole('status')).textContent).toContain('상품을 수정했습니다.');
});

it('keeps the selected image when upload fails and does not create a product', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:pending-image';
      static revokeObjectURL = vi.fn();
    }
  );
  const writes: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      writes.push(url);
      return new Response(JSON.stringify({error: '이미지 업로드에 실패했습니다.'}), {status: 500});
    })
  );
  mountCreate(user);
  fireEvent.change(screen.getByLabelText('상품 이름'), {target: {value: '크루 브러시'}});
  fireEvent.change(screen.getByLabelText('상품 이미지'), {
    target: {files: [new File(['image'], 'brush.png', {type: 'image/png'})]},
  });
  fireEvent.click(screen.getByRole('button', {name: '상품 등록'}));
  await screen.findByText('이미지 업로드에 실패했습니다.');
  expect(writes).toEqual(['/api/admin/market/images']);
  expect(screen.getByRole('img', {name: '상품 이미지 미리보기'}).getAttribute('src')).toBe('blob:pending-image');
  expect((screen.getByLabelText('상품 이름') as HTMLInputElement).value).toBe('크루 브러시');
});

it.each(['admin', 'member'] as const)(
  'shows the existing product edit link only to an administrator (%s)',
  async role => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/me/wallet'
          ? json({balance: 0, entries: []})
          : json({
              product: {
                id: 'existing',
                name: '기존 상품',
                description: '',
                imageUrl: null,
                category: 'gear',
                points: 100,
                stock: 1,
                active: true,
                revision: 1,
                createdAt: '',
                updatedAt: '',
              },
            })
      )
    );
    render(
      <SessionContext.Provider value={{user: {...user, role}, loading: false, error: '', refresh: async () => user}}>
        <MemoryRouter initialEntries={['/market/existing']}>
          <Routes>
            <Route path="/market/:id" element={<ProductDetail />} />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    );
    await screen.findByRole('heading', {name: '기존 상품'});
    if (role === 'admin')
      expect(screen.getByRole('link', {name: '상품 수정'}).getAttribute('href')).toBe('/market/existing/edit');
    else expect(screen.queryByRole('link', {name: '상품 수정'})).toBeNull();
  }
);
