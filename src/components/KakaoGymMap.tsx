import {useEffect, useRef, useState} from 'react';
import type {Gym} from '@/types/climbing';
import {loadKakao, kakaoFailureMessage, kakaoResourceFailure, type Maps} from '@/apis/kakao';
export function KakaoGymMap({
  gyms,
  selected,
  onSelect,
}: {
  gyms: Gym[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<InstanceType<Maps['Map']> | null>(null);
  const [sdk, setSdk] = useState<Maps | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const canvas = element.current;
    const tileError = (event: Event) => {
      if (!cancelled && event.target instanceof HTMLImageElement) setError(kakaoResourceFailure(event.target.src));
    };
    canvas?.addEventListener('error', tileError, true);
    loadKakao()
      .then(maps => {
        if (cancelled || !element.current) return;
        try {
          const instance = new maps.Map(element.current, {center: new maps.LatLng(37.5, 127.03), level: 7});
          map.current = instance;
          setSdk(maps);
          timer = window.setTimeout(() => {
            if (!cancelled) setError(kakaoFailureMessage());
          }, 15000);
          maps.event.addListener(instance, 'tilesloaded', () => {
            if (!cancelled) {
              window.clearTimeout(timer);
              setReady(true);
              setError('');
            }
          });
        } catch {
          setError(kakaoFailureMessage());
        }
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      map.current = null;
      canvas?.removeEventListener('error', tileError, true);
    };
  }, []);
  useEffect(() => {
    if (!sdk || !map.current) return;
    const markers: {setMap(m: null): void}[] = [];
    const bounds = new sdk.LatLngBounds();
    let count = 0;
    for (const gym of gyms) {
      if (gym.latitude === null || gym.longitude === null) continue;
      const pos = new sdk.LatLng(gym.latitude, gym.longitude);
      bounds.extend(pos);
      count++;
      const marker = new sdk.Marker({map: map.current, position: pos, title: gym.name});
      markers.push(marker);
      if (sdk.CustomOverlay) {
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'gym-map-label';
        label.textContent = gym.name;
        label.setAttribute('aria-label', `${gym.name} 상세 보기`);
        label.onclick = () => onSelect(gym.id);
        markers.push(new sdk.CustomOverlay({map: map.current, position: pos, content: label, yAnchor: 1.9}));
      }
      sdk.event.addListener(marker, 'click', () => onSelect(gym.id));
    }
    if (count) map.current.setBounds(bounds);
    return () => markers.forEach(m => m.setMap(null));
  }, [sdk, gyms, onSelect]);
  useEffect(() => {
    const gym = gyms.find(g => g.id === selected);
    if (sdk && map.current && gym?.latitude != null && gym.longitude != null)
      map.current.setCenter(new sdk.LatLng(gym.latitude, gym.longitude));
  }, [selected, sdk, gyms]);
  return (
    <div className="gym-map" role="region" aria-label="등록된 암장 지도">
      <div className="gym-map-canvas" ref={element} />
      {ready && !error && gyms.some(g => g.latitude !== null && g.longitude !== null) && (
        <button
          type="button"
          className="map-fit-button"
          onClick={() => {
            if (!sdk || !map.current) return;
            const bounds = new sdk.LatLngBounds();
            for (const gym of gyms)
              if (gym.latitude !== null && gym.longitude !== null)
                bounds.extend(new sdk.LatLng(gym.latitude, gym.longitude));
            map.current.setBounds(bounds);
          }}
        >
          전체 암장 보기
        </button>
      )}
      {ready && !error && gyms.some(g => g.latitude === null || g.longitude === null) && (
        <div className="map-location-hint" role="status">
          {gyms.filter(g => g.latitude !== null && g.longitude !== null).length === 0
            ? '아직 지도 위치가 연결된 암장이 없어요.'
            : '일부 암장의 위치가 비어 있어요.'}{' '}
          목록에서 암장을 선택해 ‘지도 위치 연결’을 눌러주세요.
        </div>
      )}
      {(error || !ready) && (
        <div className="map-message map-overlay" role={error ? 'status' : undefined}>
          <strong>암장 지도</strong>
          <p>{error || '지도를 불러오는 중…'}</p>
          {error && (
            <a href="https://map.kakao.com/?q=클라이밍" target="_blank" rel="noopener noreferrer">
              카카오맵에서 암장 찾기 ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
