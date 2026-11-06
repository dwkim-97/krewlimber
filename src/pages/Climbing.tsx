import {useState, type FormEvent} from 'react';
import {Link, Navigate, useSearchParams} from 'react-router-dom';
import {api} from '@/apis/client';
import {useResource} from '@/hooks/useResource';
import {ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {LevelSummary} from '@/components/LevelSummary';
import type {Gym, Visit} from '@/types/climbing';
import '@/styles/climbing.css';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(
    new Date()
  );
export function ClimbingRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams({tab: 'climbing'});
  if (params.get('gym')) next.set('gym', params.get('gym')!);
  return <Navigate replace to={`/me?${next}`} />;
}
export function Climbing({embedded = false, onRecordsChange}: {embedded?: boolean; onRecordsChange?: () => void} = {}) {
  const catalog = useResource<{gyms: Gym[]}>('/gyms'),
    records = useResource<{visits: Visit[]}>('/me/climbing');
  const [params] = useSearchParams();
  const [gymId, setGymId] = useState(params.get('gym') ?? '');
  const [visitedOn, setVisitedOn] = useState(today);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [addingGrade, setAddingGrade] = useState(false);
  const [gradeName, setGradeName] = useState('');
  const [gradeColor, setGradeColor] = useState('#888888');
  const [revision, setRevision] = useState(0);
  const gyms = catalog.data?.gyms ?? [],
    gym = gyms.find(g => g.id === gymId),
    total = Object.values(counts).reduce((n, c) => n + c, 0);
  function reset() {
    setEdit(null);
    setCounts({});
    setNote('');
    setVisitedOn(today());
    setRequestId(crypto.randomUUID());
    setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(edit ? `/me/climbing/${edit}` : '/me/climbing', {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          requestId,
          gymId,
          visitedOn,
          note,
          sends: Object.entries(counts)
            .filter(([, count]) => count > 0)
            .map(([gradeId, count]) => ({gradeId, count})),
        }),
      });
      reset();
      records.reload();
      setRevision(n => n + 1);
      onRecordsChange?.();
      setMessage('클라이밍 기록을 저장했어요.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addGrade() {
    if (!gym) return;
    setBusy(true);
    setError('');
    try {
      await api(`/gyms/${gym.id}/grades`, {method: 'POST', body: JSON.stringify({name: gradeName, color: gradeColor})});
      catalog.reload();
      setAddingGrade(false);
      setGradeName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function startEdit(v: Visit) {
    setGymId(v.gymId);
    setEdit(v.id);
    setRequestId(v.requestId);
    setVisitedOn(v.visitedOn);
    setNote(v.note);
    setCounts(Object.fromEntries(v.sends.map(s => [s.gradeId, s.count])));
    setError('');
    setMessage('');
    document.getElementById('climbing-form')?.scrollIntoView({behavior: 'smooth'});
  }
  async function remove(id: string) {
    if (!window.confirm('이 방문 기록을 삭제할까요?')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/me/climbing/${id}`, {method: 'DELETE'});
      if (edit === id) reset();
      records.reload();
      setRevision(n => n + 1);
      onRecordsChange?.();
      setMessage('기록을 삭제했어요.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={embedded ? 'climbing-page climbing-embedded' : 'page-shell climbing-page'}>
      {embedded ? (
        <div className="climbing-actions climbing-tab-heading">
          <h2>등반 기록</h2>
          <Link className="text-link" to="/gyms">
            암장 찾기 ↗
          </Link>
        </div>
      ) : (
        <PageHeading title="등반 기록">
          <Link className="text-link" to="/gyms">
            암장 찾기 ↗
          </Link>
        </PageHeading>
      )}
      <p className="climbing-lead">오늘 푼 문제, 색상별 개수만 톡톡. 방문과 완등을 한 번에 기록해요.</p>
      {!embedded && <LevelSummary key={revision} />}
      <section className="climbing-panel" id="climbing-form">
        <h2>{edit ? '방문 기록 수정' : '오늘의 기록 남기기'}</h2>
        {catalog.loading ? (
          <Loading />
        ) : catalog.error ? (
          <ErrorNotice message={catalog.error} retry={catalog.reload} />
        ) : (
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="climbing-fields">
                <label>
                  방문 날짜
                  <input
                    type="date"
                    required
                    max={today()}
                    value={visitedOn}
                    onChange={e => setVisitedOn(e.target.value)}
                  />
                </label>
                <label>
                  방문 암장
                  <select
                    required
                    value={gymId}
                    onChange={e => {
                      setGymId(e.target.value);
                      setCounts({});
                      setAddingGrade(false);
                    }}
                  >
                    <option value="">암장을 선택해주세요</option>
                    {gyms.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p>
                <Link className="text-link" to="/gyms">
                  찾는 암장이 없나요? 암장 추가 ↗
                </Link>
              </p>
              {gym && (
                <>
                  <div className="climbing-actions">
                    <h3>난이도별 완등 수</h3>
                    <button
                      type="button"
                      className="text-button"
                      disabled={gym.grades.length >= 40}
                      onClick={() => setAddingGrade(!addingGrade)}
                    >
                      + 난이도 추가
                    </button>
                  </div>
                  <p className="climbing-help">
                    암장 현장의 색상·등급을 기준으로 기록해주세요. 아래 목록은 회원들이 함께 관리합니다.
                  </p>
                  <div className="grade-counters">
                    {gym.grades.map(g => (
                      <div className="grade-counter" key={g.id}>
                        <label htmlFor={`count-${g.id}`}>
                          <i style={{background: g.color}} />
                          {g.name}
                        </label>
                        <div>
                          <button
                            type="button"
                            aria-label={`${g.name} 1개 빼기`}
                            disabled={!counts[g.id]}
                            onClick={() => setCounts(c => ({...c, [g.id]: Math.max(0, (c[g.id] ?? 0) - 1)}))}
                          >
                            −
                          </button>
                          <input
                            id={`count-${g.id}`}
                            type="number"
                            min={0}
                            max={999}
                            step={1}
                            value={counts[g.id] ?? 0}
                            onChange={e =>
                              setCounts(c => ({
                                ...c,
                                [g.id]: Math.min(999, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                              }))
                            }
                          />
                          <button
                            type="button"
                            aria-label={`${g.name} 1개 더하기`}
                            disabled={counts[g.id] >= 999}
                            onClick={() => setCounts(c => ({...c, [g.id]: Math.min(999, (c[g.id] ?? 0) + 1)}))}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!gym.grades.length && <p>아직 등록된 난이도가 없어요. 색상 또는 등급 이름을 추가해주세요.</p>}
                  {addingGrade && (
                    <div className="grade-add">
                      <label>
                        난이도 이름
                        <input
                          maxLength={30}
                          value={gradeName}
                          placeholder="예: 회색, 보라, V3"
                          onChange={e => setGradeName(e.target.value)}
                        />
                      </label>
                      <label>
                        표시 색상
                        <input type="color" value={gradeColor} onChange={e => setGradeColor(e.target.value)} />
                      </label>
                      <button
                        type="button"
                        className="button button-outline button-small"
                        disabled={!gradeName.trim()}
                        onClick={addGrade}
                      >
                        난이도 등록
                      </button>
                    </div>
                  )}
                </>
              )}
              <label>
                한 줄 메모 (선택)
                <textarea
                  maxLength={500}
                  rows={2}
                  value={note}
                  placeholder="오늘의 컨디션이나 기억할 문제를 적어보세요"
                  onChange={e => setNote(e.target.value)}
                />
              </label>
              <div className="climbing-actions">
                <strong key={total} className="count-feedback" aria-live="polite">
                  총 {total}개 완등
                </strong>
                <button className="button button-dark" aria-busy={busy} disabled={!gym || total === 0}>
                  {busy ? '저장 중…' : edit ? '수정 저장' : '기록 저장'}
                </button>
                {edit && (
                  <button type="button" className="button button-outline" onClick={reset}>
                    수정 취소
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {message && (
          <p className="action-success" role="status">
            {message}
          </p>
        )}
      </section>
      <section>
        <h2>방문 기록</h2>
        {records.loading ? (
          <Loading />
        ) : records.error ? (
          <ErrorNotice message={records.error} retry={records.reload} />
        ) : !records.data?.visits.length ? (
          <div className="climbing-panel">
            <p>아직 기록이 없어요. 첫 방문을 남겨보세요.</p>
          </div>
        ) : (
          <div className="visit-list">
            {records.data.visits.map(v => (
              <article className="climbing-panel" key={v.id}>
                <div className="climbing-actions">
                  <div>
                    <time dateTime={v.visitedOn}>{v.visitedOn}</time>
                    <h3>{v.gymName}</h3>
                  </div>
                  <strong>{v.sends.reduce((n, s) => n + s.count, 0)}개 완등</strong>
                </div>
                <p>
                  {v.sends.map(s => (
                    <span className="grade-badge" key={s.gradeId}>
                      <i style={{background: s.color}} />
                      {s.name} {s.count}개
                    </span>
                  ))}
                </p>
                {v.note && <p className="visit-note">{v.note}</p>}
                <div className="climbing-actions">
                  <button className="button button-outline button-small" disabled={busy} onClick={() => startEdit(v)}>
                    수정
                  </button>
                  <button className="text-button" disabled={busy} onClick={() => remove(v.id)}>
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
