// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest';
import {kakaoFailureMessage, searchKakaoPlaces} from '../src/apis/kakao';
afterEach(() => {
  vi.restoreAllMocks();
});
it('distinguishes confirmed quota exhaustion from opaque SDK failures', () => {
  expect(kakaoFailureMessage(429)).toContain('이용 한도');
  expect(kakaoFailureMessage()).toContain('이용 한도 초과 또는');
});
it('does not present API failures as empty place search results', async () => {
  const maps = {
    services: {
      Status: {OK: 'OK'},
      Places: class {
        keywordSearch(_q: string, cb: (data: unknown[], status: string) => void) {
          cb([], 'ERROR');
        }
      },
    },
  };
  await expect(searchKakaoPlaces(maps as never, '강남')).rejects.toThrow('이용 한도');
});
