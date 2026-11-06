import {z} from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9._-]{2,31}$/, '아이디는 영문으로 시작하는 3~32자의 영문·숫자·._-로 입력해주세요.');
export const passwordSchema = z
  .string()
  .min(12, '비밀번호는 12자 이상 입력해주세요.')
  .max(128, '비밀번호는 128자 이하로 입력해주세요.');

export const nicknameSchema = z.string().trim().min(2).max(20);

export const instagramSchema = z
  .string()
  .trim()
  .max(200)
  .transform((value, context) => {
    if (!value) return '';
    let handle = value.replace(/^@/, '');
    if (value.includes('://')) {
      try {
        const url = new URL(value);
        if (
          url.protocol !== 'https:' ||
          !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
          url.port ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error('invalid');
        handle = url.pathname.replace(/^\/|\/$/g, '');
      } catch {
        context.addIssue({code: 'custom', message: '인스타그램 프로필 주소 또는 계정명을 입력해주세요.'});
        return z.NEVER;
      }
    }
    if (!/^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/.test(handle) || handle.includes('..')) {
      context.addIssue({code: 'custom', message: '인스타그램 프로필 주소 또는 계정명을 입력해주세요.'});
      return z.NEVER;
    }
    return `https://www.instagram.com/${handle.toLowerCase()}/`;
  });
