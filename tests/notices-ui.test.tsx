// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {Notices, NoticeDetail, NoticeEditor} from '../src/pages/Notices';
import {SessionContext} from '../src/stores/session';
import type {User} from '../src/types';
import type {Notice} from '../src/types/boards';

const user: User = {
 level:0,
  fullName: '홍길동',
  id: 'member',
  username: 'member',
  nickname: '크루',
  role: 'member',
  status: 'approved',
  bio: '',
  grade: '입문',
  location: '',
  gym: '',
  createdAt: '2026-11-05T00:00:00Z',
};
const notice: Notice = {
  id: 'notice',
  title: '이번 주 모임',
  body: '<img src=x onerror=alert(1)>\n토요일에 만나요.',
  author: '운영진',
  pinned: true,
  views: 5,
  createdAt: '2026-11-05T00:00:00Z',
  updatedAt: '2026-11-05T00:00:00Z',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(path: string, role: 'member' | 'admin') {
  render(
    <SessionContext.Provider value={{user: {...user, role}, loading: false, error: '', refresh: async () => user}}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/notices" element={<Notices />} />
          <Route path="/notices/new" element={<NoticeEditor />} />
          <Route path="/notices/:id" element={<NoticeDetail />} />
          <Route path="/notices/:id/edit" element={<NoticeEditor />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>
  );
}

it('searches the board, resets its page and navigates to the next page', async () => {
  const fetcher = vi.fn(async (url: string) => {
    const query = new URL(url, 'http://localhost').searchParams;
    return new Response(
      JSON.stringify({items: [notice], total: 12, page: Number(query.get('page')) || 1, pageSize: 10})
    );
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/notices?page=2', 'member');
  await screen.findByRole('link', {name: /이번 주 모임/});
  expect(screen.queryByRole('link', {name: '공지 작성'})).toBeNull();
  fireEvent.change(screen.getByRole('searchbox', {name: '공지 검색'}), {target: {value: '정기 모임'}});
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() =>
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/api/notices?q=%EC%A0%95%EA%B8%B0+%EB%AA%A8%EC%9E%84&page=1')
  );
  await screen.findByRole('link', {name: /이번 주 모임/});
  fireEvent.click(screen.getByRole('button', {name: '다음 페이지'}));
  await waitFor(() => expect(fetcher.mock.calls.at(-1)?.[0]).toContain('page=2'));
});

it('renders the body as plain text and hides administrator actions for members', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({notice})))
  );
  mount('/notices/notice', 'member');
  await screen.findByRole('heading', {name: notice.title});
  expect(document.querySelector('.notice-body')?.textContent).toBe(notice.body);
  expect(document.querySelector('.notice-body img')).toBeNull();
  expect(screen.queryByRole('link', {name: '수정'})).toBeNull();
  expect(screen.queryByRole('button', {name: '삭제'})).toBeNull();
});

it('confirms deletion and keeps the detail visible after a failed delete', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
    init.method === 'DELETE'
      ? new Response(JSON.stringify({error: '삭제하지 못했습니다.'}), {status: 500})
      : new Response(JSON.stringify({notice}))
  );
  vi.stubGlobal('fetch', fetcher);
  mount('/notices/notice', 'admin');
  const remove = await screen.findByRole('button', {name: '삭제'});
  fireEvent.click(remove);
  expect(fetcher).toHaveBeenCalledTimes(1);
  confirm.mockReturnValue(true);
  fireEvent.click(remove);
  expect((await screen.findByRole('alert')).textContent).toContain('삭제하지 못했습니다.');
  expect(screen.getByRole('heading', {name: notice.title})).toBeTruthy();
});

it('submits complete editor values, retains input on failure and opens the saved notice', async () => {
  let attempt = 0;
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === 'POST') {
      attempt++;
      if (attempt === 1) return new Response(JSON.stringify({error: '저장하지 못했습니다.'}), {status: 500});
    }
    return new Response(JSON.stringify({notice}));
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/notices/new', 'admin');
  fireEvent.change(screen.getByRole('textbox', {name: '제목'}), {target: {value: notice.title}});
  fireEvent.change(screen.getByRole('textbox', {name: '본문'}), {target: {value: notice.body}});
  fireEvent.click(screen.getByRole('checkbox', {name: '상단 고정'}));
  fireEvent.click(screen.getByRole('button', {name: '등록'}));
  await screen.findByRole('alert');
  expect((screen.getByRole('textbox', {name: '제목'}) as HTMLInputElement).value).toBe(notice.title);
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({
    title: notice.title,
    body: notice.body,
    pinned: true,
  });
  fireEvent.click(screen.getByRole('button', {name: '등록'}));
  await screen.findByRole('heading', {name: notice.title});
  expect(screen.getByRole('link', {name: '수정'})).toBeTruthy();
});
