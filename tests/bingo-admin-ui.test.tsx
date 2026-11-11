// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {Protected} from '../src/components/Protected';
import {SessionContext} from '../src/stores/session';
import type {User} from '../src/types';
import {BingoAdmin} from '../src/pages/BingoAdmin';
import type {BingoAdminState, BingoAdminTeam, BingoPhase} from '../src/types/bingo';

const resource = vi.hoisted(() => ({
  send: vi.fn(),
  refresh: vi.fn(),
  state: null as BingoAdminState | null,
  error: '',
}));
vi.mock('../src/hooks/useBingoResource', () => ({
  useBingoResource: () => ({
    data: resource.state,
    loading: false,
    busy: false,
    error: resource.error,
    send: resource.send,
    refresh: resource.refresh,
  }),
}));
const ready: BingoAdminTeam = {
  id: 'ready',
  name: '완성조',
  code: 'ABCD1234',
  acquired: Array.from({length: 25}, (_, i) => i + 1),
  board: Array.from({length: 25}, (_, i) => i + 1),
  marked: [],
  revision: 2,
  lines: 0,
  ready: true,
};
const unready: BingoAdminTeam = {
  ...ready,
  id: 'unready',
  name: '준비중조',
  code: 'EFGH5678',
  board: [1, ...Array<null>(24).fill(null)],
  ready: false,
};
function state(phase: BingoPhase): BingoAdminState {
  return {event: {id: 'event', maxValue: 75, phase, revision: 3}, teams: [ready, unready], rankings: []};
}
function view() {
  return render(
    <MemoryRouter>
      <BingoAdmin />
    </MemoryRouter>
  );
}
beforeEach(() => {
  resource.state = state('collecting');
  resource.error = '';
  resource.send.mockReset().mockResolvedValue(true);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('creates an event with a bounded maximum number and the default 75', async () => {
  resource.state = {event: null, teams: [], rankings: []};
  view();
  const input = screen.getByRole('spinbutton', {name: '최대 번호 (n)'}) as HTMLInputElement;
  expect([input.value, input.min, input.max]).toEqual(['75', '25', '1000']);
  fireEvent.click(screen.getByRole('button', {name: '이벤트 만들기'}));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/events', 'POST', {maxValue: 75});
});
it('shows team codes, board completion, and registers a named team', async () => {
  view();
  expect(screen.getByText('ABCD1234')).toBeTruthy();
  expect(screen.getByText('25 / 25칸')).toBeTruthy();
  expect(screen.getByText('1 / 25칸')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', {name: '조 이름'}), {target: {value: '새 조'}});
  fireEvent.click(screen.getByRole('button', {name: '조 등록'}));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/teams', 'POST', {eventId: 'event', name: '새 조'});
});
it('warns about unready teams before confirming a start and sends the event revision', () => {
  view();
  fireEvent.click(screen.getByRole('button', {name: '빙고 시작'}));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('준비중조'));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('순위에서 제외'));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/start', 'POST', {eventId: 'event', revision: 3});
});
it('does not permit starting without a complete board', () => {
  resource.state = {...state('collecting'), teams: [unready]};
  view();
  expect((screen.getByRole('button', {name: '빙고 시작'}) as HTMLButtonElement).disabled).toBe(true);
});
it('locks setup while playing and requires confirmation to finish', () => {
  resource.state = state('playing');
  vi.mocked(window.confirm).mockReturnValue(false);
  view();
  expect(screen.queryByRole('button', {name: '번호 범위 저장'})).toBeNull();
  expect(screen.queryByRole('button', {name: '조 등록'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: '빙고 종료'}));
  expect(resource.send).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', {name: '빙고 종료'}));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/finish', 'POST', {eventId: 'event', revision: 3});
});
it('keeps a number-range edit when synchronization or a conflict refreshes the state', () => {
  const rendered = view();
  fireEvent.change(screen.getByRole('spinbutton', {name: '최대 번호 (n)'}), {target: {value: '100'}});
  resource.state = {...state('collecting'), event: {id: 'event', maxValue: 80, phase: 'collecting', revision: 4}};
  resource.error = '다른 조원이 변경했습니다. 다시 확인해주세요.';
  rendered.rerender(
    <MemoryRouter>
      <BingoAdmin />
    </MemoryRouter>
  );
  expect((screen.getByRole('spinbutton', {name: '최대 번호 (n)'}) as HTMLInputElement).value).toBe('100');
  fireEvent.click(screen.getByRole('button', {name: '번호 범위 저장'}));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/config', 'PATCH', {
    eventId: 'event',
    maxValue: 100,
    revision: 4,
  });
});
it('updates an untouched number range when another operator changes it', () => {
  const rendered = view();
  resource.state = {...state('collecting'), event: {id: 'event', maxValue: 100, phase: 'collecting', revision: 4}};
  rendered.rerender(
    <MemoryRouter>
      <BingoAdmin />
    </MemoryRouter>
  );
  expect((screen.getByRole('spinbutton', {name: '최대 번호 (n)'}) as HTMLInputElement).value).toBe('100');
  fireEvent.click(screen.getByRole('button', {name: '번호 범위 저장'}));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/config', 'PATCH', {
    eventId: 'event',
    maxValue: 100,
    revision: 4,
  });
});
it('shows tied final rankings and creates a separate next event without a reset action', () => {
  resource.state = {
    ...state('finished'),
    rankings: [
      {teamId: 'one', name: '첫조', lines: 3, rank: 1, ready: true},
      {teamId: 'two', name: '둘조', lines: 3, rank: 1, ready: true},
      {teamId: 'three', name: '셋조', lines: 1, rank: 3, ready: true},
      {teamId: 'four', name: '미완성조', lines: 0, rank: null, ready: false},
    ],
  };
  view();
  const ranking = screen.getByRole('table', {name: '최종 순위'});
  expect(within(ranking).getAllByText('1위')).toHaveLength(2);
  expect(within(ranking).getByText('3위')).toBeTruthy();
  expect(within(ranking).getByText('미완성')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: '새 이벤트 만들기'}));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('기록은 보존'));
  expect(resource.send).toHaveBeenCalledWith('/event/bingo/admin/events', 'POST', {maxValue: 75});
});

it('copies a team code only after the copy button is pressed', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
  view();
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '완성조 조 코드 복사'}));
  expect(writeText).toHaveBeenCalledWith('ABCD1234');
  expect(await screen.findByRole('status')).toBeTruthy();
});

const staff: User = {
  id: 'staff',
  username: 'crew.staff',
  nickname: '운영진',
  fullName: '운영진',
  level: 0,
  instagramUrl: '',
  bio: '',
  location: '',
  gym: '',
  grade: '입문',
  role: 'staff',
  status: 'approved',
  createdAt: '',
};
it.each(['staff', 'admin'] as const)('permits approved %s through the admin route guard', role => {
  const user = {...staff, role};
  render(
    <MemoryRouter>
      <SessionContext.Provider value={{user, loading: false, error: '', refresh: async () => user}}>
        <Protected access="admin">
          <BingoAdmin />
        </Protected>
      </SessionContext.Provider>
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', {name: '빙고 운영'})).toBeTruthy();
});
it('blocks ordinary approved members from the admin page', () => {
  const user: User = {...staff, role: 'member'};
  render(
    <MemoryRouter>
      <SessionContext.Provider value={{user, loading: false, error: '', refresh: async () => user}}>
        <Protected access="admin">
          <BingoAdmin />
        </Protected>
      </SessionContext.Provider>
    </MemoryRouter>
  );
  expect(screen.queryByRole('heading', {name: '빙고 운영'})).toBeNull();
  expect(screen.getByText('운영진을 위한 공간이에요')).toBeTruthy();
});
it('sends guests from the admin route to login', () => {
  render(
    <MemoryRouter initialEntries={['/event/bingo/admin']}>
      <SessionContext.Provider value={{user: null, loading: false, error: '', refresh: async () => null}}>
        <Routes>
          <Route
            path="/event/bingo/admin"
            element={
              <Protected access="admin">
                <BingoAdmin />
              </Protected>
            }
          />
          <Route path="/login" element={<h1>로그인 화면</h1>} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', {name: '로그인 화면'})).toBeTruthy();
});
