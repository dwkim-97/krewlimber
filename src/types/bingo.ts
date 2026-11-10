export type BingoPhase = 'collecting' | 'playing' | 'finished';
export interface BingoEvent {
  id: string;
  maxValue: number;
  phase: BingoPhase;
  revision: number;
}
export interface BingoTeam {
  id: string;
  name: string;
  acquired: number[];
  board: (number | null)[];
  marked: number[];
  revision: number;
  lines: number;
  ready: boolean;
}
export interface BingoRanking {
  teamId: string;
  name: string;
  lines: number;
  rank: number | null;
  ready: boolean;
}
export interface BingoState {
  event: BingoEvent | null;
  team: BingoTeam | null;
  isMember: boolean;
  canMark: boolean;
  rankings: BingoRanking[];
}
export interface BingoAdminTeam extends BingoTeam {
  code: string;
}
export interface BingoAdminState {
  event: BingoEvent | null;
  teams: BingoAdminTeam[];
  rankings: BingoRanking[];
}
