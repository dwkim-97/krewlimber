// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {GymEditor} from '../src/components/GymEditor';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('preserves grade IDs when reordering and keeps edits after a failed save', async () => {
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({error: '저장 실패'}), {status: 503})
  );
  vi.stubGlobal('fetch', fetcher);
  render(
    <GymEditor
      gym={{
        id: 'gym',
        name: '암장',
        address: '서울',
        placeId: '123',
        latitude: 37,
        longitude: 127,
        revision: 'a'.repeat(64),
        grades: [
          {id: 'first', gymId: 'gym', name: '검정', color: '#303238'},
          {id: 'second', gymId: 'gym', name: '갈색', color: '#885533'},
        ],
      }}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', {name: '1번 아래로'}));
  expect((screen.getByLabelText('1번 난이도 이름') as HTMLInputElement).value).toBe('갈색');
  fireEvent.change(screen.getByLabelText('암장명'), {target: {value: '바꾼 이름'}});
  fireEvent.click(screen.getByRole('button', {name: '수정 저장'}));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('암장명') as HTMLInputElement).value).toBe('바꾼 이름');
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body.grades.map((g: {id: string}) => g.id)).toEqual(['second', 'first']);
  expect(body.revision).toBe('a'.repeat(64));
});
