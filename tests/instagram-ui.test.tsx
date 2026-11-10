// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {Me} from '../src/pages/Me';
import {Members} from '../src/pages/Members';
import {SessionContext} from '../src/stores/session';
import type {Member, User} from '../src/types';

const user: User = {
  id: 'insta',
  username: 'insta.user',
  fullName: '홍길동',
  nickname: '크루 하나',
  instagramUrl: 'https://www.instagram.com/climb.aiden/',
  bio: '',
  location: '판교',
  gym: '더클라임',
  grade: 'V3',
  level: 0,
  role: 'member',
  status: 'pending',
  createdAt: '',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('edits and saves an Instagram handle from the own profile form and opens the saved profile', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({user})));
  const refresh = vi.fn(async () => user);
  vi.stubGlobal('fetch', fetch);
  render(
    <SessionContext.Provider value={{user, loading: false, error: '', refresh}}>
      <MemoryRouter>
        <Me />
      </MemoryRouter>
    </SessionContext.Provider>
  );
  const input = screen.getByRole('textbox', {name: '인스타그램'}) as HTMLInputElement;
  expect(input.value).toBe(user.instagramUrl);
  const link = screen.getByRole('link', {name: '내 인스타그램 프로필 열기'});
  expect(link.getAttribute('href')).toBe(user.instagramUrl);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  fireEvent.change(input, {target: {value: '@next.climb'}});
  fireEvent.click(screen.getByRole('button', {name: '프로필 저장'}));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith(
    '/api/me',
    expect.objectContaining({method: 'PATCH', body: expect.stringContaining('"instagramUrl":"@next.climb"')})
  );
  expect(await screen.findByRole('status')).toHaveProperty(
    'textContent',
    expect.stringContaining('프로필을 저장했어요')
  );
});

it('adds a compact Instagram link only to members who saved a profile without losing member details', async () => {
  const member: Member = {...user, points: 120, titles: [], featuredAchievement: null};
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({members: [member, {...member, id: 'none', nickname: '크루 둘', instagramUrl: ''}]})
        )
    )
  );
  render(<Members />);
  const list = await screen.findByRole('list', {name: '회원 목록'});
  const cards = within(list).getAllByRole('listitem');
  const link = within(cards[0]).getByRole('link', {name: '크루 하나 인스타그램 프로필 열기'});
  expect(link.getAttribute('href')).toBe(user.instagramUrl);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(within(cards[0]).getByText('홍길동')).toBeTruthy();
  expect(within(cards[0]).getByText('120 P')).toBeTruthy();
  expect(within(cards[1]).queryByRole('link')).toBeNull();
  expect(cards[0].classList.contains('member-card')).toBe(true);
});
