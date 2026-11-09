import {expect, it} from 'vitest';
import {gymIdentity, gymDisplayName} from '../src/consts/gym-identity';
it('separates known branches and keeps standalone gym names intact', () => {
  expect(gymIdentity({name: '손상원 클라이밍짐 판교점'})).toEqual({brandName: '손상원클라이밍', branchName: '판교점'});
  expect(gymIdentity({name: '새로운 암장'})).toEqual({brandName: '새로운 암장', branchName: ''});
  expect(gymIdentity({name: '원본 장소명', brandName: '새암장', branchName: '서울점'})).toEqual({
    brandName: '새암장',
    branchName: '서울점',
  });
  expect(gymDisplayName('새암장', '')).toBe('새암장');
});
