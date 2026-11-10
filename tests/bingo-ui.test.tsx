// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, renderHook, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {Bingo} from '../src/pages/Bingo';
import {useBingoResource} from '../src/hooks/useBingoResource';
import {SessionContext} from '../src/stores/session';
import type {BingoState} from '../src/types/bingo';
import type {User} from '../src/types';

const numbers = Array.from({length: 25}, (_, index) => index + 1);
function state(phase: 'collecting' | 'playing' | 'finished' = 'collecting'): BingoState {
  return {
    event: {id: 'event', maxValue: 30, phase, revision: 1},
    team: {
      id: 'team',
      name: '파랑 조',
      acquired: numbers,
      board: Array(25).fill(null),
      marked: [],
      revision: 2,
      lines: 0,
      ready: false,
    },
    isMember: false,
    canMark: false,
    rankings: [],
  };
}
function Location() {
  const location = useLocation();
  return <output aria-label="현재 위치">{JSON.stringify(location)}</output>;
}
function mount() {
  return render(
    <MemoryRouter>
      <Bingo />
      <Location />
    </MemoryRouter>
  );
}
const response = (value: unknown) => new Response(JSON.stringify(value));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('joins with a team code and places only obtained numbers using the current revision', async () => {
  const joined = state();
  let current: BingoState = {...joined, team: null};
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/join')) current = joined;
    if (url.endsWith('/board')) {
      expect(JSON.parse(String(init.body))).toEqual({
        eventId: 'event',
        teamId: 'team',
        board: [1, ...Array(24).fill(null)],
        revision: 2,
      });
      current = {...joined, team: {...joined.team!, board: [1, ...Array(24).fill(null)], revision: 3}};
    }
    return response(current);
  });
  vi.stubGlobal('fetch', fetcher);
  mount();
  fireEvent.change(await screen.findByLabelText('조 코드'), {target: {value: 'JOIN123'}});
  fireEvent.click(screen.getByRole('button', {name: '조 입장'}));
  await screen.findByRole('heading', {name: '파랑 조'});
  fireEvent.click(screen.getByRole('checkbox', {name: '모든 숫자 보기'}));
  expect((screen.getByRole('button', {name: '숫자 26'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: '숫자 1'}));
  fireEvent.click(screen.getByRole('button', {name: '1행 1열 빈칸'}));
  await screen.findByRole('button', {name: '1행 1열 숫자 1'});
});

it('prevents arrangement until 25 numbers are collected and deletes an unplaced number', async () => {
  const current = state();
  current.team!.acquired = [1, 2];
  const fetcher = vi.fn(async (_url: string) => response(current));
  vi.stubGlobal('fetch', fetcher);
  mount();
  await screen.findByRole('heading', {name: '파랑 조'});
  expect((screen.getByRole('button', {name: '1행 1열 빈칸'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: '숫자 1'}));
  fireEvent.click(screen.getByRole('button', {name: '선택한 숫자 삭제'}));
  await waitFor(() => expect(fetcher.mock.calls.some(call => String(call[0]).endsWith('/numbers/1'))).toBe(true));
});

it('keeps guests read only during play and returns to bingo after login', async () => {
  const current = state('playing');
  current.team!.board = numbers;
  current.team!.ready = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(current))
  );
  mount();
  const cell = await screen.findByRole('button', {name: '1행 1열 숫자 1'});
  expect((cell as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('link', {name: '회원 로그인'}));
  expect(screen.getByLabelText('현재 위치').textContent).toContain('"from":"/event/bingo"');
});

it('lets approved members explicitly check and uncheck a number', async () => {
  let current = state('playing');
  current = {...current, isMember: true, canMark: true, team: {...current.team!, board: numbers, ready: true}};
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/marks')) {
      const body = JSON.parse(String(init.body));
      current = {
        ...current,
        team: {...current.team!, marked: body.checked ? [body.number] : [], revision: current.team!.revision + 1},
      };
    }
    return response(current);
  });
  vi.stubGlobal('fetch', fetcher);
  mount();
  fireEvent.click(await screen.findByRole('button', {name: '1행 1열 숫자 1'}));
  await waitFor(() =>
    expect(screen.getByRole('button', {name: '1행 1열 숫자 1'}).getAttribute('aria-pressed')).toBe('true')
  );
  fireEvent.click(screen.getByRole('button', {name: '1행 1열 숫자 1'}));
  await waitFor(() =>
    expect(screen.getByRole('button', {name: '1행 1열 숫자 1'}).getAttribute('aria-pressed')).toBe('false')
  );
  expect(
    fetcher.mock.calls.filter(call => String(call[0]).endsWith('/marks')).map(call => JSON.parse(String(call[1].body)))
  ).toEqual([
    {eventId: 'event', teamId: 'team', number: 1, checked: true, revision: 2},
    {eventId: 'event', teamId: 'team', number: 1, checked: false, revision: 3},
  ]);
});

it('locks finished boards and shows shared ranks and incomplete teams', async () => {
  const current = state('finished');
  current.team!.board = numbers;
  current.team!.lines = 3;
  current.rankings = [
    {teamId: 'a', name: '빨강 조', lines: 4, rank: 1, ready: true},
    {teamId: 'b', name: '노랑 조', lines: 4, rank: 1, ready: true},
    {teamId: 'c', name: '초록 조', lines: 0, rank: null, ready: false},
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(current))
  );
  mount();
  await screen.findByRole('heading', {name: '최종 순위'});
  expect(screen.getByText('우리 조 3줄')).toBeTruthy();
  expect(screen.getAllByText('공동 1위')).toHaveLength(2);
  expect(screen.getByText('미완성 · 순위 없음')).toBeTruthy();
  expect((screen.getByRole('button', {name: '1행 1열 숫자 1'}) as HTMLButtonElement).disabled).toBe(true);
});

it('does not let a late poll overwrite a mutation', async () => {
  let finishPoll: (value: Response) => void = () => {};
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'POST') return response({value: 2});
      calls++;
      if (calls === 2)
        return new Promise<Response>(resolve => {
          finishPoll = resolve;
        });
      return response({value: 1});
    })
  );
  const {result} = renderHook(() => useBingoResource<{value: number}>('/event/bingo'));
  await waitFor(() => expect(result.current.data?.value).toBe(1));
  let poll: Promise<void>;
  act(() => {
    poll = result.current.refresh();
  });
  await act(async () => {
    await result.current.send('/event/bingo/join', 'POST', {code: 'x'});
  });
  await act(async () => {
    finishPoll(response({value: 1}));
    await poll;
  });
  expect(result.current.data?.value).toBe(2);
});

it('refreshes conflicting state and retains the write error through routine polling', async () => {
  vi.useFakeTimers();
  let value = 1;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'PUT') {
        value = 3;
        return new Response(JSON.stringify({error: '다른 조원이 먼저 변경했어요.'}), {status: 409});
      }
      return response({value});
    })
  );
  const {result} = renderHook(() => useBingoResource<{value: number}>('/event/bingo'));
  await act(async () => {});
  await act(async () => {
    await result.current.send('/event/bingo/board', 'PUT', {revision: 1});
  });
  expect(result.current.error).toBe('다른 조원이 먼저 변경했어요.');
  expect(result.current.data?.value).toBe(3);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(result.current.error).toBe('다른 조원이 먼저 변경했어요.');
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.error).toBe('');
});

it('discards old member permissions after logout even if a request completes late', async () => {
  let finish: (value: Response) => void = () => {};
  const member: User = {
    level: 0,
    instagramUrl: '',
    fullName: '회원',
    id: 'member',
    username: 'member',
    nickname: '회원',
    role: 'member',
    status: 'approved',
    bio: '',
    grade: '입문',
    location: '',
    gym: '',
    createdAt: '',
  };
  let user: typeof member | null = member;
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === 'PUT')
      return new Promise<Response>(resolve => {
        finish = resolve;
      });
    return response({canMark: user !== null});
  });
  vi.stubGlobal('fetch', fetcher);
  const {result, rerender} = renderHook(() => useBingoResource<{canMark: boolean}>('/event/bingo'), {
    wrapper: ({children}) => (
      <SessionContext.Provider value={{user, loading: false, error: '', refresh: async () => user}}>
        {children}
      </SessionContext.Provider>
    ),
  });
  await waitFor(() => expect(result.current.data?.canMark).toBe(true));
  let saving: Promise<boolean>;
  act(() => {
    saving = result.current.send('/event/bingo/marks', 'PUT', {number: 1});
  });
  user = null;
  rerender();
  await waitFor(() => expect(result.current.data?.canMark).toBe(false));
  await act(async () => {
    finish(response({canMark: true}));
    await saving;
  });
  expect(result.current.data?.canMark).toBe(false);
});

it('lets a slow state read finish instead of restarting it every polling interval', async () => {
  vi.useFakeTimers();
  let finish: (value: Response) => void = () => {};
  const fetcher = vi.fn(
    () =>
      new Promise<Response>(resolve => {
        finish = resolve;
      })
  );
  vi.stubGlobal('fetch', fetcher);
  const {result} = renderHook(() => useBingoResource<{value: number}>('/event/bingo'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(response({value: 7}));
  });
  expect(result.current.data?.value).toBe(7);
});

it('targets the displayed event and team when collecting, removing numbers and leaving', async () => {
  let current = state();
  const fetcher = vi.fn(async (url: string, _init: RequestInit) => {
    if (url.endsWith('/leave')) current = {...current, team: null};
    return response(current);
  });
  vi.stubGlobal('fetch', fetcher);
  mount();
  fireEvent.change(await screen.findByLabelText('획득한 숫자'), {target: {value: '26'}});
  fireEvent.click(screen.getByRole('button', {name: '숫자 추가'}));
  await waitFor(() => expect((screen.getByLabelText('획득한 숫자') as HTMLInputElement).value).toBe(''));
  fireEvent.click(screen.getByRole('button', {name: '숫자 1'}));
  fireEvent.click(screen.getByRole('button', {name: '선택한 숫자 삭제'}));
  await waitFor(() =>
    expect((screen.getByRole('button', {name: '선택한 숫자 삭제'}) as HTMLButtonElement).disabled).toBe(true)
  );
  fireEvent.click(screen.getByRole('button', {name: '조 나가기'}));
  await screen.findByRole('button', {name: '조 입장'});
  const writes = fetcher.mock.calls.filter(call => call[1].method);
  expect(writes.map(([url, init]) => [url, JSON.parse(String(init.body))])).toEqual([
    ['/api/event/bingo/numbers', {eventId: 'event', teamId: 'team', number: 26, revision: 2}],
    ['/api/event/bingo/numbers/1', {eventId: 'event', teamId: 'team', revision: 2}],
    ['/api/event/bingo/leave', {eventId: 'event', teamId: 'team'}],
  ]);
});

it('allows clearing occupied cells below 25 acquired numbers while empty cells remain locked', async () => {
  let current = state();
  current.team!.acquired = numbers.slice(0, 24);
  current.team!.board = [...numbers.slice(0, 24), null];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/board'))
      current = {...current, team: {...current.team!, board: JSON.parse(String(init.body)).board}};
    return response(current);
  });
  vi.stubGlobal('fetch', fetcher);
  mount();
  const occupied = await screen.findByRole('button', {name: '1행 1열 숫자 1'});
  expect((occupied as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button', {name: '5행 5열 빈칸'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(occupied);
  await screen.findByRole('button', {name: '1행 1열 빈칸'});
  const write = fetcher.mock.calls.find(([url]) => url.endsWith('/board'));
  expect(JSON.parse(String(write![1].body))).toEqual({
    eventId: 'event',
    teamId: 'team',
    revision: 2,
    board: [null, ...numbers.slice(1, 24), null],
  });
  expect((screen.getByRole('button', {name: '1행 1열 빈칸'}) as HTMLButtonElement).disabled).toBe(true);
});

it('locks the acquired-number input until the submitted number finishes saving', async () => {
  let finish: (value: Response) => void = () => {};
  const current = state();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'POST')
        return new Promise<Response>(resolve => {
          finish = resolve;
        });
      return response(current);
    })
  );
  mount();
  const input = (await screen.findByLabelText('획득한 숫자')) as HTMLInputElement;
  fireEvent.change(input, {target: {value: '26'}});
  fireEvent.click(screen.getByRole('button', {name: '숫자 추가'}));
  expect(input.disabled).toBe(true);
  expect(input.value).toBe('26');
  await act(async () => {
    finish(response(current));
  });
  expect(input.disabled).toBe(false);
  expect(input.value).toBe('');
});
