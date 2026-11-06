import {Link} from 'react-router-dom';
import {useResource} from '@/hooks/useResource';
import {LEVELS, levelLabel} from '@/consts/levels';
import type {LevelSummaryData} from '@/types/climbing';
import {ErrorNotice, Loading} from '@/components/ui';
export function LevelSummary() {
  const r = useResource<LevelSummaryData>('/me/level');
  return (
    <section className="climbing-panel" aria-labelledby="level-title">
      <div className="climbing-actions">
        <h2 id="level-title">나의 클라이밍</h2>
        <Link className="text-link" to="/me?tab=climbing">
          기록 관리 ↗
        </Link>
      </div>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorNotice message={r.error} retry={r.reload} />
      ) : (
        r.data && (
          <>
            <div className="climbing-stats">
              <div>
                <strong>{r.data.inputs.visits}</strong>
                <span>방문</span>
              </div>
              <div>
                <strong>{r.data.inputs.sends}</strong>
                <span>완등 문제</span>
              </div>
              <div>
                <strong>{r.data.inputs.gyms}</strong>
                <span>방문 암장</span>
              </div>
              <div>
                <strong>{r.data.inputs.earnedAchievements.length}</strong>
                <span>획득 업적</span>
              </div>
            </div>
            <div className="current-level">
              <span style={{background: LEVELS[r.data.level]?.color ?? LEVELS[0].color}} />
              <strong>{levelLabel(r.data.level)}</strong>
              <small>현재 레벨</small>
            </div>
            <details className="level-ladder">
              <summary>레벨 안내</summary>
              <ol>
                {LEVELS.map(l => (
                  <li key={l.value} className={l.value === r.data!.level ? 'current' : ''}>
                    <i style={{background: l.color}} />
                    {levelLabel(l.value)}
                    {l.value === 0 && <small>가입 시 시작</small>}
                  </li>
                ))}
              </ol>
              <p>자동 승급 기준은 준비 중이며, 현재는 운영진이 레벨을 지정합니다.</p>
            </details>
            <details className="level-explainer">
              <summary>집계 기준과 난이도별 기록</summary>
              <p>
                방문·완등 수와 획득 업적을 모아두고 있어요. 서로 다른 암장의 색상은 같은 난이도로 환산하지 않으며, 레벨
                자동 승급 기준은 아직 적용되지 않았어요.
              </p>
              {r.data.inputs.byGrade.length > 0 ? (
                <ul>
                  {r.data.inputs.byGrade.map(g => (
                    <li key={g.gradeId}>
                      {g.gymName} · {g.name} <strong>{g.count}개</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>첫 완등 기록을 남겨보세요.</p>
              )}
            </details>
          </>
        )
      )}
    </section>
  );
}
