export const LEVELS = [
  {value: 0, name: '', color: '#87917c'},
  {value: 1, name: '뉴비', color: '#70954a'},
  {value: 2, name: '파랑', color: '#4a80be'},
  {value: 3, name: '빨강 1', color: '#c85b58'},
  {value: 4, name: '빨강 2', color: '#c85b58'},
  {value: 5, name: '핑크 1', color: '#ca77a1'},
  {value: 6, name: '핑크 2', color: '#ca77a1'},
  {value: 7, name: '핑크 3', color: '#ca77a1'},
  {value: 8, name: '보라 1', color: '#8865b0'},
  {value: 9, name: '보라 2', color: '#8865b0'},
  {value: 10, name: '보라 3', color: '#8865b0'},
  {value: 11, name: '회색 1', color: '#6d7886'},
] as const;
export function levelLabel(value: number) {
  const level = LEVELS.find(l => l.value === value) ?? LEVELS[0];
  return `Lv.${level.value}${level.name ? ' ' + level.name : ''}`;
}
