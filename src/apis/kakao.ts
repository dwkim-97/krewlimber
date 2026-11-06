type Point = object;
export interface Place {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
}
export interface Maps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => Point;
  Map: new (
    element: HTMLElement,
    options: {center: Point; level: number}
  ) => {setCenter(p: Point): void; setBounds(b: object): void};
  Marker: new (options: {map: object; position: Point; title: string}) => {setMap(m: null): void};
  CustomOverlay?: new (options: {map: object; position: Point; content: HTMLElement; yAnchor: number}) => {
    setMap(m: null): void;
  };
  LatLngBounds: new () => {extend(p: Point): void};
  event: {addListener(target: object, name: string, callback: () => void): void};
  services: {
    Places: new () => {keywordSearch(q: string, callback: (data: Place[], status: string) => void): void};
    Status: {OK: string};
  };
}
declare global {
  interface Window {
    kakao?: {maps: Maps};
  }
}
export function kakaoFailureMessage(status?: number) {
  return status === 429
    ? '오늘의 지도 서비스 이용 한도에 도달했어요. 한도가 초기화된 뒤 다시 이용해주세요. 암장 목록과 기록은 계속 사용할 수 있어요.'
    : '지도 서비스의 이용 한도 초과 또는 일시적인 연결 오류로 지도를 사용할 수 없어요. 잠시 후 다시 이용해주세요. 암장 목록과 기록은 계속 사용할 수 있어요.';
}
export function kakaoResourceFailure(url: string) {
  const entry = performance.getEntriesByName(url).at(-1) as
    (PerformanceResourceTiming & {responseStatus?: number}) | undefined;
  return kakaoFailureMessage(entry?.responseStatus);
}
export function searchKakaoPlaces(maps: Maps, query: string): Promise<Place[]> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(kakaoFailureMessage())), 10000);
    new maps.services.Places().keywordSearch(query, (data, status) => {
      window.clearTimeout(timer);
      if (status === maps.services.Status.OK) resolve(data);
      else if (status === 'ZERO_RESULT') resolve([]);
      else reject(new Error(kakaoFailureMessage()));
    });
  });
}
let loading: Promise<Maps> | undefined;
let failedAt = 0;
export function loadKakao(): Promise<Maps> {
  if (loading && (!failedAt || Date.now() - failedAt < 60000)) return loading;
  failedAt = 0;
  const key = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;
  if (!key)
    return Promise.reject(new Error('지도를 준비 중이에요. 아래 목록에서 암장을 선택하거나 카카오맵에서 찾아보세요.'));
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    const timer = window.setTimeout(() => {
      script.remove();
      failedAt = Date.now();
      reject(new Error(kakaoFailureMessage()));
    }, 12000);
    script.onload = () => {
      if (window.kakao)
        window.kakao.maps.load(() => {
          window.clearTimeout(timer);
          resolve(window.kakao!.maps);
        });
      else {
        failedAt = Date.now();
        reject(new Error(kakaoFailureMessage()));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      failedAt = Date.now();
      reject(new Error(kakaoResourceFailure(script.src)));
    };
    document.head.append(script);
  });
  return loading;
}
