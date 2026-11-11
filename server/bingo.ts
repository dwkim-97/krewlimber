import type {Database} from './database';
import type {BingoAdminState, BingoEvent, BingoRanking, BingoTeam} from '../src/types/bingo';

export interface BingoTeamRow {
  id: string;
  eventId: string;
  name: string;
  code: string;
  acquired: string;
  board: string;
  marked: string;
  revision: number;
}

export async function currentBingoEvent(db: Database): Promise<BingoEvent | null> {
  return (
    ((await db
      .prepare('SELECT id,maxValue,phase,revision FROM bingoEvents ORDER BY ordinal DESC LIMIT 1')
      .get()) as unknown as BingoEvent | undefined) ?? null
  );
}
export async function bingoTeamRows(db: Database, eventId: string): Promise<BingoTeamRow[]> {
  return (await db
    .prepare('SELECT * FROM bingoTeams WHERE eventId=? ORDER BY name COLLATE NOCASE,id')
    .all(eventId)) as unknown as BingoTeamRow[];
}
export function countBingoLines(board: (number | null)[], marked: number[]) {
  const selected = new Set(marked);
  const lines: number[][] = [];
  for (let n = 0; n < 5; n++) {
    lines.push(Array.from({length: 5}, (_, i) => n * 5 + i));
    lines.push(Array.from({length: 5}, (_, i) => i * 5 + n));
  }
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines.filter(line => line.every(index => board[index] !== null && selected.has(board[index]!))).length;
}
export function bingoTeam(row: BingoTeamRow): BingoTeam {
  const board = JSON.parse(row.board) as (number | null)[];
  const marked = JSON.parse(row.marked) as number[];
  return {
    id: row.id,
    name: row.name,
    acquired: JSON.parse(row.acquired),
    board,
    marked,
    revision: row.revision,
    ready: board.length === 25 && board.every(n => n !== null),
    lines: countBingoLines(board, marked),
  };
}
export function bingoRankings(teams: BingoTeam[]): BingoRanking[] {
  const sorted = [...teams].sort(
    (a, b) =>
      Number(b.ready) - Number(a.ready) ||
      b.lines - a.lines ||
      a.name.localeCompare(b.name, 'ko') ||
      a.id.localeCompare(b.id)
  );
  let previous = -1,
    rank = 0;
  return sorted.map((team, index) => {
    if (team.ready && team.lines !== previous) {
      rank = index + 1;
      previous = team.lines;
    }
    return {teamId: team.id, name: team.name, lines: team.lines, ready: team.ready, rank: team.ready ? rank : null};
  });
}
export async function bingoAdminState(db: Database): Promise<BingoAdminState> {
  const event = await currentBingoEvent(db);
  const rows = event ? await bingoTeamRows(db, event.id) : [];
  const teams = rows.map(row => ({...bingoTeam(row), code: row.code}));
  return {event, teams, rankings: event && event.phase !== 'collecting' ? bingoRankings(teams) : []};
}
