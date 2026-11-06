import {Check, ChevronRight, Plus, Trash2, X} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ColorChips} from '@/components/ClimbingSummary';
import {GymPicker} from '@/components/GymPicker';
import {EmptyState, ErrorNotice, Loading, PageHeading, TextLink} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {api} from '@/apis/client';
import type {ClimbColor, ClimbRecord, ColorCount, Gym} from '@/types/climbing';
import {gymColors, todayInSeoul} from '@/consts/climbing';

function ClimbEditor({
  initial,
  onSave,
  onCancel,
  busy,
  onBusyChange,
}: {
  initial: ClimbRecord | null;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [gym, setGym] = useState<Gym | null>(initial?.gym ?? null);
  const [date, setDate] = useState(initial?.date ?? todayInSeoul(new Date()));
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(initial?.colors.map(c => [c.key, String(c.count)]) ?? [])
  );
  const [custom, setCustom] = useState<ClimbColor[]>(initial?.colors.filter(c => c.key.startsWith('custom-')) ?? []);
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#6b8e75');
  const [error, setError] = useState('');
  const colors = gym ? [...gymColors(gym.franchiseId), ...custom] : [];
  function selectGym(next: Gym) {
    if (next.id !== gym?.id) {
      setCounts({});
      setCustom([]);
    }
    setGym(next);
    setError('');
  }
  function addColor() {
    const value = name.trim();
    const key = `custom-${hex.slice(1)}`;
    if (!value || value.length > 20) return setError('커스텀 색상 이름을 1~20자로 입력해주세요.');
    if (custom.some(c => c.key === key)) return setError('이미 추가한 색상이에요. 수량을 수정해주세요.');
    setCustom([...custom, {key, name: value, hex}]);
    setCounts({...counts, [key]: '1'});
    setName('');
    setError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!gym) return setError('암장을 선택해주세요.');
    const selected: ColorCount[] = colors
      .filter(c => Number(counts[c.key] ?? 0) > 0)
      .map(c => ({...c, count: Number(counts[c.key])}));
    onBusyChange(true);
    setError('');
    try {
      await api(initial ? `/me/climbs/${initial.id}` : '/me/climbs', {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify({date, gymId: gym.id, colors: selected}),
      });
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : '기록을 저장하지 못했습니다.');
    } finally {
      onBusyChange(false);
    }
  }
  return (
    <form className="climb-editor form-panel" onSubmit={submit}>
      <div className="panel-title">
        <h2>{initial ? '기록 수정' : '오늘의 클라이밍'}</h2>
        {initial && (
          <button type="button" className="text-button" disabled={busy} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
      <label>
        날짜
        <input
          disabled={busy}
          type="date"
          name="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
          min="1900-01-01"
          max={todayInSeoul(new Date())}
        />
      </label>
      <GymPicker gym={gym} onSelect={selectGym} disabled={busy} />
      {gym && (
        <>
          <div className="climb-palette-heading">
            <h3>완등</h3>
            <span>색상별 개수</span>
          </div>
          <div className="climb-color-grid">
            {colors.map(color => (
              <div className="climb-counter" key={color.key}>
                <label>
                  <span>
                    <i className="climb-color-dot" style={{backgroundColor: color.hex}} aria-hidden="true" />
                    {color.name}
                  </span>
                  <input
                    disabled={busy}
                    type="number"
                    aria-label={`${color.name} 완등 수`}
                    value={counts[color.key] ?? ''}
                    placeholder="0"
                    min={0}
                    max={1000}
                    step={1}
                    onChange={e => setCounts({...counts, [color.key]: e.target.value})}
                  />
                </label>
                {color.key.startsWith('custom-') && (
                  <button
                    type="button"
                    className="custom-remove"
                    disabled={busy}
                    aria-label={`${color.name} 색상 삭제`}
                    onClick={() => setCustom(custom.filter(c => c.key !== color.key))}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <details className="custom-color-panel">
            <summary>커스텀 색상</summary>
            <div className="custom-color-fields">
              <input
                disabled={busy}
                type="color"
                aria-label="커스텀 색상 선택"
                value={hex}
                onChange={e => setHex(e.target.value)}
              />
              <input
                disabled={busy}
                aria-label="커스텀 색상 이름"
                placeholder="색상 이름"
                value={name}
                maxLength={20}
                onChange={e => setName(e.target.value)}
              />
              <button
                type="button"
                className="button button-outline button-small"
                onClick={addColor}
                disabled={busy || custom.length >= 19}
              >
                <Plus size={15} />
                색상 추가
              </button>
            </div>
          </details>
        </>
      )}
      {error && <ErrorNotice message={error} retry={null} />}
      <div className="form-footer">
        <span>같은 날 다른 암장은 각각 1회 방문</span>
        <button className="button button-dark button-small" disabled={busy}>
          <Check size={16} />
          {initial ? '수정 저장' : '기록 저장'}
        </button>
      </div>
    </form>
  );
}
export function ClimbingRecords() {
  const resource = useResource<{records: ClimbRecord[]}>('/me/climbs');
  const [editing, setEditing] = useState<ClimbRecord | null>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function saved() {
    setMessage(editing ? '기록을 수정했어요.' : '기록을 저장했어요.');
    setEditing(null);
    setVersion(v => v + 1);
    resource.reload();
  }
  async function remove(record: ClimbRecord) {
    if (!window.confirm(`${record.date} ${record.gym.name} 기록을 삭제할까요?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/me/climbs/${record.id}`, {method: 'DELETE'});
      if (editing?.id === record.id) setEditing(null);
      resource.reload();
      setMessage('기록을 삭제했어요.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-shell">
      <PageHeading title="클라이밍 기록">
        <TextLink to="/me?tab=records">내 기록 요약</TextLink>
      </PageHeading>
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && <ErrorNotice message={error} retry={null} />}
      <div className="climb-page-grid">
        <ClimbEditor
          key={editing ? `${editing.id}-${editing.updatedAt}` : `new-${version}`}
          initial={editing}
          busy={busy}
          onBusyChange={setBusy}
          onSave={saved}
          onCancel={() => setEditing(null)}
        />
        <section className="climb-history">
          <div className="climb-history-heading">
            <h2>내 기록</h2>
            <span>{resource.data?.records.length ?? 0}회</span>
          </div>
          {resource.loading ? (
            <Loading />
          ) : resource.error ? (
            <ErrorNotice message={resource.error} retry={resource.reload} />
          ) : resource.data?.records.length ? (
            <ul>
              {resource.data.records.map(record => (
                <li key={record.id}>
                  <div className="climb-history-title">
                    <div>
                      <time dateTime={record.date}>{record.date.replaceAll('-', '.')}</time>
                      <h3>{record.gym.name}</h3>
                    </div>
                    <div className="climb-record-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          setEditing(record);
                          setMessage('');
                          window.scrollTo({top: 0, behavior: 'smooth'});
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`${record.date} ${record.gym.name} 기록 삭제`}
                        onClick={() => remove(record)}
                        disabled={busy}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <ColorChips colors={record.colors} />
                  {!record.colors.length && <small>방문 기록</small>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="아직 기록이 없어요" description="첫 방문을 남겨보세요." />
          )}
          <Link className="climb-summary-link" to="/me?tab=records">
            암장별 기록 모아보기
            <ChevronRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
