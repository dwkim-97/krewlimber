// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {Auth} from '../src/pages/Auth';
import {SessionContext} from '../src/stores/session';
import type {User} from '../src/types';
const member: User = {
  level: 0,
  fullName: '홍길동',
  id: 'member',
  username: 'crew.member',
  nickname: '크루',
  bio: '',
  location: '',
  gym: '',
  grade: '입문',
  role: 'member',
  status: 'approved',
  createdAt: '',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function view(user: User | null) {
  render(
    <MemoryRouter initialEntries={[{pathname: '/login', state: {from: '/members'}}]}>
      <SessionContext.Provider value={{user, loading: false, error: '', refresh: async () => member}}>
        <Routes>
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/" element={<h1>베이스캠프</h1>} />
          <Route path="/me" element={<h1>내 정보</h1>} />
          <Route path="/members" element={<h1>멤버</h1>} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>
  );
}
it('opens basecamp after login even when an earlier protected route was saved', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({user: member})))
  );
  view(null);
  fireEvent.change(screen.getByLabelText('아이디'), {target: {value: 'crew.member'}});
  fireEvent.change(screen.getByLabelText('비밀번호'), {target: {value: '1234'}});
  fireEvent.click(screen.getByRole('button', {name: /^로그인$/}));
  expect(await screen.findByRole('heading', {name: '베이스캠프'})).toBeTruthy();
});
it('redirects an already approved member from login to basecamp', async () => {
  view(member);
  expect(await screen.findByRole('heading', {name: '베이스캠프'})).toBeTruthy();
});
it('keeps pending members on their membership status page', async () => {
  view({...member, status: 'pending'});
  expect(await screen.findByRole('heading', {name: '내 정보'})).toBeTruthy();
});

it('collects a required Korean name separately from nickname at signup', async () => {
  let submitted: Record<string, unknown> | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init: RequestInit) => {
      submitted = JSON.parse(String(init.body));
      return new Response(JSON.stringify({user: {...member, status: 'pending'}}));
    })
  );
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <SessionContext.Provider
        value={{user: null, loading: false, error: '', refresh: async () => ({...member, status: 'pending'})}}
      >
        <Routes>
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/me" element={<h1>가입 상태</h1>} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>
  );
  const name = screen.getByLabelText('한글 이름') as HTMLInputElement;
  expect(name.required).toBe(true);
  fireEvent.change(screen.getByRole('textbox', {name: /^아이디/}), {target: {value: 'signup.member'}});
  fireEvent.change(name, {target: {value: '김성수'}});
  fireEvent.change(screen.getByLabelText('닉네임'), {target: {value: '클라이머'}});
  fireEvent.change(screen.getByLabelText('비밀번호', {exact: true}), {target: {value: '1234'}});
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), {target: {value: '1234'}});
  fireEvent.click(screen.getByRole('button', {name: '가입 신청'}));
  expect(await screen.findByRole('heading', {name: '가입 상태'})).toBeTruthy();
  expect(submitted).toMatchObject({username: 'signup.member', fullName: '김성수', nickname: '클라이머'});
});
