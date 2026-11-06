import {expect, it} from 'vitest';
import {GYM_BRANDS, gymBrand, copyGrades} from '../src/consts/gym-brands';
it('uses the supplied ascending grade order and recognizes spaced branch names only', () => {
  expect(GYM_BRANDS.map(b => b.grades.map(g => g.name))).toEqual([
    ['파랑', '빨강', '핑크', '보라', '회색', '갈색', '검정'],
    ['파랑', '빨강', '보라', '갈색', '회색', '검정', '흰색'],
    ['파랑', '빨강', '검정', '회색', '갈색', '핑크', '보라'],
    ['파랑', '남색', '보라', '갈색', '검정', '핑크'],
  ]);
  expect(gymBrand('손상원 클라이밍짐 판교점')?.name).toBe('손상원클라이밍');
  expect(gymBrand('경산국제클라이밍파크')).toBeUndefined();
  const source = [{id: 'old', gymId: 'gym', name: '보라', color: '#8866aa'}];
  const copied = copyGrades(source);
  expect(copied).toEqual([{name: '보라', color: '#8866aa'}]);
  copied[0].name = '다른 이름';
  expect(source[0].name).toBe('보라');
});
