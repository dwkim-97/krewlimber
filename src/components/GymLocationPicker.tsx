import {useState, type FormEvent} from 'react';
import {api} from '@/apis/client';
import {loadKakao, searchKakaoPlaces, type Place} from '@/apis/kakao';
import type {Gym} from '@/types/climbing';
export function GymLocationPicker({gym, onSaved}: {gym: Gym; onSaved: () => void}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(gym.name),
    [places, setPlaces] = useState<Place[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function search(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const maps = await loadKakao(),
        results = await searchKakaoPlaces(maps, query);
      setPlaces(results);
      if (!results.length) setError('검색 결과가 없어요. 암장 이름과 지점을 확인해주세요.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect(place: Place) {
    setBusy(true);
    setError('');
    try {
      await api(`/gyms/${gym.id}/location`, {
        method: 'PATCH',
        body: JSON.stringify({
          address: place.road_address_name || place.address_name,
          latitude: Number(place.y),
          longitude: Number(place.x),
          placeId: place.id,
        }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="gym-location-picker">
      <p>지도 위치가 아직 연결되지 않았어요.</p>
      <button className="button button-outline button-small" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '위치 연결 닫기' : '지도 위치 연결'}
      </button>
      {open && (
        <>
          <form className="place-search" onSubmit={search}>
            <label>
              암장 위치 검색
              <input required maxLength={100} value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <button className="button button-dark button-small" disabled={busy || !query.trim()} aria-busy={busy}>
              검색
            </button>
          </form>
          <p className="climbing-help">지점과 주소를 확인한 뒤 연결해주세요. 기존 난이도와 기록은 그대로 연결됩니다.</p>
          <div className="place-results">
            {places.map(p => (
              <button className="place-result" key={p.id} onClick={() => connect(p)} disabled={busy}>
                <strong>{p.place_name}</strong>
                <span>{p.road_address_name || p.address_name}</span>
                <b>이 위치 연결 →</b>
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
