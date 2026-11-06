import {randomBytes, randomUUID} from 'node:crypto';
import {PostgresDatabase, type Database} from './database';
import {DatabaseRateStore} from './rate-store';
import {resolve} from 'node:path';
import express, {type ErrorRequestHandler, type RequestHandler} from 'express';
import {ipKeyGenerator, rateLimit} from 'express-rate-limit';
import helmet from 'helmet';
import {z, ZodError} from 'zod';
import type {Honor, User, MemberProfile} from '../src/types';
import {
  createAccount,
  createSession,
  dummyHash,
  endSession,
  hashPassword,
  hashToken,
  sessionUser,
  userColumns,
  verifyPassword,
  type UserRecord,
} from './auth';
import {transaction} from './database';
import {ApiError} from './errors';
import {currentQuarter, decorateMembers} from './progression';
import {registerProgressionRoutes} from './progression-routes';
import {registerNoticeRoutes} from './notice-routes';
import {registerMarketRoutes} from './market-routes';
import type {ImageStorage} from './image-storage';
import {registerMarketImageRoutes} from './market-images';
import {usernameSchema as username, passwordSchema as password, nicknameSchema} from './validation';

const profileSchema = z.object({
  nickname: nicknameSchema,
  bio: z.string().trim().max(200),
  location: z.string().trim().max(30),
  gym: z.string().trim().max(50),
  grade: z.enum(['입문', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8+']),
});
const honorSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().min(1).max(500),
  kind: z.enum(['send', 'growth', 'crew']),
  achievedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(value => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, '올바른 날짜를 입력해주세요.'),
});

export function createApp({
  db,
  origin,
  secureCookies,
  trustProxy,
  uploadsDir = resolve('data/uploads'),
  imageStorage,
}: {
  db: Database;
  origin: string;
  secureCookies: boolean;
  trustProxy: string | false | number;
  uploadsDir?: string;
  imageStorage?: ImageStorage;
}) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: secureCookies ? {directives: {imgSrc: ["'self'", 'data:', 'blob:', 'https:']}} : false,
      strictTransportSecurity: secureCookies ? undefined : false,
    })
  );
  app.use(express.json({limit: '16kb'}));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== origin) {
      return res.status(403).json({error: '요청 출처를 확인할 수 없습니다. 페이지를 새로고침해주세요.'});
    }
    next();
  });

  const rateStore = (prefix: string) =>
    db instanceof PostgresDatabase ? new DatabaseRateStore(db, prefix) : undefined;
  const authLimiter = rateLimit({
    store: rateStore('auth:'),
    windowMs: 15 * 60 * 1000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {error: '시도 횟수가 많습니다. 15분 후 다시 시도해주세요.'},
  });
  app.use(['/api/auth/login', '/api/auth/signup', '/api/auth/recover'], authLimiter);
  app.use(
    '/api/me/password',
    rateLimit({
      store: rateStore('password:'),
      windowMs: 15 * 60 * 1000,
      limit: 15,
      skipSuccessfulRequests: true,
      keyGenerator: async req => {
        const user = await sessionUser(db, req);
        return user ? `member:${user.id}` : ipKeyGenerator(req.ip ?? '');
      },
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {error: '시도 횟수가 많습니다. 15분 후 다시 시도해주세요.'},
    })
  );
  app.use(
    '/api/auth/signup',
    rateLimit({
      store: rateStore('signup:'),
      windowMs: 60 * 60 * 1000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {error: '가입 요청이 많습니다. 잠시 후 다시 시도해주세요.'},
    })
  );

  async function requireUser(req: express.Request): Promise<User> {
    const user = await sessionUser(db, req);
    if (!user) throw new ApiError(401, '로그인이 필요합니다.');
    return user;
  }
  async function requireMember(req: express.Request) {
    const user = await requireUser(req);
    if (user.status !== 'approved') throw new ApiError(403, '운영진 승인 후 이용할 수 있습니다.');
    return user;
  }
  async function requireAdmin(req: express.Request) {
    const user = await requireMember(req);
    if (user.role !== 'admin') throw new ApiError(403, '관리자 권한이 필요합니다.');
    return user;
  }
  async function audit(actorId: string, targetId: string, action: string, details: object) {
    await db
      .prepare('INSERT INTO auditLog (actorId, targetId, action, details, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(actorId, targetId, action, JSON.stringify(details), new Date().toISOString());
  }
  async function honors(includeInactive: boolean): Promise<Honor[]> {
    return (await db
      .prepare(
        `SELECT h.id, h.userId, h.title, h.description, h.kind, h.achievedAt,
      h.createdAt, u.nickname, u.grade FROM honors h JOIN users u ON u.id = h.userId
      WHERE (? = 1 OR u.status = 'approved') ORDER BY h.achievedAt DESC, h.createdAt DESC`
      )
      .all(includeInactive ? 1 : 0)) as unknown as Honor[];
  }

  app.get('/api/health', (_req, res) => res.json({status: 'ok'}));
  app.get('/api/me', async (req, res) => res.json({user: await sessionUser(db, req)}));
  app.post('/api/auth/signup', async (req, res) => {
    const input = z.object({username, password, nickname: profileSchema.shape.nickname}).parse(req.body);
    if (await db.prepare('SELECT id FROM users WHERE username = ?').get(input.username))
      throw new ApiError(409, '이미 사용 중인 아이디입니다.');
    let user: User;
    try {
      user = await createAccount(db, {...input, role: 'member', status: 'pending'});
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('UNIQUE constraint failed') || ('code' in error && error.code === '23505'))
      )
        throw new ApiError(409, '이미 사용 중인 아이디입니다.');
      throw error;
    }
    await createSession(db, res, user.id, secureCookies);
    res.status(201).json({user});
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = z.object({username, password: z.string().min(1).max(128)}).parse(req.body);
    const record = (await db.prepare('SELECT * FROM users WHERE username = ?').get(input.username)) as unknown as
      UserRecord | undefined;
    const valid = await verifyPassword(input.password, record?.passwordHash ?? dummyHash);
    if (!record || !valid) throw new ApiError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    const loggedIn = await transaction(db, async () => {
      const current = (await db.prepare('SELECT * FROM users WHERE id = ?').get(record.id)) as unknown as UserRecord;
      if (current.passwordHash !== record.passwordHash)
        throw new ApiError(401, '비밀번호가 변경되었습니다. 다시 로그인해주세요.');
      if (current.status === 'suspended') throw new ApiError(403, '활동이 정지된 계정입니다. 운영진에게 문의해주세요.');
      await endSession(db, req, res, secureCookies);
      await createSession(db, res, record.id, secureCookies);
      return await db.prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(record.id);
    });
    res.json({user: loggedIn});
  });
  app.post('/api/auth/logout', async (req, res) => {
    await endSession(db, req, res, secureCookies);
    res.json({ok: true});
  });
  app.patch('/api/me', async (req, res) => {
    const user = await requireUser(req);
    const input = profileSchema.parse(req.body);
    await db
      .prepare('UPDATE users SET nickname = ?, bio = ?, location = ?, gym = ?, grade = ? WHERE id = ?')
      .run(input.nickname, input.bio, input.location, input.gym, input.grade, user.id);
    res.json({user: await db.prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(user.id)});
  });
  app.patch('/api/me/password', async (req, res) => {
    const user = await requireUser(req);
    const input = z.object({currentPassword: z.string().min(1).max(128), newPassword: password}).parse(req.body);
    const record = (await db.prepare('SELECT passwordHash FROM users WHERE id = ?').get(user.id)) as {
      passwordHash: string;
    };
    if (!(await verifyPassword(input.currentPassword, record.passwordHash)))
      throw new ApiError(401, '현재 비밀번호가 올바르지 않습니다.');
    const nextHash = await hashPassword(input.newPassword);
    await transaction(db, async () => {
      await requireUser(req);
      const updated = await db
        .prepare('UPDATE users SET passwordHash = ? WHERE id = ? AND passwordHash = ?')
        .run(nextHash, user.id, record.passwordHash);
      if (!updated.changes) throw new ApiError(409, '비밀번호가 이미 변경되었습니다. 다시 로그인해주세요.');
      await db.prepare('DELETE FROM sessions WHERE userId = ?').run(user.id);
      await db.prepare('DELETE FROM recoveryTokens WHERE userId = ?').run(user.id);
    });
    await endSession(db, req, res, secureCookies);
    res.json({ok: true});
  });
  app.get('/api/members', async (req, res) => {
    await requireMember(req);
    const members = (await db
      .prepare(
        "SELECT id,nickname,bio,location,gym,grade,createdAt FROM users WHERE status='approved' ORDER BY createdAt ASC"
      )
      .all()) as unknown as MemberProfile[];
    res.json({members: await decorateMembers(db, members, currentQuarter(new Date()))});
  });
  registerNoticeRoutes(app, db, {member: requireMember, admin: requireAdmin, audit});
  registerMarketRoutes(app, db, {member: requireMember, admin: requireAdmin, audit});
  registerMarketImageRoutes(app, uploadsDir, {member: requireMember, admin: requireAdmin, audit}, imageStorage);
  registerProgressionRoutes(app, db, {user: requireUser, member: requireMember, admin: requireAdmin, audit});
  app.get('/api/honors', async (req, res) => {
    await requireMember(req);
    res.json({honors: await honors(false)});
  });
  app.get('/api/admin/honors', async (req, res) => {
    await requireAdmin(req);
    res.json({honors: await honors(true)});
  });
  app.get('/api/admin/users', async (req, res) => {
    await requireAdmin(req);
    res.json({users: await db.prepare(`SELECT ${userColumns} FROM users ORDER BY createdAt DESC`).all()});
  });
  app.patch('/api/admin/users/:id', async (req, res) => {
    const actor = await requireAdmin(req);
    const input = z
      .object({
        status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
        role: z.enum(['member', 'admin']),
        reason: z.string().trim().max(200),
      })
      .parse(req.body);
    await transaction(db, async () => {
      await requireAdmin(req);
      const target = (await db
        .prepare(`SELECT ${userColumns} FROM users WHERE id = ?`)
        .get(String(req.params.id))) as unknown as User | undefined;
      if (!target) throw new ApiError(404, '회원을 찾을 수 없습니다.');
      if (input.role === 'admin' && input.status !== 'approved')
        throw new ApiError(400, '관리자는 활동 중 상태여야 합니다.');
      if (
        target.role === 'admin' &&
        target.status === 'approved' &&
        (input.role !== 'admin' || input.status !== 'approved')
      ) {
        const count = (await db
          .prepare("SELECT count(*) AS n FROM users WHERE role = 'admin' AND status = 'approved'")
          .get()) as {n: number};
        if (count.n <= 1) throw new ApiError(409, '최소 한 명의 관리자가 필요합니다.');
      }
      await db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(input.role, input.status, target.id);
      if (input.status !== 'approved' || input.role !== target.role)
        await db.prepare('DELETE FROM sessions WHERE userId = ?').run(target.id);
      await audit(actor.id, target.id, 'membership.update', {
        before: {role: target.role, status: target.status},
        after: input,
      });
    });
    res.json({ok: true});
  });
  app.post('/api/admin/users/:id/recovery', async (req, res) => {
    const actor = await requireAdmin(req);
    const targetId = String(req.params.id);
    if (!(await db.prepare('SELECT id FROM users WHERE id = ?').get(targetId)))
      throw new ApiError(404, '회원을 찾을 수 없습니다.');
    const token = randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 30 * 60 * 1000;
    await transaction(db, async () => {
      await requireAdmin(req);
      await db
        .prepare(
          `INSERT INTO recoveryTokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)
        ON CONFLICT(userId) DO UPDATE SET tokenHash = excluded.tokenHash, expiresAt = excluded.expiresAt`
        )
        .run(targetId, hashToken(token), expiresAt);
      await audit(actor.id, targetId, 'password.recovery.issue', {});
    });
    res.status(201).json({token, expiresAt});
  });
  app.post('/api/auth/recover', async (req, res) => {
    const input = z.object({username, token: z.string().min(1).max(128), newPassword: password}).parse(req.body);
    const target = (await db.prepare('SELECT id FROM users WHERE username = ?').get(input.username)) as
      {id: string} | undefined;
    const tokenHash = hashToken(input.token);
    const recovery =
      target &&
      (await db
        .prepare('SELECT userId FROM recoveryTokens WHERE userId = ? AND tokenHash = ? AND expiresAt > ?')
        .get(target.id, tokenHash, Date.now()));
    if (!target || !recovery) throw new ApiError(400, '복구 코드가 올바르지 않거나 만료되었습니다.');
    const nextHash = await hashPassword(input.newPassword);
    await transaction(db, async () => {
      const consumed = await db
        .prepare('DELETE FROM recoveryTokens WHERE userId = ? AND tokenHash = ? AND expiresAt > ?')
        .run(target.id, tokenHash, Date.now());
      if (!consumed.changes) throw new ApiError(400, '복구 코드가 올바르지 않거나 만료되었습니다.');
      await db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(nextHash, target.id);
      await db.prepare('DELETE FROM sessions WHERE userId = ?').run(target.id);
    });
    await endSession(db, req, res, secureCookies);
    res.json({ok: true});
  });
  app.post('/api/admin/honors', async (req, res) => {
    const actor = await requireAdmin(req);
    const input = honorSchema.parse(req.body);
    if (!(await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'approved'").get(input.userId)))
      throw new ApiError(400, '활동 중인 회원을 선택해주세요.');
    const id = randomUUID();
    await transaction(db, async () => {
      await requireAdmin(req);
      await db
        .prepare(
          `INSERT INTO honors (id, userId, title, description, kind, achievedAt, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.userId,
          input.title,
          input.description,
          input.kind,
          input.achievedAt,
          actor.id,
          new Date().toISOString()
        );
      await audit(actor.id, id, 'honor.create', input);
    });
    res.status(201).json({honor: (await honors(false)).find(honor => honor.id === id)});
  });
  app.delete('/api/admin/honors/:id', async (req, res) => {
    const actor = await requireAdmin(req);
    await transaction(db, async () => {
      await requireAdmin(req);
      const removed = await db.prepare('DELETE FROM honors WHERE id = ?').run(String(req.params.id));
      if (!removed.changes) throw new ApiError(404, '기록을 찾을 수 없습니다.');
      await audit(actor.id, String(req.params.id), 'honor.delete', {});
    });
    res.json({ok: true});
  });
  const apiNotFound: RequestHandler = (_req, res) => {
    res.status(404).json({error: '요청한 기능을 찾을 수 없습니다.'});
  };
  app.use('/api', apiNotFound);
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) return void res.status(400).json({error: error.issues[0].message});
    if (error instanceof ApiError) return void res.status(error.status).json({error: error.message});
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large' &&
      _req.path === '/api/admin/market/images'
    )
      return void res.status(413).json({error: '이미지는 4MB 이하로 선택해주세요.'});
    if (
      error instanceof SyntaxError ||
      (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large')
    ) {
      return void res.status(400).json({error: '올바른 요청을 보내주세요.'});
    }
    console.error('API request failed', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'});
  };
  app.use(errorHandler);
  return app;
}
