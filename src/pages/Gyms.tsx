import {MapPin, Plus, Pencil, Mountain} from 'lucide-react';
import {useCallback, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useResource} from '@/hooks/useResource';
import {ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {KakaoGymMap} from '@/components/KakaoGymMap';
import {gymBrand} from '@/consts/gym-brands';
import {gymIdentity} from '@/consts/gym-identity';
import {GymEditor} from '@/components/GymEditor';
import {GymRegistration} from '@/components/GymRegistration';
import {GymLocationPicker} from '@/components/GymLocationPicker';
import {GymComments} from '@/components/GymComments';
import type {Gym} from '@/types/climbing';
import '@/styles/climbing.css';
const EMPTY_GYMS: Gym[] = [];
export function Gyms() {
  const resource = useResource<{gyms: Gym[]}>('/gyms');
  const [params, setParams] = useSearchParams();
  const selected = params.get('gym') ?? '';
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const select = useCallback((id: string) => setParams({gym: id}), [setParams]);
  const gyms = resource.data?.gyms ?? EMPTY_GYMS;
  const brandGyms = useMemo(
    () => (brandFilter === 'all' ? gyms : gyms.filter(g => gymIdentity(g).brandName === brandFilter)),
    [gyms, brandFilter]
  );
  const chosen = brandGyms.find(g => g.id === selected);
  const filtered = brandGyms.filter(g => (g.name + ' ' + g.address).toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="page-shell climbing-page">
      <PageHeading title="암장지도" />
      <p className="climbing-lead">
        우리 크루가 함께 만드는 암장지도. 누구나 장소와 난이도를 등록하고, 최신 소식을 나눌 수 있어요.
      </p>
      {!adding && (
        <div className="gym-registration-callout">
          <span>
            <MapPin size={21} />
          </span>
          <div>
            <strong>우리 크루의 다음 암장을 추가해보세요</strong>
            <p>장소 검색으로 위치를 등록하고, 브랜드별 난이도를 바로 불러올 수 있어요.</p>
          </div>
          <button className="button button-outline button-small" onClick={() => setAdding(true)}>
            새 암장 등록 <Plus size={14} />
          </button>
        </div>
      )}
      {adding && (
        <GymRegistration
          gyms={gyms}
          onCancel={() => setAdding(false)}
          onSaved={id => {
            resource.reload();
            select(id);
            setAdding(false);
            setQuery('');
            setBrandFilter('all');
          }}
        />
      )}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : (
        <>
          <div className="gym-brand-filters" aria-label="암장 브랜드 필터">
            <button className={brandFilter === 'all' ? 'active' : ''} onClick={() => setBrandFilter('all')}>
              전체 <span>{gyms.length}</span>
            </button>
            {[...new Set(gyms.map(g => gymIdentity(g).brandName))]
              .map(name => ({id: name, name, accent: gymBrand(name)?.accent ?? '#64748b'}))
              .map(b => (
                <button
                  className={brandFilter === b.id ? 'active' : ''}
                  key={b.id}
                  onClick={() => setBrandFilter(b.id)}
                >
                  <i style={{background: b.accent}} />
                  {b.name}
                  <span>{gyms.filter(g => gymIdentity(g).brandName === b.id).length}</span>
                </button>
              ))}
          </div>
          <div className="gyms-layout">
            <KakaoGymMap gyms={brandGyms} selected={selected} onSelect={select} />
            <section className="gym-list" aria-label="암장 목록">
              {chosen && (
                <GymDetail
                  key={chosen.id}
                  gym={chosen}
                  reload={() => {
                    setBrandFilter('all');
                    resource.reload();
                  }}
                />
              )}
              <label className="climbing-search">
                등록된 암장 검색
                <input
                  type="search"
                  placeholder="암장 이름 또는 주소"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </label>
              <p>{filtered.length}개 공용 암장 · 위치가 있는 암장은 지도에도 표시됩니다.</p>
              {!filtered.length && <p>찾는 암장이 없나요? ‘새 암장 등록’에서 검색해 등록해주세요.</p>}
              <div className="gym-card-grid">
                {filtered.map(g => (
                  <article className={`gym-card ${g.id === selected ? 'selected' : ''}`} key={g.id}>
                    <button className="gym-name" aria-pressed={g.id === selected} onClick={() => select(g.id)}>
                      <MapPin size={13} aria-hidden="true" />
                      <span>{g.name}</span>
                    </button>
                    <p className="gym-card-address" title={g.address}>
                      {g.address || '위치 미등록'}
                    </p>
                    <div className="gym-card-palette" aria-label="낮은 난이도부터 색상 순서">
                      {g.grades.map((d, i) => (
                        <i
                          key={d.id}
                          role="img"
                          aria-label={`${i + 1}번 ${d.name}`}
                          title={`${i + 1}. ${d.name}`}
                          style={{background: d.color}}
                        />
                      ))}
                    </div>
                    <div className="gym-card-bottom">
                      <span>{g.grades.length}단계 · 낮음 → 높음</span>
                      <Link to={`/me?tab=climbing&gym=${g.id}`}>
                        <Mountain size={12} />
                        기록
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
          {!chosen && (
            <p className="climbing-panel">
              지도 마커 또는 목록에서 암장을 선택하면 난이도와 회원들의 최신 소식을 볼 수 있어요.
            </p>
          )}
        </>
      )}
    </div>
  );
}
function GymDetail({gym, reload}: {gym: Gym; reload: () => void}) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="climbing-panel gym-detail" aria-label={`${gym.name} 상세`}>
      <div className="climbing-actions">
        <h2>{gym.name}</h2>
        <button className="button button-outline button-small" onClick={() => setEditing(!editing)}>
          <Pencil size={13} />
          {editing ? '수정 닫기' : '수정'}
        </button>
        <Link className="button button-dark button-small" to={`/me?tab=climbing&gym=${gym.id}`}>
          이 암장 기록하기
        </Link>
        <a
          className="text-link"
          target="_blank"
          rel="noopener noreferrer"
          href={
            gym.placeId
              ? `https://place.map.kakao.com/${gym.placeId}`
              : `https://map.kakao.com/?q=${encodeURIComponent(gym.name)}`
          }
        >
          카카오맵 ↗
        </a>
      </div>
      <p>{gym.address || '주소 미등록'}</p>
      {(gym.latitude === null || gym.longitude === null) && <GymLocationPicker gym={gym} onSaved={reload} />}
      {!editing && (
        <>
          <div className="registration-grade-title">
            <h3>난이도 체계</h3>
            <span>낮음 → 높음</span>
          </div>
          <ol className="gym-grade-ladder" aria-label="난이도 낮은 순서">
            {gym.grades.map((g, i) => (
              <li key={g.id}>
                <small>{i + 1}</small>
                <i style={{background: g.color}} />
                <span>{g.name}</span>
              </li>
            ))}
          </ol>
          {!gym.grades.length && <p>등록된 난이도가 없어요.</p>}
        </>
      )}
      {editing && (
        <GymEditor
          gym={gym}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      <details className="gym-discussion">
        <summary>회원 소식·댓글</summary>
        <GymComments gymId={gym.id} />
      </details>
    </section>
  );
}
