// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {ClimbingRecords} from '../src/pages/ClimbingRecords';
import {ClimbingSummaryView} from '../src/components/ClimbingSummary';

const gym = {
  aliases: [],
  id: 'one',
  name: '더클라임 양재점',
  address: '서울 서초구 강남대로',
  region: '서울',
  franchiseId: 'theclimb',
  franchiseName: '더클라임',
  url: 'https://place.map.kakao.com/1',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('searches the gym dialog and submits preset and custom color counts', async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  let sent: unknown = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) => {
      if (path === '/api/gyms')
        return new Response(
          JSON.stringify({
            gyms: [gym, {...gym, id: 'two', name: '서울숲클라이밍 분당점', region: '경기', address: '경기 성남시'}],
            verifiedAt: '2026-11-06',
            exhaustive: false,
            coverageNote: '누락이 있을 수 있습니다.',
          })
        );
      if (init.method === 'POST') {
        sent = JSON.parse(String(init.body));
        return new Response(JSON.stringify({record: {id: 'saved'}}), {status: 201});
      }
      return new Response(JSON.stringify({records: []}));
    })
  );
  render(
    <MemoryRouter>
      <ClimbingRecords />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole('button', {name: '암장 선택'}));
  const dialog = screen.getByRole('dialog', {name: '암장 선택'});
  fireEvent.change(within(dialog).getByLabelText('암장 검색'), {target: {value: '양재'}});
  expect(within(dialog).queryByText('서울숲클라이밍 분당점')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', {name: /더클라임 양재점/}));
  fireEvent.change(screen.getByLabelText('빨강 완등 수'), {target: {value: '3'}});
  fireEvent.click(screen.getByText('커스텀 색상'));
  fireEvent.change(screen.getByLabelText('커스텀 색상 이름'), {target: {value: '우주색'}});
  fireEvent.change(screen.getByLabelText('커스텀 색상 선택'), {target: {value: '#123abc'}});
  fireEvent.click(screen.getByRole('button', {name: '색상 추가'}));
  fireEvent.change(screen.getByLabelText('우주색 완등 수'), {target: {value: '2'}});
  fireEvent.click(screen.getByRole('button', {name: '기록 저장'}));
  await screen.findByText('기록을 저장했어요.');
  expect(sent).toMatchObject({
    gymId: 'one',
    colors: expect.arrayContaining([
      expect.objectContaining({key: 'red', count: 3}),
      expect.objectContaining({name: '우주색', hex: '#123abc', count: 2}),
    ]),
  });
});
it('groups colored totals by franchise and reveals individual branches', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            visits: 2,
            totalSends: 5,
            groups: [
              {
                franchiseId: 'theclimb',
                franchiseName: '더클라임',
                visits: 2,
                totalSends: 5,
                colors: [{key: 'red', name: '빨강', hex: '#ef4444', count: 5}],
                branches: [
                  {gym, visits: 2, totalSends: 5, colors: [{key: 'red', name: '빨강', hex: '#ef4444', count: 5}]},
                ],
              },
            ],
          })
        )
    )
  );
  render(
    <MemoryRouter>
      <ClimbingSummaryView />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByText('더클라임'));
  expect(await screen.findByText('더클라임 양재점')).toBeTruthy();
  expect(screen.getAllByRole('img', {name: '빨강 5개'})).toHaveLength(2);
});

it('keeps the active draft protected while a save response is pending', async () => {
  window.scrollTo = vi.fn();
  const records = ['a', 'b'].map((id, index) => ({
    id,
    date: `2026-10-0${index + 1}`,
    gymId: gym.id,
    gym,
    colors: [{key: 'red', name: '빨강', hex: '#ef4444', count: index + 3}],
    createdAt: 'created',
    updatedAt: 'updated',
  }));
  let finish: (() => void) | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) => {
      if (init.method === 'PUT')
        return new Promise<Response>(resolve => {
          finish = () => resolve(new Response(JSON.stringify({record: records[0]})));
        });
      return new Response(
        JSON.stringify(
          path === '/api/gyms'
            ? {gyms: [gym], verifiedAt: '2026-11-06', exhaustive: false, coverageNote: ''}
            : {records}
        )
      );
    })
  );
  render(
    <MemoryRouter>
      <ClimbingRecords />
    </MemoryRouter>
  );
  const edits = await screen.findAllByRole('button', {name: '수정'});
  fireEvent.click(edits[0]);
  fireEvent.change(screen.getByLabelText('빨강 완등 수'), {target: {value: '7'}});
  fireEvent.click(screen.getByRole('button', {name: '수정 저장'}));
  expect((edits[1] as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', {name: '취소'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(edits[1]);
  expect((screen.getByLabelText('빨강 완등 수') as HTMLInputElement).value).toBe('7');
  finish!();
  await screen.findByText('기록을 수정했어요.');
});
