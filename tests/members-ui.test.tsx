// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {Members} from '../src/pages/Members';
import type {Member} from '../src/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows members as vertical list items and preserves filtering and empty achievement states', async () => {
  const member: Member = {
    id: 'a',
    nickname: '크루 하나',
    grade: 'V4',
    bio: '함께 올라요',
    gym: '더클라임',
    location: '판교',
    createdAt: '',
    titles: [{id: 'hosted', name: '번개 공장장', description: '번개 개최 1위', quarter: '2026-Q4', accent: 'yellow'}],
    featuredAchievement: {id: 'first', name: '또 오셨네요', description: '번개 50회 참여'},
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            members: [
              member,
              {...member, id: 'b', nickname: '크루 둘', grade: 'V2', titles: [], featuredAchievement: null},
            ],
          })
        )
    )
  );
  render(<Members />);
  const list = await screen.findByRole('list', {name: '멤버 목록'});
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  expect(within(list).getByText('번개 공장장')).toBeTruthy();
  expect(within(list).getByText('또 오셨네요')).toBeTruthy();
  expect(within(list).getByText('선택한 대표 업적 없음')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('난이도 필터'), {target: {value: 'V4'}});
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(within(list).getByRole('heading', {name: '크루 하나'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('닉네임으로 회원 검색'), {target: {value: '없는 회원'}});
  expect(screen.getByText('검색 결과가 없어요')).toBeTruthy();
});
