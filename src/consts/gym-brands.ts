export interface GradeTemplate {
  name: string;
  color: string;
}
const colors: Record<string, string> = {
  검정: '#303238',
  갈색: '#8c6349',
  회색: '#8e949e',
  보라: '#8b63b5',
  핑크: '#de88b0',
  빨강: '#d85c5b',
  파랑: '#4e85c7',
  흰색: '#f9f9f7',
  남색: '#304b79',
};
export const GYM_BRANDS = [
  {
    id: 'theclimb',
    name: '더클라임',
    accent: '#4e85c7',
    names: ['검정', '갈색', '회색', '보라', '핑크', '빨강', '파랑'],
  },
  {
    id: 'climbingpark',
    name: '클라이밍파크',
    accent: '#d85c5b',
    names: ['흰색', '검정', '회색', '갈색', '보라', '빨강', '파랑'],
  },
  {
    id: 'sonsangwon',
    name: '손상원클라이밍',
    accent: '#8b63b5',
    names: ['보라', '핑크', '갈색', '회색', '검정', '빨강', '파랑'],
  },
  {
    id: 'seoulforest',
    name: '서울숲클라이밍',
    accent: '#477e65',
    names: ['핑크', '검정', '갈색', '보라', '남색', '파랑'],
  },
  // Store and display difficulty in ascending order: easiest = 1.
].map(b => ({
  ...b,
  names: [...b.names].reverse(),
  grades: [...b.names].reverse().map(name => ({name, color: colors[name]})),
}));
export function gymBrand(name: string) {
  const normalized = name.replace(/\s+/g, '');
  return GYM_BRANDS.find(b => normalized.startsWith(b.name));
}
export function copyGrades(grades: readonly GradeTemplate[]): GradeTemplate[] {
  return grades.map(({name, color}) => ({name, color}));
}
