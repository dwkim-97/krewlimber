// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {GymRegistration} from '../src/components/GymRegistration';
import {KakaoGymMap} from '../src/components/KakaoGymMap';
import {loadKakao, searchKakaoPlaces} from '../src/apis/kakao';
vi.mock('../src/apis/kakao', () => ({
  loadKakao: vi.fn(),
  searchKakaoPlaces: vi.fn(),
  kakaoFailureMessage: () => '지도 서비스 오류',
  kakaoResourceFailure: () => '지도 서비스 오류',
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('opens an existing registered place without an existing-gym dropdown', async () => {
  vi.mocked(loadKakao).mockResolvedValue({} as never);
  vi.mocked(searchKakaoPlaces).mockResolvedValue([
    {id: '123', place_name: '암장', address_name: '서울', road_address_name: '서울', x: '127', y: '37'},
  ]);
  const saved = vi.fn();
  render(
    <GymRegistration
      gyms={[{id: 'old', name: '암장', address: '서울', latitude: 37, longitude: 127, placeId: '123', grades: []}]}
      onSaved={saved}
    />
  );
  fireEvent.change(screen.getByLabelText('카카오 장소 검색'), {target: {value: '암장'}});
  fireEvent.click(screen.getByRole('button', {name: '장소 검색'}));
  fireEvent.click(await screen.findByRole('button', {name: /등록됨 · 보기/}));
  expect(saved).toHaveBeenCalledWith('old');
  expect(screen.queryByText('위치를 연결할 기존 암장 (선택)')).toBeNull();
});
it('loads a brand palette in ascending order and copies an existing branch without grade IDs', async () => {
  vi.mocked(loadKakao).mockResolvedValue({} as never);
  vi.mocked(searchKakaoPlaces).mockResolvedValue([
    {id: '222', place_name: '더클라임 새지점', address_name: '서울', road_address_name: '서울', x: '127', y: '37'},
  ]);
  const saved = vi.fn();
  const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({gym: {id: 'new'}})));
  vi.stubGlobal('fetch', fetcher);
  render(
    <GymRegistration
      gyms={[
        {
          id: 'source',
          name: '더클라임 기존점',
          address: '서울',
          latitude: 37,
          longitude: 127,
          placeId: '111',
          grades: [{id: 'old-grade', gymId: 'source', name: '검정', color: '#303238'}],
        },
      ]}
      onSaved={saved}
    />
  );
  fireEvent.change(screen.getByLabelText('카카오 장소 검색'), {target: {value: '더클라임 새지점'}});
  fireEvent.click(screen.getByRole('button', {name: '장소 검색'}));
  fireEvent.click(await screen.findByRole('button', {name: /선택 →/}));
  expect(screen.getByLabelText('난이도 미리보기').textContent).toBe('파랑빨강핑크보라회색갈색검정');
  fireEvent.change(screen.getByLabelText('등록된 난이도 불러오기'), {target: {value: 'source'}});
  fireEvent.click(screen.getByRole('button', {name: /이 암장 등록하기/}));
  await waitFor(() => expect(saved).toHaveBeenCalledWith('new'));
  const init = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
  expect(JSON.parse(String(init?.body))).toMatchObject({brandName: '더클라임', branchName: '새지점'});
  expect(JSON.parse(String(init?.body)).grades).toEqual([{name: '검정', color: '#303238'}]);
  vi.unstubAllGlobals();
});
it('keeps a loaded map available when a small pan needs no additional tiles', async () => {
  const callbacks: Record<string, () => void> = {};
  const maps = {
    Map: class {
      setBounds() {}
      setCenter() {}
    },
    LatLng: class {},
    LatLngBounds: class {
      extend() {}
    },
    Marker: class {
      setMap() {}
    },
    event: {
      addListener(_target: object, name: string, callback: () => void) {
        callbacks[name] = callback;
      },
    },
  };
  vi.mocked(loadKakao).mockResolvedValue(maps as never);
  render(<KakaoGymMap gyms={[]} selected="" onSelect={() => {}} />);
  await waitFor(() => expect(callbacks.tilesloaded).toBeTruthy());
  act(() => callbacks.tilesloaded());
  vi.useFakeTimers();
  act(() => {
    callbacks.bounds_changed?.();
    vi.advanceTimersByTime(16000);
  });
  expect(screen.queryByText('지도 서비스 오류')).toBeNull();
});
