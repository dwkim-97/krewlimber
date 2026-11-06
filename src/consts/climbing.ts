import type {ClimbColor} from '../types/climbing';

export const CLIMB_COLORS: ClimbColor[] = [
  {key: 'white', name: '하양', hex: '#ffffff'},
  {key: 'yellow', name: '노랑', hex: '#facc15'},
  {key: 'orange', name: '주황', hex: '#fb923c'},
  {key: 'lightgreen', name: '연두', hex: '#a3e635'},
  {key: 'green', name: '초록', hex: '#22c55e'},
  {key: 'blue', name: '파랑', hex: '#0284c7'},
  {key: 'navy', name: '남색', hex: '#1e3a8a'},
  {key: 'red', name: '빨강', hex: '#ef4444'},
  {key: 'pink', name: '분홍', hex: '#f9a8d4'},
  {key: 'purple', name: '보라', hex: '#9333ea'},
  {key: 'gray', name: '회색', hex: '#9ca3af'},
  {key: 'brown', name: '갈색', hex: '#92400e'},
  {key: 'black', name: '검정', hex: '#171717'},
];
const orders: Record<string, string[]> = {
  theclimb: ['white', 'yellow', 'orange', 'green', 'blue', 'red', 'pink', 'purple', 'gray', 'brown', 'black'],
  seoulforest: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'brown', 'black', 'pink'],
  climbingpark: ['yellow', 'pink', 'blue', 'red', 'purple', 'brown', 'gray', 'black', 'white'],
  son: ['white', 'yellow', 'green', 'blue', 'red', 'black', 'gray', 'brown', 'pink', 'purple'],
  peakers: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'gray', 'black'],
  waverock: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'brown', 'white', 'gray'],
  allez: ['white', 'yellow', 'lightgreen', 'green', 'blue', 'red', 'gray', 'brown', 'pink', 'black'],
  bouldermate: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'black', 'white'],
  damjang: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'white', 'black'],
  redone: ['yellow', 'orange', 'green', 'lightgreen', 'gray', 'blue', 'purple', 'navy', 'pink'],
  koala: ['pink', 'yellow', 'green', 'blue', 'orange', 'red', 'purple', 'black', 'white'],
  seoulboulders: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'white', 'black'],
  catchstone: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'gray', 'black', 'pink', 'white'],
  stonz: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'white', 'black'],
  offthewall: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'brown', 'black', 'white'],
  onfleek: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'black'],
  august: ['white', 'red', 'yellow', 'green', 'blue', 'navy', 'brown', 'black'],
  boulderlife: ['orange', 'yellow', 'green', 'blue', 'navy', 'brown', 'purple', 'black'],
  kindy: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'brown', 'black'],
  awake: ['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'brown', 'gray', 'black'],
};
export function gymColors(franchiseId: string): ClimbColor[] {
  const order = orders[franchiseId];
  return order ? order.map(key => CLIMB_COLORS.find(color => color.key === key)!) : CLIMB_COLORS;
}
export function todayInSeoul(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
