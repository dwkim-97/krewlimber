// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {TitleList} from '../src/components/TitleList';
import {Achievements} from '../src/components/Achievements';
import {Members} from '../src/pages/Members';
import type {Member, TitleCategory} from '../src/types';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const title = {
  id: 'participation',
  name: '암장 지박령',
  description: '클라이밍 참여 횟수 1위',
  quarter: '2026-Q4',
  accent: 'lime' as const,
};
const category: TitleCategory = {
  ...title,
  metric: 'participation',
  unit: '회',
  standings: [{userId: 'a', nickname: '에이든', value: 64, rank: 1}],
};

it('opens title conditions independently from the ranking toggle and closes the dialog', () => {
  render(<TitleList categories={[category]} />);
  fireEvent.click(screen.getByRole('button', {name: '암장 지박령 정보'}));
  const dialog = screen.getByRole('dialog', {name: '암장 지박령'});
  expect(within(dialog).getByText(/클라이밍 참여 횟수 1위/)).toBeTruthy();
  expect(within(dialog).getByText(/동률/)).toBeTruthy();
  expect(screen.queryByRole('list', {name: '암장 지박령 순위'})).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', {name: '닫기'}));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('explains a member title quarter and featured achievement condition', async () => {
  const member: Member = {
    id: 'a',
    nickname: '에이든',
    grade: 'V6',
    bio: '',
    gym: '',
    location: '',
    createdAt: '2026-01-01',
    titles: [title],
    featuredAchievement: {id: 'red50', name: '적색경보 해제', description: '[더클라임] 빨강 문제 50개 완등'},
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({members: [member]})))
  );
  render(<Members />);
  fireEvent.click(await screen.findByRole('button', {name: '암장 지박령 정보'}));
  const titleDialog = screen.getByRole('dialog', {name: '암장 지박령'});
  expect(within(titleDialog).getByText(/2026년 4분기/)).toBeTruthy();
  expect(within(titleDialog).getByText(/클라이밍 참여 횟수 1위/)).toBeTruthy();
  fireEvent.click(within(titleDialog).getByRole('button', {name: '닫기'}));
  fireEvent.click(screen.getByRole('button', {name: '적색경보 해제 정보'}));
  expect(
    within(screen.getByRole('dialog', {name: '적색경보 해제'})).getByText('[더클라임] 빨강 문제 50개 완등')
  ).toBeTruthy();
  expect(document.querySelector('button button')).toBeNull();
});

it('opens achievement info without selecting it or changing the featured achievement', async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          featuredAchievementId: 'red50',
          achievements: [
            {
              id: 'red50',
              name: '적색경보 해제',
              description: '[더클라임] 빨강 문제 50개 완등',
              metric: 'red',
              target: 50,
              progress: 60,
              earned: true,
              featured: true,
            },
            {
              id: 'red100',
              name: '레드 카펫은 내 길',
              description: '[더클라임] 빨강 문제 100개 완등',
              metric: 'red',
              target: 100,
              progress: 60,
              earned: false,
              featured: false,
            },
          ],
        })
      )
  );
  vi.stubGlobal('fetch', fetch);
  render(<Achievements />);
  fireEvent.click(
    await within(await screen.findByRole('group', {name: '업적 목록'})).findByRole('button', {
      name: '레드 카펫은 내 길 정보',
    })
  );
  const dialog = screen.getByRole('dialog', {name: '레드 카펫은 내 길'});
  expect(within(dialog).getByText('[더클라임] 빨강 문제 100개 완등')).toBeTruthy();
  expect(screen.getByRole('button', {name: '대표 업적 해제'})).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.querySelector('button button')).toBeNull();
});
