// @vitest-environment jsdom
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useResource} from '../src/hooks/useResource';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('marks a newly selected quarter as loading instead of editing the previous quarters records', async () => {
  let finish: (response: Response) => void = () => {
    throw new Error('No pending request');
  };
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({quarter: '2026-Q3'})))
      .mockImplementationOnce(
        () =>
          new Promise<Response>(resolve => {
            finish = resolve;
          })
      )
  );
  const {result, rerender} = renderHook(({path}) => useResource<{quarter: string}>(path), {
    initialProps: {path: '/titles?quarter=2026-Q3'},
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  rerender({path: '/titles?quarter=2026-Q4'});
  expect(result.current.loading).toBe(true);
  await act(async () => {
    finish(new Response(JSON.stringify({quarter: '2026-Q4'})));
  });
  expect(result.current.data?.quarter).toBe('2026-Q4');
});
