import {Check, Plus, Trash2} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {EmptyState, ErrorNotice, Loading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {api} from '@/apis/client';
import type {ActivityCounts, ActivityMember, AdminProgression as ProgressionData} from '@/types';
import {ACTIVITY_METRICS} from '@/consts/progression';

export function AdminProgression({mode}: {mode: 'activity' | 'achievements'}) {
  const [quarter, setQuarter] = useState('');
  const resource = useResource<ProgressionData>(
    `/admin/progression${quarter ? `?quarter=${encodeURIComponent(quarter)}` : ''}`
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [memberId, setMemberId] = useState('');
  const data = resource.data;
  function queryQuarter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = `${form.get('year')}-Q${form.get('quarter')}`;
    setError('');
    setMessage('');
    if (next === data?.quarter) resource.reload();
    else setQuarter(next);
  }
  async function saveCounts(event: FormEvent<HTMLFormElement>, member: ActivityMember) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const counts = Object.fromEntries(
      ACTIVITY_METRICS.map(metric => [metric.id, Number(form.get(metric.id))])
    ) as ActivityCounts;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/activity/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({quarter: data!.quarter, counts}),
      });
      resource.reload();
      setMessage('기록을 저장했습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/admin/achievements', {
        method: 'POST',
        body: JSON.stringify({...input, target: Number(input.target)}),
      });
      form.reset();
      resource.reload();
      setMessage('업적을 추가했습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function updateGoal(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/achievements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: String(form.get('description') ?? '').trim(),
          target: Number(form.get('target')),
        }),
      });
      resource.reload();
      setMessage('업적 조건을 수정했습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '업적 조건을 수정하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string, name: string) {
    if (!window.confirm(`“${name}” 업적을 삭제할까요? 회원의 대표 선택도 해제됩니다.`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/achievements/${id}`, {method: 'DELETE'});
      resource.reload();
      setMessage('업적을 삭제했습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.reload} />;
  if (!data) return null;
  const selected = data.users.find(member => member.id === memberId) ?? data.users[0] ?? null;
  return (
    <>
      {error && <ErrorNotice message={error} retry={null} />}{' '}
      {message && (
        <div className="notice success" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      {mode === 'activity' ? (
        <section className="form-panel activity-editor">
          <div className="activity-selects">
            <form className="quarter-picker" key={data.quarter} onSubmit={queryQuarter}>
              <label>
                연도
                <input
                  name="year"
                  aria-label="활동 기록 연도"
                  type="number"
                  min={1000}
                  max={9999}
                  step={1}
                  required
                  defaultValue={Number(data.quarter.slice(0, 4))}
                />
              </label>
              <label>
                분기
                <select name="quarter" aria-label="활동 기록 분기" defaultValue={data.quarter.slice(-1)}>
                  {[1, 2, 3, 4].map(value => (
                    <option value={value} key={value}>
                      {value}분기
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-outline button-small" aria-label="분기 조회">
                조회
              </button>
            </form>
            <label>
              회원
              <select
                aria-label="활동 기록 회원"
                value={selected?.id ?? ''}
                onChange={event => setMemberId(event.target.value)}
              >
                {data.users.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.nickname} (@{member.username})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selected ? (
            <form key={`${data.quarter}-${selected.id}`} onSubmit={event => saveCounts(event, selected)}>
              <div className="activity-count-grid">
                {data.metrics.map(metric => (
                  <label key={metric.id}>
                    {metric.label}
                    <div className="number-with-unit">
                      <input
                        type="number"
                        readOnly={metric.id !== 'hosted' && metric.id !== 'attended'}
                        name={metric.id}
                        defaultValue={selected.counts[metric.id]}
                        min={0}
                        max={1000000}
                        step={1}
                        required
                      />
                      <span>{metric.unit}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="form-footer">
                <span>참여·완등은 방문 기록에서 자동 집계됩니다. 번개 개최·참여만 입력할 수 있어요.</span>
                <button className="button button-dark button-small" disabled={busy}>
                  기록 저장
                  <Check size={16} />
                </button>
              </div>
            </form>
          ) : (
            <EmptyState title="등록된 회원이 없어요" description="회원 가입 후 기록을 입력할 수 있습니다." />
          )}
        </section>
      ) : (
        <div className="admin-honors-layout">
          <section className="form-panel">
            <div className="panel-title">
              <h2>업적 추가</h2>
              <Plus size={19} />
            </div>
            <form onSubmit={create}>
              <label>
                이름
                <input name="name" placeholder="예: 초크는 거들 뿐" minLength={2} maxLength={40} required />
              </label>
              <label>
                설명
                <input
                  name="description"
                  placeholder="예: [더클라임] 빨강 문제 50개 완등"
                  minLength={1}
                  maxLength={160}
                  required
                />
              </label>
              <div className="form-grid">
                <label>
                  기준
                  <select name="metric">
                    {data.achievementMetrics.map(metric => (
                      <option key={metric.id} value={metric.id}>
                        {metric.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  목표 수량
                  <input name="target" type="number" min={1} max={1000000} step={1} required />
                </label>
              </div>
              <button className="button button-dark button-full" disabled={busy}>
                업적 추가
                <Plus size={17} />
              </button>
            </form>
          </section>
          <section className="admin-achievement-list">
            {data.achievements.map(item => (
              <article key={item.id}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <details className="achievement-goal-editor">
                    <summary>조건 수정</summary>
                    <form
                      key={`${item.id}:${item.target}:${item.description}`}
                      onSubmit={event => updateGoal(event, item.id)}
                    >
                      <label>
                        설명
                        <input
                          aria-label={`${item.name} 설명`}
                          name="description"
                          defaultValue={item.description}
                          required
                          maxLength={160}
                        />
                      </label>
                      <label>
                        목표 수량
                        <input
                          aria-label={`${item.name} 목표 수량`}
                          type="number"
                          name="target"
                          defaultValue={item.target}
                          required
                          min={1}
                          max={1000000}
                          step={1}
                        />
                      </label>
                      <button className="button button-outline button-small" disabled={busy}>
                        조건 저장
                      </button>
                    </form>
                  </details>
                </div>
                <button
                  className="icon-button danger"
                  aria-label={`${item.name} 삭제`}
                  disabled={busy}
                  onClick={() => remove(item.id, item.name)}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
