import {ChevronDown, Footprints, Mountain, Plus} from 'lucide-react';
import {Link} from 'react-router-dom';
import {EmptyState, ErrorNotice, Loading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import type {ClimbingSummary, ColorCount} from '@/types/climbing';

export function ColorChips({colors}: {colors: ColorCount[]}) {
  return (
    <div className="color-chips">
      {colors.map(color => (
        <span
          className="color-chip"
          role="img"
          key={`${color.key}:${color.name}:${color.hex}`}
          aria-label={`${color.name} ${color.count.toLocaleString('ko-KR')}개`}
          title={`${color.name} · ${color.count.toLocaleString('ko-KR')}개`}
        >
          <i className="climb-color-dot" style={{backgroundColor: color.hex}} aria-hidden="true" />
          <strong>{color.count.toLocaleString('ko-KR')}</strong>
        </span>
      ))}
    </div>
  );
}
export function ClimbingSummaryView() {
  const {data, loading, error, reload} = useResource<ClimbingSummary>('/me/climbing-summary');
  if (loading) return <Loading />;
  if (error) return <ErrorNotice message={error} retry={reload} />;
  if (!data || !data.visits)
    return (
      <EmptyState title="첫 기록을 남겨보세요" description="다녀온 암장과 완등한 색상을 모아볼 수 있어요.">
        <Link to="/climbs" className="button button-dark button-small">
          <Plus size={16} />
          기록 남기기
        </Link>
      </EmptyState>
    );
  return (
    <section className="climbing-summary">
      <div className="climb-summary-top">
        <div className="climb-summary-stats">
          <span>
            <Footprints size={18} />
            <strong>{data.visits.toLocaleString('ko-KR')}</strong>방문
          </span>
          <span>
            <Mountain size={18} />
            <strong>{data.totalSends.toLocaleString('ko-KR')}</strong>완등
          </span>
        </div>
        <Link to="/climbs" className="button button-dark button-small">
          <Plus size={16} />
          기록 남기기
        </Link>
      </div>
      <div className="franchise-list">
        {data.groups.map(group => (
          <details className="franchise-group" key={group.franchiseId}>
            <summary>
              <div>
                <h3>{group.franchiseName}</h3>
                <small>
                  {group.branches.length}개 지점 · {group.visits}회 방문
                </small>
              </div>
              <ColorChips colors={group.colors} />
              <ChevronDown size={18} />
            </summary>
            <div className="branch-summary-list">
              {group.branches.map(branch => (
                <div className="branch-summary" key={branch.gym.id}>
                  <div>
                    <strong>{branch.gym.name}</strong>
                    <small>
                      {branch.visits}회 방문 · {branch.totalSends}개 완등
                    </small>
                  </div>
                  <ColorChips colors={branch.colors} />
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
