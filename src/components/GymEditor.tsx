import {useState, type FormEvent} from 'react';
import {ArrowDown, ArrowUp, Check, MapPin, Plus, Save, Trash2, X} from 'lucide-react';
import {api} from '@/apis/client';
import {loadKakao, searchKakaoPlaces, type Place} from '@/apis/kakao';
import {gymIdentity, gymDisplayName} from '@/consts/gym-identity';
import type {Gym} from '@/types/climbing';
interface Grade {
  key: string;
  id?: string;
  name: string;
  color: string;
}
export function GymEditor({gym, onSaved, onCancel}: {gym: Gym; onSaved: () => void; onCancel: () => void}) {
  const identity = gymIdentity(gym);
  const [brandName, setBrandName] = useState(identity.brandName),
    [branchName, setBranchName] = useState(identity.branchName),
    [grades, setGrades] = useState<Grade[]>(() => gym.grades.map(g => ({...g, key: g.id}))),
    [location, setLocation] = useState<Place | null>(null),
    [searching, setSearching] = useState(false),
    [query, setQuery] = useState(gym.name),
    [places, setPlaces] = useState<Place[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  function move(index: number, direction: number) {
    setGrades(rows => {
      const next = [...rows],
        to = index + direction;
      if (to < 0 || to >= rows.length) return rows;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const maps = await loadKakao();
      setPlaces(await searchKakaoPlaces(maps, query));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/gyms/${gym.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          revision: gym.revision,
          name: gymDisplayName(brandName, branchName),
          brandName,
          branchName,
          grades: grades.map(({id, name, color}) => ({id, name, color})),
          ...(location
            ? {
                location: {
                  placeId: location.id,
                  address: location.road_address_name || location.address_name,
                  latitude: Number(location.y),
                  longitude: Number(location.x),
                },
              }
            : {}),
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
    <section className="gym-editor" aria-label="암장 정보 수정">
      <header>
        <h3>암장 정보 수정</h3>
        <button className="icon-button" type="button" disabled={busy} aria-label="수정 취소" onClick={onCancel}>
          <X size={17} />
        </button>
      </header>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            암장명
            <input required maxLength={100} value={brandName} onChange={e => setBrandName(e.target.value)} />
          </label>
          <label>
            지점 (선택)
            <input maxLength={100} value={branchName} onChange={e => setBranchName(e.target.value)} />
          </label>
          <div className="edit-location">
            <MapPin size={16} />
            <span>{location ? location.road_address_name || location.address_name : gym.address || '위치 미등록'}</span>
            <button type="button" className="text-button" onClick={() => setSearching(!searching)}>
              위치 변경
            </button>
          </div>
          <p className="climbing-help">주소와 좌표는 아래 장소 검색에서 함께 변경합니다.</p>
          <div className="registration-grade-title">
            <h3>난이도 순서</h3>
            <span>1번이 가장 낮아요 ↑</span>
          </div>
          <p className="climbing-help">화살표로 순서를 바꾸세요. 기존 기록에 사용된 난이도는 삭제할 수 없습니다.</p>
          <ol className="gym-edit-grades">
            {grades.map((g, i) => (
              <li key={g.key}>
                <span className="grade-order">{i + 1}</span>
                <input
                  type="color"
                  aria-label={`${i + 1}번 색상`}
                  value={g.color}
                  onChange={e =>
                    setGrades(rows => rows.map(r => (r.key === g.key ? {...r, color: e.target.value} : r)))
                  }
                />
                <input
                  aria-label={`${i + 1}번 난이도 이름`}
                  required
                  maxLength={30}
                  value={g.name}
                  onChange={e => setGrades(rows => rows.map(r => (r.key === g.key ? {...r, name: e.target.value} : r)))}
                />
                <div className="grade-row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${i + 1}번 위로`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${i + 1}번 아래로`}
                    disabled={i === grades.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${i + 1}번 삭제`}
                    onClick={() => setGrades(rows => rows.filter(r => r.key !== g.key))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="text-button"
            disabled={grades.length >= 40}
            onClick={() => setGrades(rows => [...rows, {key: crypto.randomUUID(), name: '', color: '#888888'}])}
          >
            <Plus size={14} />
            난이도 추가
          </button>
          <div className="gym-editor-footer">
            <button type="button" className="button button-outline button-small" onClick={onCancel}>
              취소
            </button>
            <button className="button button-dark button-small" aria-busy={busy}>
              <Save size={14} />
              {busy ? '저장 중…' : '수정 저장'}
            </button>
          </div>
        </fieldset>
      </form>
      {searching && (
        <div className="gym-edit-location-search">
          <form className="place-search" onSubmit={search}>
            <label>
              새 위치 검색
              <input value={query} required onChange={e => setQuery(e.target.value)} />
            </label>
            <button className="button button-outline button-small" disabled={busy}>
              검색
            </button>
          </form>
          <div className="place-results">
            {places.map(p => (
              <button
                key={p.id}
                className="place-result"
                disabled={busy}
                onClick={() => {
                  setLocation(p);
                  setSearching(false);
                }}
              >
                <strong>{p.place_name}</strong>
                <span>{p.road_address_name || p.address_name}</span>
                <b>
                  <Check size={12} /> 이 위치 선택
                </b>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
