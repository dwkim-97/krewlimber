import {useState, type FormEvent} from 'react';
import {Trophy} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useBingoResource} from '@/hooks/useBingoResource';
import type {BingoEvent, BingoRanking, BingoState, BingoTeam} from '@/types/bingo';
import '@/styles/bingo.css';

const phaseLabels = {collecting: '준비 중', playing: '진행 중', finished: '종료'};
type Send = ReturnType<typeof useBingoResource<BingoState>>['send'];

export function Bingo() {
  const resource = useBingoResource<BingoState>('/event/bingo');
  const [code, setCode] = useState('');
  const data = resource.data;

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await resource.send('/event/bingo/join', 'POST', {code: code.trim()})) setCode('');
  }

  return (
    <div className="page-shell bingo-page">
      <header className="bingo-heading">
        <div>
          <p className="bingo-eyebrow">KREW EVENT</p>
          <h1>우리 조 빙고</h1>
        </div>
        <button
          className="button button-outline button-small"
          onClick={() => void resource.refresh()}
          disabled={resource.busy}
        >
          새로고침
        </button>
      </header>
      {resource.error && (
        <p className="bingo-error" role="alert">
          {resource.error}
        </p>
      )}
      {resource.loading ? (
        <p role="status">빙고를 불러오는 중…</p>
      ) : !data?.event ? (
        <section className="bingo-panel">
          <h2>이벤트를 기다리고 있어요</h2>
          <p>운영진이 이벤트를 열면 조 코드로 입장하세요.</p>
        </section>
      ) : (
        <>
          <div className={`bingo-status bingo-status-${data.event.phase}`}>
            <span>{phaseLabels[data.event.phase]}</span>
            <span>숫자 1–{data.event.maxValue}</span>
          </div>
          {!data.team ? (
            <section className="bingo-panel">
              <h2>조 코드로 함께 시작해요</h2>
              <p>같은 조는 숫자와 빙고판을 함께 사용해요. 회원가입 없이 준비에 참여할 수 있어요.</p>
              <form className="bingo-inline-form" onSubmit={join}>
                <label>
                  조 코드
                  <input
                    value={code}
                    disabled={resource.busy}
                    onChange={event => setCode(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={32}
                    required
                  />
                </label>
                <button className="button button-dark" type="submit" disabled={resource.busy || !code.trim()}>
                  조 입장
                </button>
              </form>
            </section>
          ) : (
            <TeamPanel
              key={`${data.event.id}:${data.team.id}`}
              event={data.event}
              team={data.team}
              canMark={data.canMark}
              isMember={data.isMember}
              rankings={data.rankings}
              busy={resource.busy}
              send={resource.send}
            />
          )}
          {data.event.phase === 'finished' && data.team && <Rankings rankings={data.rankings} />}
          <p className="bingo-sync-note">조원의 변경 사항을 3초마다 함께 확인해요.</p>
        </>
      )}
    </div>
  );
}

function TeamPanel({
  event,
  team,
  canMark,
  isMember,
  rankings,
  busy,
  send,
}: {
  event: BingoEvent;
  team: BingoTeam;
  canMark: boolean;
  isMember: boolean;
  rankings: BingoRanking[];
  busy: boolean;
  send: Send;
}) {
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [pendingCell, setPendingCell] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const target = {eventId: event.id, teamId: team.id};
  const collecting = event.phase === 'collecting';
  const canArrange = collecting && team.acquired.length >= 25;
  const rank = rankings.find(entry => entry.teamId === team.id)?.rank ?? null;
  const tied = rank !== null && rankings.some(entry => entry.teamId !== team.id && entry.rank === rank);
  const rankLabel = rank === null ? '순위 없음' : `${tied ? '공동 ' : ''}${rank}위`;
  const availableSelection =
    selected !== null && team.acquired.includes(selected) && !team.board.includes(selected) ? selected : null;
  const numbers = showAll
    ? Array.from({length: event.maxValue}, (_, index) => index + 1)
    : [...team.acquired].sort((a, b) => a - b);

  async function acquire(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    if (await send('/event/bingo/numbers', 'POST', {...target, number: Number(input), revision: team.revision}))
      setInput('');
  }
  async function chooseCell(index: number) {
    const number = team.board[index];
    if (busy) return;
    if (collecting && number === null && (!canArrange || availableSelection === null)) return;
    setPendingCell(index);
    try {
      if (collecting) {
        const board = team.board.map((value, position) =>
          position === index ? (number === null ? availableSelection : null) : value
        );
        if (await send('/event/bingo/board', 'PUT', {...target, board, revision: team.revision})) setSelected(null);
      } else if (event.phase === 'playing' && canMark && number !== null) {
        await send('/event/bingo/marks', 'PUT', {
          ...target,
          number,
          checked: !team.marked.includes(number),
          revision: team.revision,
        });
      }
    } finally {
      setPendingCell(null);
    }
  }
  async function fillBoard() {
    const unused = team.acquired.filter(number => !team.board.includes(number));
    let next = 0;
    const board = team.board.map(number => number ?? unused[next++]);
    if (await send('/event/bingo/board', 'PUT', {...target, board, revision: team.revision})) setSelected(null);
  }

  return (
    <section className="bingo-panel bingo-team-panel">
      <div className="bingo-team-heading">
        <h2>{team.name}</h2>
        <button
          className="bingo-text-button"
          disabled={busy}
          onClick={() => void send('/event/bingo/leave', 'POST', target)}
        >
          조 나가기
        </button>
      </div>
      {collecting ? (
        <>
          <p className="bingo-intro">숫자를 모아 우리 조의 판을 완성해요.</p>
          <form className="bingo-inline-form" onSubmit={acquire}>
            <label>
              획득한 숫자
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={event.maxValue}
                step={1}
                required
                value={input}
                disabled={busy}
                onChange={change => setInput(change.target.value)}
                placeholder={`1–${event.maxValue}`}
              />
            </label>
            <button className="button button-dark" type="submit" disabled={busy || !input}>
              숫자 추가
            </button>
          </form>
          <div className="bingo-number-heading">
            <strong>모은 숫자 {team.acquired.length}개</strong>
            <label>
              <input type="checkbox" checked={showAll} onChange={change => setShowAll(change.target.checked)} />
              모든 숫자 보기
            </label>
          </div>
          <div className="bingo-number-tray" aria-label="획득 숫자 선택">
            {numbers.length === 0 && <p>먼저 획득한 숫자를 추가하세요.</p>}
            {numbers.map(number => {
              const obtained = team.acquired.includes(number);
              const placed = team.board.includes(number);
              return (
                <button
                  key={number}
                  type="button"
                  className={`bingo-number${placed ? ' bingo-number-placed' : ''}`}
                  aria-label={`숫자 ${number}`}
                  aria-pressed={availableSelection === number}
                  disabled={busy || !obtained || placed}
                  onClick={() => setSelected(number)}
                >
                  {number}
                  {placed && <span className="bingo-sr-only"> 배치됨</span>}
                </button>
              );
            })}
          </div>
          <div className="bingo-selection">
            <span>{availableSelection === null ? '획득한 숫자를 선택하세요.' : `${availableSelection} 선택됨`}</span>
            <button
              className="bingo-text-button"
              disabled={busy || availableSelection === null}
              onClick={async () => {
                if (
                  await send(`/event/bingo/numbers/${availableSelection}`, 'DELETE', {
                    ...target,
                    revision: team.revision,
                  })
                )
                  setSelected(null);
              }}
            >
              선택한 숫자 삭제
            </button>
          </div>
          <div className="bingo-board-heading">
            <strong>배치 {team.board.filter(number => number !== null).length} / 25</strong>
            <button
              className="bingo-text-button"
              disabled={busy || !canArrange || team.ready}
              onClick={() => void fillBoard()}
            >
              자동 채우기
            </button>
          </div>
          <p className="bingo-help">
            {canArrange
              ? '숫자를 선택한 뒤 빈칸을 누르세요. 채운 칸을 누르면 비워져요.'
              : '숫자를 25개 이상 모으면 판을 배치할 수 있어요.'}
          </p>
        </>
      ) : (
        <>
          <div className="bingo-score-summary" aria-live="polite">
            <p className="bingo-lines">우리 조 {team.lines}줄</p>
            <span
              className={`bingo-standing bingo-standing-${rank !== null && rank <= 3 ? rank : 'default'}`}
              aria-label={`${event.phase === 'finished' ? '최종' : '현재'} 순위: ${rankLabel}`}
            >
              {rank !== null && rank <= 3 && <Trophy size={16} fill="currentColor" aria-hidden="true" />}
              {rankLabel}
            </span>
          </div>
          {event.phase === 'playing' &&
            (!team.ready ? (
              <p className="bingo-help">미완성 판으로 이번 게임의 체크와 순위에서 제외돼요.</p>
            ) : canMark ? (
              <p className="bingo-help">호명된 숫자를 누르세요. 다시 누르면 체크를 해제해요.</p>
            ) : (
              <p className="bingo-help">회원만 숫자를 체크할 수 있어요. 조원의 진행 상황을 함께 보세요.</p>
            ))}
          {event.phase === 'playing' && !isMember && (
            <Link className="button button-outline bingo-login" to="/login" state={{from: '/event/bingo'}}>
              회원 로그인
            </Link>
          )}
          {event.phase === 'finished' && (
            <p className="bingo-help">게임이 끝났어요. 우리 조의 최종 결과를 확인하세요.</p>
          )}
        </>
      )}
      <div className="bingo-grid" role="group" aria-label={`${team.name} 빙고판`}>
        {team.board.map((number, index) => {
          const locked = collecting
            ? number === null && (!canArrange || availableSelection === null)
            : event.phase !== 'playing' || !canMark || number === null;
          return (
            <button
              key={index}
              type="button"
              className="bingo-cell"
              aria-label={`${Math.floor(index / 5) + 1}행 ${(index % 5) + 1}열 ${number === null ? '빈칸' : `숫자 ${number}`}`}
              aria-pressed={number !== null && team.marked.includes(number)}
              aria-busy={busy && pendingCell === index}
              data-locked={locked}
              disabled={busy || locked}
              onClick={() => void chooseCell(index)}
            >
              {number ?? <span aria-hidden="true">·</span>}
            </button>
          );
        })}
      </div>
      {collecting && (
        <p className={`bingo-ready${team.ready ? ' bingo-ready-complete' : ''}`}>
          {team.ready ? '준비 완료! 게임 시작을 기다려요.' : '중앙도 숫자를 채워요. 25칸 모두 채우면 준비 완료!'}
        </p>
      )}
    </section>
  );
}

function Rankings({rankings}: {rankings: BingoRanking[]}) {
  return (
    <section className="bingo-panel bingo-rankings">
      <h2>최종 순위</h2>
      {rankings.length === 0 ? (
        <p>아직 결과가 없어요.</p>
      ) : (
        <ul>
          {rankings.map(team => (
            <li key={team.teamId}>
              <span className="bingo-rank">
                {team.rank === null
                  ? '—'
                  : `${rankings.filter(other => other.rank === team.rank).length > 1 ? '공동 ' : ''}${team.rank}위`}
              </span>
              <strong>{team.name}</strong>
              <span>{team.ready ? `${team.lines}줄` : '미완성 · 순위 없음'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
