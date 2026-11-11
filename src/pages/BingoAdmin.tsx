import {Copy, RefreshCw} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ErrorNotice, Loading} from '@/components/ui';
import {useBingoResource} from '@/hooks/useBingoResource';
import type {BingoAdminState} from '@/types/bingo';
import '@/styles/bingo-admin.css';

const PHASE_LABELS = {collecting: '준비 중', playing: '진행 중', finished: '종료'};

function NumberRangeForm({
  initialMax,
  label,
  busy,
  onSave,
}: {
  initialMax: number;
  label: string;
  busy: boolean;
  onSave: (maxValue: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(initialMax);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSave(Number(value))) setDraft(null);
  }
  return (
    <form className="bingo-admin-form" onSubmit={submit}>
      <label>
        <span id="bingo-admin-max-label">최대 번호 (n)</span>
        <input
          aria-labelledby="bingo-admin-max-label"
          aria-describedby="bingo-admin-max-hint"
          type="number"
          min={25}
          max={1000}
          step={1}
          required
          value={value}
          onChange={event => setDraft(event.target.value === String(initialMax) ? null : event.target.value)}
          disabled={busy}
        />
        <small id="bingo-admin-max-hint">1부터 n까지 · 25~1,000 사이로 설정해주세요.</small>
      </label>
      <button className="button button-dark" disabled={busy}>
        {label}
      </button>
    </form>
  );
}

export function BingoAdmin() {
  const {data, loading, busy, error, refresh, send} = useBingoResource<BingoAdminState>('/event/bingo/admin');
  const [teamName, setTeamName] = useState('');
  const [message, setMessage] = useState('');
  if (loading && !data) return <Loading />;
  if (!data)
    return (
      <div className="page-shell">
        <ErrorNotice message={error || '이벤트 정보를 불러오지 못했어요.'} retry={refresh} />
      </div>
    );
  const {event, teams, rankings} = data;
  const readyTeams = teams.filter(team => team.ready);
  const unreadyTeams = teams.filter(team => !team.ready);

  async function createEvent(maxValue: number) {
    if (event && !window.confirm('새 이벤트를 만들까요? 종료된 이벤트 기록은 보존되며 새 조 코드를 발급해야 합니다.'))
      return false;
    return send('/event/bingo/admin/events', 'POST', {maxValue});
  }
  async function registerTeam(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (!event) return;
    if (await send('/event/bingo/admin/teams', 'POST', {eventId: event.id, name: teamName.trim()})) setTeamName('');
  }
  function start() {
    if (!event) return;
    const warning = unreadyTeams.length
      ? `\n미완성 조: ${unreadyTeams.map(team => team.name).join(', ')}\n이 조들은 체크와 순위에서 제외됩니다.`
      : '';
    if (window.confirm(`빙고를 시작할까요? 번호 범위, 숫자 수집과 판 배치가 잠깁니다.${warning}`)) {
      void send('/event/bingo/admin/start', 'POST', {eventId: event.id, revision: event.revision});
    }
  }
  function finish() {
    if (
      event &&
      window.confirm('빙고를 종료하고 최종 순위를 확정할까요? 모든 번호 체크가 잠기며 다시 진행할 수 없습니다.')
    ) {
      void send('/event/bingo/admin/finish', 'POST', {eventId: event.id, revision: event.revision});
    }
  }
  async function copyCode(name: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(`${name} 조 코드를 복사했어요.`);
    } catch {
      setMessage('복사하지 못했어요. 화면의 조 코드를 길게 눌러 직접 복사해주세요.');
    }
  }

  return (
    <div className="page-shell bingo-admin-page">
      <div className="bingo-admin-heading">
        <div>
          <span className="eyebrow">EVENT CONTROL</span>
          <h1>빙고 운영</h1>
          <p>조를 준비하고, 함께 시작하고, 결과를 확인해요.</p>
        </div>
        <Link to="/event/bingo" className="button button-outline">
          참가 화면
        </Link>
      </div>
      <div className="bingo-admin-sync">
        <span>3초마다 자동 동기화</span>
        <button type="button" className="text-button" disabled={busy} onClick={() => void refresh()}>
          <RefreshCw size={15} /> 새로고침
        </button>
      </div>
      {error && <ErrorNotice message={error} retry={refresh} />}
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      <section className="bingo-admin-panel" aria-labelledby="bingo-admin-event-title">
        <div className="bingo-admin-section-heading">
          <h2 id="bingo-admin-event-title">{event ? '현재 이벤트' : '첫 이벤트 만들기'}</h2>
          {event && (
            <span className={`bingo-admin-phase bingo-admin-phase-${event.phase}`}>{PHASE_LABELS[event.phase]}</span>
          )}
        </div>
        {event && (
          <p className="bingo-admin-range">
            사용 번호 <strong>1~{event.maxValue}</strong>
          </p>
        )}
        {!event || event.phase === 'finished' ? (
          <>
            {event && <p>기존 기록을 보존하고 새 이벤트를 시작할 수 있어요. 참가자는 새 조 코드로 다시 입장합니다.</p>}
            <NumberRangeForm
              key={`${event?.id ?? 'first'}:new`}
              initialMax={75}
              label={event ? '새 이벤트 만들기' : '이벤트 만들기'}
              busy={busy}
              onSave={createEvent}
            />
          </>
        ) : event.phase === 'collecting' ? (
          <>
            <NumberRangeForm
              key={`${event.id}:config`}
              initialMax={event.maxValue}
              label="번호 범위 저장"
              busy={busy}
              onSave={maxValue =>
                send('/event/bingo/admin/config', 'PATCH', {eventId: event.id, maxValue, revision: event.revision})
              }
            />
            <p className="bingo-admin-note">
              획득한 번호는 지우지 않아요. 이미 획득한 번호보다 범위를 줄일 수 없습니다.
            </p>
          </>
        ) : (
          <p>번호 범위와 조별 숫자·빙고판이 잠겼어요. 오프라인에서 번호를 호명해주세요.</p>
        )}
      </section>
      {event && (
        <>
          <section className="bingo-admin-panel" aria-labelledby="bingo-admin-teams-title">
            <div className="bingo-admin-section-heading">
              <h2 id="bingo-admin-teams-title">조 준비 현황</h2>
              <strong>
                {readyTeams.length} / {teams.length}조 완성
              </strong>
            </div>
            {event.phase === 'collecting' && (
              <form className="bingo-admin-form" onSubmit={registerTeam}>
                <label>
                  조 이름
                  <input
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    maxLength={40}
                    required
                    disabled={busy}
                    placeholder="예: 춘식이조"
                  />
                </label>
                <button className="button button-dark" disabled={busy || !teamName.trim()}>
                  조 등록
                </button>
              </form>
            )}
            <p className="bingo-admin-note">
              조 코드는 해당 조에만 전달해주세요. 코드를 아는 조원은 준비 중 판을 함께 편집할 수 있어요.
            </p>
            {teams.length === 0 ? (
              <p className="bingo-admin-empty">등록된 조가 없어요. 조 이름을 입력하면 입장 코드가 자동 발급됩니다.</p>
            ) : (
              <ul className="bingo-admin-teams">
                {teams.map(team => (
                  <li key={team.id} className="bingo-admin-team">
                    <div className="bingo-admin-team-top">
                      <h3>{team.name}</h3>
                      <span className={team.ready ? 'bingo-admin-ready' : 'bingo-admin-unready'}>
                        {team.ready ? '준비 완료' : '미완성'}
                      </span>
                    </div>
                    <div className="bingo-admin-code">
                      <code>{team.code}</code>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`${team.name} 조 코드 복사`}
                        onClick={() => void copyCode(team.name, team.code)}
                      >
                        <Copy size={16} /> 복사
                      </button>
                    </div>
                    <div className="bingo-admin-team-stats">
                      <span>획득 {team.acquired.length}개</span>
                      <strong>{team.board.filter(number => number !== null).length} / 25칸</strong>
                      <span>{team.lines}줄 완성</span>
                    </div>
                    <details>
                      <summary>빙고판 보기</summary>
                      <div className="bingo-admin-board" aria-label={`${team.name} 빙고판`}>
                        {team.board.map((number, index) => (
                          <span key={index} className={number !== null && team.marked.includes(number) ? 'marked' : ''}>
                            {number ?? '·'}
                          </span>
                        ))}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {event.phase !== 'finished' && (
            <section
              className="bingo-admin-panel bingo-admin-transition"
              aria-labelledby="bingo-admin-transition-title"
            >
              <h2 id="bingo-admin-transition-title">
                {event.phase === 'collecting' ? '준비가 끝났나요?' : '빙고가 끝났나요?'}
              </h2>
              {event.phase === 'collecting' ? (
                <>
                  <p>25칸이 완성된 조가 하나 이상 있어야 시작할 수 있어요. 시작하면 번호 수집과 판 배치가 잠깁니다.</p>
                  {unreadyTeams.length > 0 && (
                    <p className="bingo-admin-warning">
                      미완성 {unreadyTeams.length}조: {unreadyTeams.map(team => team.name).join(', ')} — 시작하면 체크와
                      순위에서 제외됩니다.
                    </p>
                  )}
                  <button
                    type="button"
                    className="button button-dark"
                    disabled={busy || readyTeams.length === 0}
                    onClick={start}
                  >
                    빙고 시작
                  </button>
                </>
              ) : (
                <>
                  <p>종료하면 모든 조의 체크가 잠기고 현재 줄 수로 최종 순위를 확정해요.</p>
                  <button type="button" className="button button-dark" disabled={busy} onClick={finish}>
                    빙고 종료
                  </button>
                </>
              )}
            </section>
          )}
          {event.phase !== 'collecting' && (
            <section className="bingo-admin-panel" aria-labelledby="bingo-admin-ranking-title">
              <h2 id="bingo-admin-ranking-title">{event.phase === 'finished' ? '최종 순위' : '현재 순위'}</h2>
              <p className="bingo-admin-note">완성 줄이 같으면 공동 순위예요. 미완성 조는 순위에서 제외됩니다.</p>
              <table
                className="bingo-admin-rankings"
                aria-label={event.phase === 'finished' ? '최종 순위' : '현재 순위'}
              >
                <thead>
                  <tr>
                    <th scope="col">순위</th>
                    <th scope="col">조 이름</th>
                    <th scope="col">완성 줄</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map(rank => (
                    <tr key={rank.teamId}>
                      <td>{rank.rank === null ? '미완성' : `${rank.rank}위`}</td>
                      <th scope="row">{rank.name}</th>
                      <td>{rank.lines}줄</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
