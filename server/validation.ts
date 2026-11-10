import {z} from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9._-]{2,31}$/, '아이디는 영문으로 시작하는 3~32자의 영문·숫자·._-로 입력해주세요.');
export const passwordSchema = z
  .string()
  .min(4, '비밀번호는 4자 이상 입력해주세요.')
  .max(128, '비밀번호는 128자 이하로 입력해주세요.');

export const nicknameSchema = z.string().trim().min(2).max(20);

const instagramServicePaths = new Set([
  'accounts',
  'about',
  'api',
  'challenge',
  'developer',
  'developers',
  'direct',
  'directory',
  'emails',
  'explore',
  'legal',
  'oauth',
  'p',
  'privacy',
  'reel',
  'reels',
  'static',
  'stories',
  'terms',
  'tv',
  'web',
]);

export const instagramSchema = z
  .string()
  .trim()
  .max(200)
  .transform((value, context) => {
    if (!value) return '';
    const handle = value
      .replace(/^https:\/\/(?:www\.)?instagram\.com\/([a-z0-9_.]+)\/?$/i, '$1')
      .replace(/^@/, '')
      .toLowerCase();
    if (
      !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(handle) ||
      handle.includes('..') ||
      instagramServicePaths.has(handle)
    ) {
      context.addIssue({code: 'custom', message: '인스타그램 프로필 주소 또는 계정명을 입력해주세요.'});
      return z.NEVER;
    }
    return `https://www.instagram.com/${handle}/`;
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, '한글 이름을 2자 이상 입력해주세요.')
  .max(30, '이름은 30자 이하로 입력해주세요.')
  .regex(/^[가-힣]+(?:[ ·][가-힣]+)*$/, '이름은 한글로 입력해주세요.');
