import {useState, type FormEvent} from 'react';
import {Check, Layers, MapPin, Mountain, Plus, Search, X} from 'lucide-react';
import {api} from '@/apis/client';
import {loadKakao, searchKakaoPlaces, type Place} from '@/apis/kakao';
import {GYM_BRANDS, gymBrand, copyGrades, type GradeTemplate} from '@/consts/gym-brands';
import {gymIdentity, gymDisplayName} from '@/consts/gym-identity';
import type {Gym} from '@/types/climbing';
export function GymRegistration({
  gyms,
  onSaved,
  onCancel,
}: {
  gyms: Gym[];
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const [brandName, setBrandName] = useState(''),
    [branchName, setBranchName] = useState('');
  const names = [...new Set(gyms.map(g => gymIdentity(g).brandName))];
  const [query, setQuery] = useState(''),
    [places, setPlaces] = useState<Place[]>([]),
    [place, setPlace] = useState<Place | null>(null),
    [grades, setGrades] = useState<GradeTemplate[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [source, setSource] = useState('');
  const brand = place ? gymBrand(place.place_name) : undefined;
  const searchBrand = gymBrand(query);
  async function searchPlaces(value: string) {
    setPlace(null);
    setGrades([]);
    setSource('');
    setBusy(true);
    setError('');
    try {
      const maps = await loadKakao(),
        rows = await searchKakaoPlaces(maps, value);
      setPlaces(rows);
      if (!rows.length) setError('검색 결과가 없어요. 암장 이름과 지역을 함께 입력해보세요.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function choose(p: Place) {
    const found = gyms.find(
      g => g.placeId === p.id || (g.name === p.place_name && g.address === (p.road_address_name || p.address_name))
    );
    if (found) {
      onSaved(found.id);
      return;
    }
    const b = gymBrand(p.place_name);
    setPlace(p);
    const identity = gymIdentity({name: p.place_name});
    setBrandName(identity.brandName);
    setBranchName(identity.branchName);
    setGrades(b ? copyGrades(b.grades) : []);
    setSource(b ? `brand:${b.id}` : '');
    setError('');
  }
  function loadSource(value: string) {
    setSource(value);
    if (value.startsWith('brand:')) {
      const b = GYM_BRANDS.find(b => `brand:${b.id}` === value);
      if (b) setGrades(copyGrades(b.grades));
    } else {
      const g = gyms.find(g => g.id === value);
      if (g) setGrades(copyGrades(g.grades));
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!place) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{gym: Gym}>('/gyms', {
        method: 'POST',
        body: JSON.stringify({
          name: gymDisplayName(brandName, branchName),
          brandName: brandName.trim(),
          branchName: branchName.trim(),
          address: place.road_address_name || place.address_name,
          placeId: place.id,
          latitude: Number(place.y),
          longitude: Number(place.x),
          grades,
        }),
      });
      onSaved(r.gym.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gym-registration climbing-panel" aria-label="암장 등록">
      <header className="registration-intro">
        <span className="registration-icon">
          <Mountain size={25} aria-hidden="true" />
        </span>
        <div>
          <span className="registration-kicker">OUR CLIMBING SPOTS</span>
          <h2>다음에 함께 오를 곳</h2>
          <p>장소를 고르고 난이도를 확인하면, 모든 회원의 지도에 표시돼요.</p>
        </div>
        {onCancel && (
          <button className="icon-button registration-close" type="button" aria-label="등록 닫기" onClick={onCancel}>
            <X size={18} />
          </button>
        )}
      </header>
      <ol className="registration-steps" aria-label="등록 순서">
        <li className={!place ? 'active' : 'done'}>
          <span>{place ? <Check size={12} /> : 1}</span>장소 검색
        </li>
        <li className={place ? 'active' : ''}>
          <span>2</span>난이도 확인
        </li>
        <li>
          <span>3</span>공용 지도 등록
        </li>
      </ol>
      <div className="brand-quick-search" aria-label="브랜드 빠른 검색">
        {GYM_BRANDS.map(b => (
          <button
            key={b.id}
            type="button"
            disabled={busy}
            onClick={() => {
              setQuery(b.name);
              void searchPlaces(b.name);
            }}
          >
            <i style={{background: b.accent}} />
            {b.name}
          </button>
        ))}
      </div>
      {!place && searchBrand && (
        <div className="registration-brand-preview">
          <div>
            <Layers size={15} />
            <strong>{searchBrand.name} 기본 체계</strong>
            <span>낮음 → 높음</span>
          </div>
          <div className="grade-palette">
            {searchBrand.grades.map(g => (
              <span key={g.name}>
                <i style={{background: g.color}} />
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <form
        className="place-search"
        onSubmit={e => {
          e.preventDefault();
          void searchPlaces(query);
        }}
      >
        <label>
          카카오 장소 검색
          <div className="registration-search-input">
            <Search size={17} aria-hidden="true" />
            <input
              required
              value={query}
              maxLength={100}
              placeholder="암장 이름 또는 지역을 입력하세요"
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </label>
        <button className="button button-dark" disabled={busy || !query.trim()} aria-busy={busy}>
          {busy ? '처리 중…' : '장소 검색'}
        </button>
      </form>
      <div className="place-results registration-results">
        {places.map(p => {
          const registered = gyms.find(
            g =>
              g.placeId === p.id || (g.name === p.place_name && g.address === (p.road_address_name || p.address_name))
          );
          return (
            <button
              className={`place-result ${p.id === place?.id ? 'place-selected' : ''}`}
              type="button"
              key={p.id}
              disabled={busy}
              onClick={() => choose(p)}
            >
              <MapPin size={18} aria-hidden="true" />
              <span>
                <strong>{p.place_name}</strong>
                <small>{p.road_address_name || p.address_name}</small>
              </span>
              <b>{registered ? '등록됨 · 보기' : p.id === place?.id ? '선택됨 ✓' : '선택 →'}</b>
            </button>
          );
        })}
      </div>
      {place && (
        <form className="registration-confirm" onSubmit={save}>
          <div className="selected-place-summary">
            <MapPin size={20} aria-hidden="true" />
            <div>
              <h3>{place.place_name}</h3>
              <p>{place.road_address_name || place.address_name}</p>
            </div>
            <Check size={18} aria-label="위치 확인됨" />
          </div>
          <div className="gym-identity-fields">
            <label>
              암장명
              <input
                required
                maxLength={100}
                list="registered-gym-names"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="예: 더클라임"
              />
            </label>
            <datalist id="registered-gym-names">
              {names.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <label>
              지점 (선택)
              <input
                maxLength={100}
                value={branchName}
                onChange={e => setBranchName(e.target.value)}
                placeholder="예: 강남점 · 단일 암장은 비워두세요"
              />
            </label>
          </div>
          <p className="climbing-help">
            기존 암장명을 선택하거나 새 이름을 입력하세요. 새 암장은 등록 후 암장 카드가 자동으로 생겨요.
          </p>
          <div className="registration-grade-title">
            <Layers size={18} />
            <h3>난이도 체계</h3>
            <span>낮음 → 높음</span>
          </div>
          <label>
            등록된 난이도 불러오기
            <select value={source} onChange={e => loadSource(e.target.value)}>
              <option value="">직접 구성</option>
              <optgroup label="브랜드 공통 체계">
                {GYM_BRANDS.map(b => (
                  <option value={`brand:${b.id}`} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={brand ? `${brand.name} 등록 지점` : '기존 등록 지점'}>
                {gyms
                  .filter(g => g.grades.length && (!brand || gymBrand(g.name)?.id === brand.id))
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <p className="climbing-help">
            {source
              ? '선택한 체계를 불러왔어요. 현장과 다르면 수정해주세요.'
              : '브랜드나 기존 지점의 체계를 불러오거나 직접 구성해주세요.'}{' '}
            아래쪽으로 갈수록 높은 난이도예요.
          </p>
          <div className="grade-palette" aria-label="난이도 미리보기">
            {grades.map((g, i) => (
              <span key={i}>
                <i style={{background: g.color}} />
                {g.name}
              </span>
            ))}
          </div>
          <details className="registration-edit-grades">
            <summary>색상·이름 편집</summary>
            {grades.map((g, i) => (
              <div className="registration-grade" key={i}>
                <span className="grade-order">{i + 1}</span>
                <input
                  aria-label={`난이도 ${i + 1} 색상`}
                  type="color"
                  value={g.color}
                  onChange={e => setGrades(rows => rows.map((r, j) => (j === i ? {...r, color: e.target.value} : r)))}
                />
                <input
                  aria-label={`난이도 ${i + 1} 이름`}
                  required
                  maxLength={30}
                  value={g.name}
                  placeholder="색상 또는 등급"
                  onChange={e => setGrades(rows => rows.map((r, j) => (j === i ? {...r, name: e.target.value} : r)))}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`난이도 ${i + 1} 삭제`}
                  onClick={() => setGrades(rows => rows.filter((_, j) => j !== i))}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              disabled={grades.length >= 40 || busy}
              onClick={() => {
                setGrades(g => [...g, {name: '', color: '#888888'}]);
                setSource('');
              }}
            >
              <Plus size={14} /> 난이도 추가
            </button>
          </details>
          {!grades.length && (
            <p className="climbing-help">위에서 체계를 고르거나 색상·이름 편집에서 난이도를 추가해주세요.</p>
          )}
          <footer className="registration-submit">
            <span>
              <MapPin size={14} />
              위치 포함 · {grades.length}개 난이도
            </span>
            <button className="button button-dark" aria-busy={busy} disabled={busy}>
              {busy ? '등록 중…' : '이 암장 등록하기'}
              <Plus size={16} />
            </button>
          </footer>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
