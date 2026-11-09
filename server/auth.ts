import {createHash, randomBytes, randomUUID, scrypt, timingSafeEqual} from 'node:crypto';
import type {Database} from './database';
import type {Request, Response} from 'express';
import type {MemberStatus, Role, User} from '../src/types';

export interface UserRecord extends User {
  passwordHash: string;
}
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'krew_session';
export const userColumns =
  'id, username, fullName, nickname, bio, location, gym, grade, level, role, status, createdAt';
export const dummyHash = `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024}, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$32768$8$3$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$32768$8$3') return false;
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await derive(password, parts[4]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createAccount(
  db: Database,
  input: {
    username: string;
    password: string;
    nickname: string;
    fullName?: string;
    role: Role;
    status: MemberStatus;
  }
): Promise<User> {
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await db
    .prepare(
      `INSERT INTO users (id, username, passwordHash, nickname, fullName, role, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.username.trim().toLowerCase(),
      passwordHash,
      input.nickname,
      input.fullName ?? '',
      input.role,
      input.status,
      new Date().toISOString()
    );
  return (await db.prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(id)) as unknown as User;
}

function sessionToken(req: Request) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1) ?? '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

export async function sessionUser(db: Database, req: Request): Promise<User | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const record = await db
    .prepare(
      `SELECT ${userColumns
        .split(', ')
        .map(column => `u.${column}`)
        .join(', ')}
    FROM sessions s JOIN users u ON u.id = s.userId
    WHERE s.tokenHash = ? AND s.expiresAt > ? AND u.status != 'suspended'`
    )
    .get(hashToken(token), Date.now());
  return (record as unknown as User) ?? null;
}

export async function createSession(db: Database, res: Response, userId: string, secure: boolean) {
  const token = randomBytes(32).toString('hex');
  await db.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(Date.now());
  await db
    .prepare('INSERT INTO sessions (tokenHash, userId, expiresAt) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, Date.now() + sessionLifetime);
  res.cookie(cookieName, token, {httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: sessionLifetime});
}

export async function endSession(db: Database, req: Request, res: Response, secure: boolean) {
  await db.prepare('DELETE FROM sessions WHERE tokenHash = ?').run(hashToken(sessionToken(req)));
  res.clearCookie(cookieName, {httpOnly: true, sameSite: 'lax', secure, path: '/'});
}
