import {Award, Check, LockKeyhole, Search, Sparkles} from 'lucide-react';
import {useState} from 'react';
import {InfoButton} from '@/components/InfoButton';
import {EmptyState, ErrorNotice, Loading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {api} from '@/apis/client';
import type {AchievementCollection} from '@/types';

export function Achievements() {
  const resource = useResource<AchievementCollection>('/me/achievements');
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'earned'>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const collection = resource.data;
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.reload} />;
  if (!collection || !collection.achievements.length)
    return (
      <EmptyState title="등록된 업적이 없어요" description="운영진이 업적을 등록하면 이곳에서 확인할 수 있습니다." />
    );
  const owned = collection.achievements.filter(item => item.earned).length;
  const visible = collection.achievements.filter(
    item =>
      (filter === 'all' || item.earned) &&
      `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selected =
    visible.find(item => item.id === highlighted) ?? visible.find(item => item.featured) ?? visible[0] ?? null;
  async function feature(id: string | null) {
    setBusy(true);
    setError('');
    try {
      resource.setData(
        await api<AchievementCollection>('/me/featured-achievement', {
          method: 'PATCH',
          body: JSON.stringify({achievementId: id}),
        })
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="achievements-panel">
      <div className="achievement-toolbar">
        <div className="tabs" aria-label="업적 보기">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            전체 {collection.achievements.length}
          </button>
          <button className={filter === 'earned' ? 'active' : ''} onClick={() => setFilter('earned')}>
            획득 {owned}
          </button>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="업적 검색"
            placeholder="업적 검색"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
      </div>
      {error && <ErrorNotice message={error} retry={null} />}
      <div className="achievement-layout">
        <div className="achievement-list" role="group" aria-label="업적 목록">
          {visible.length ? (
            visible.map(item => (
              <div className="achievement-row-shell" key={item.id}>
                <button
                  className={`achievement-row ${item.earned ? 'earned' : 'locked'} ${item.id === selected?.id ? 'selected' : ''}`}
                  onClick={() => setHighlighted(item.id)}
                  aria-pressed={selected?.id === item.id}
                >
                  <span className="achievement-mark">
                    {item.earned ? <Award size={22} /> : <LockKeyhole size={19} />}
                  </span>
                  <span className="achievement-row-copy">
                    <strong>
                      {item.name}
                      {item.featured && <span className="featured-chip">대표</span>}
                    </strong>
                    <small>{item.description}</small>
                    <span className="achievement-progress">
                      <span style={{width: `${Math.min(100, (item.progress / item.target) * 100)}%`}} />
                    </span>
                  </span>
                  <span className="achievement-row-count">
                    {item.earned ? <Check size={17} /> : `${item.progress}/${item.target}`}
                  </span>
                </button>
                <InfoButton title={item.name}>
                  <p className="info-condition">{item.description}</p>
                  <p>전체 분기의 누적 기록으로 계산합니다. 달성한 업적은 대표로 선택할 수 있습니다.</p>
                </InfoButton>
              </div>
            ))
          ) : (
            <p className="list-empty">해당하는 업적이 없어요.</p>
          )}
        </div>
        <aside className="achievement-detail">
          {selected ? (
            <>
              <span className="detail-status">
                {selected.featured ? '현재 대표 업적' : selected.earned ? '획득한 업적' : '도전 중인 업적'}
              </span>
              <span className={`achievement-medal ${selected.earned ? '' : 'medal-locked'}`}>
                <Award size={58} strokeWidth={1.2} />
                <Sparkles size={18} />
              </span>
              <div className="achievement-detail-heading">
                <h3>{selected.name}</h3>
                <InfoButton title={selected.name}>
                  <p className="info-condition">{selected.description}</p>
                  <p>전체 분기의 누적 기록으로 계산합니다. 달성한 업적은 대표로 선택할 수 있습니다.</p>
                </InfoButton>
              </div>
              <p>{selected.description}</p>
              <div className="detail-progress">
                <strong>
                  {Math.min(selected.progress, selected.target)}
                  <span> / {selected.target}</span>
                </strong>
                <span>{selected.earned ? '달성 완료' : '누적 기록'}</span>
              </div>
              <button
                className="button button-full"
                disabled={!selected.earned || busy}
                onClick={() => feature(selected.featured ? null : selected.id)}
              >
                {busy ? '저장 중…' : selected.featured ? '대표 업적 해제' : '대표로 선택'}
                {selected.featured ? <Check size={17} /> : <Award size={17} />}
              </button>
              <small>대표 업적은 멤버 목록에 표시됩니다.</small>
            </>
          ) : (
            <p>목록에서 업적을 선택해주세요.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
