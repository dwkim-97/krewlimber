import {expect, it} from 'vitest';
import {bingoRankings, countBingoLines} from '../server/bingo';
import type {BingoTeam} from '../src/types/bingo';
const board = Array.from({length: 25}, (_, i) => i + 1);
it('counts rows, columns, both diagonals and the maximum twelve without free cells', () => {
  expect(countBingoLines(board, [])).toBe(0);
  expect(countBingoLines(board, [1, 2, 3, 4, 5])).toBe(1);
  expect(countBingoLines(board, [1, 6, 11, 16, 21])).toBe(1);
  expect(countBingoLines(board, [1, 7, 13, 19, 25])).toBe(1);
  expect(countBingoLines(board, [5, 9, 13, 17, 21])).toBe(1);
  expect(countBingoLines(board, [1, 7, 19, 25])).toBe(0);
  expect(countBingoLines(board, board)).toBe(12);
  expect(countBingoLines(Array(25).fill(null), board)).toBe(0);
});
it('gives tied teams shared ranks and leaves incomplete teams unranked', () => {
  const base: BingoTeam = {
    id: 'a',
    name: 'A조',
    board,
    acquired: board,
    marked: [],
    revision: 0,
    ready: true,
    lines: 3,
  };
  expect(
    bingoRankings([
      base,
      {...base, id: 'b', name: 'B조'},
      {...base, id: 'c', lines: 1},
      {...base, id: 'd', ready: false, lines: 0},
    ]).map(r => [r.teamId, r.rank])
  ).toEqual([
    ['a', 1],
    ['b', 1],
    ['c', 3],
    ['d', null],
  ]);
});
