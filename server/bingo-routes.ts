import {randomBytes, randomUUID} from 'node:crypto';
import type {Express, Request} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import type {BingoState, BingoEvent} from '../src/types/bingo';
import type {BoardAuthorization} from './board-auth';
import {PostgresDatabase, transaction, type Database} from './database';
import {hashToken, sessionUser} from './auth';
import {ApiError} from './errors';
import {DatabaseRateStore} from './rate-store';
import {bingoAdminState, bingoRankings, bingoTeam, bingoTeamRows, currentBingoEvent, type BingoTeamRow} from './bingo';

const base = '/api/event/bingo';
const cookieName = 'krew_bingo';
const revision = z.number().int().nonnegative();
const eventId = z.string().min(1).max(100);
const teamId = z.string().min(1).max(100);
const target = {eventId, teamId, revision};
const number = z.number().int().min(1).max(1000);
const maxValue = z.number().int().min(25).max(1000);
const emptyBoard = () => Array<number | null>(25).fill(null);
function token(req: Request) {
  const raw =
    req.headers.cookie
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1) ?? '';
  return /^[a-f0-9]{64}$/.test(raw) ? raw : '';
}

export function registerBingoRoutes(app: Express, db: Database, auth: BoardAuthorization, secureCookies: boolean) {
  async function eventRequired(): Promise<BingoEvent> {
    const event = await currentBingoEvent(db);
    if (!event) throw new ApiError(404, '아직 빙고 이벤트가 없습니다.');
    return event;
  }
  async function joined(req: Request, event: BingoEvent): Promise<BingoTeamRow | null> {
    const raw = token(req);
    if (!raw) return null;
    return (
      ((await db
        .prepare(
          'SELECT t.* FROM bingoTeams t JOIN bingoSessions s ON s.teamId=t.id WHERE s.tokenHash=? AND s.expiresAt>? AND t.eventId=?'
        )
        .get(hashToken(raw), Date.now(), event.id)) as unknown as BingoTeamRow | undefined) ?? null
    );
  }
  async function state(req: Request): Promise<BingoState> {
    const event = await currentBingoEvent(db);
    const row = event ? await joined(req, event) : null;
    const team = row ? bingoTeam(row) : null;
    const isMember = (await sessionUser(db, req))?.status === 'approved';
    return {
      event,
      team,
      isMember,
      canMark: Boolean(isMember && team?.ready && event?.phase === 'playing'),
      rankings:
        event?.phase === 'finished' && team ? bingoRankings((await bingoTeamRows(db, event.id)).map(bingoTeam)) : [],
    };
  }
  async function editable(
    req: Request,
    input: {eventId: string; teamId: string; revision: number},
    phase: 'collecting' | 'playing'
  ) {
    const event = await eventRequired();
    if (event.id !== input.eventId) throw new ApiError(409, '이벤트가 변경됐습니다. 최신 화면을 확인해주세요.');
    if (event.phase !== phase)
      throw new ApiError(
        409,
        phase === 'collecting'
          ? '입력이 마감됐습니다. 현재 상태를 확인해주세요.'
          : '빙고 진행 중에만 체크할 수 있습니다.'
      );
    const row = await joined(req, event);
    if (!row) throw new ApiError(401, '조 코드를 다시 입력해주세요.');
    if (row.id !== input.teamId) throw new ApiError(409, '입장한 조가 변경됐습니다. 최신 화면을 확인해주세요.');
    if (row.revision !== input.revision)
      throw new ApiError(409, '다른 조원이 먼저 변경했습니다. 최신 판을 확인하고 다시 시도해주세요.');
    return {event, row, team: bingoTeam(row)};
  }
  function eventVersion(event: BingoEvent, input: {eventId: string; revision: number}) {
    if (event.id !== input.eventId) throw new ApiError(409, '이벤트가 변경됐습니다. 최신 화면을 확인해주세요.');
    if (event.revision !== input.revision)
      throw new ApiError(409, '이벤트 상태가 변경됐습니다. 새로고침 후 다시 시도해주세요.');
  }
  function collecting(event: BingoEvent) {
    if (event.phase !== 'collecting') throw new ApiError(409, '준비 중인 이벤트만 변경할 수 있습니다.');
  }
  app.get(base, async (req, res) => res.json(await state(req)));
  app.post(
    base + '/join',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 60,
      skipSuccessfulRequests: true,
      store: db instanceof PostgresDatabase ? new DatabaseRateStore(db, 'bingo-join:') : undefined,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {error: '조 코드 입력을 잠시 쉬었다가 다시 시도해주세요.'},
    }),
    async (req, res) => {
      const {code} = z
        .object({
          code: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9]{8}$/, '8자리 조 코드를 입력해주세요.'),
        })
        .strict()
        .parse(req.body);
      const raw = randomBytes(32).toString('hex');
      await transaction(db, async () => {
        const event = await eventRequired();
        const team = await db.prepare('SELECT id FROM bingoTeams WHERE eventId=? AND code=?').get(event.id, code);
        if (!team) throw new ApiError(404, '조 코드를 확인해주세요.');
        await db
          .prepare('DELETE FROM bingoSessions WHERE expiresAt<=? OR tokenHash=?')
          .run(Date.now(), hashToken(token(req)));
        await db
          .prepare('INSERT INTO bingoSessions(tokenHash,teamId,expiresAt) VALUES(?,?,?)')
          .run(hashToken(raw), String(team.id), Date.now() + 24 * 60 * 60 * 1000);
      });
      res.cookie(cookieName, raw, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        path: base,
        maxAge: 24 * 60 * 60 * 1000,
      });
      req.headers.cookie = (req.headers.cookie ?? '')
        .split(';')
        .map(c => c.trim())
        .filter(c => !c.startsWith(cookieName + '='))
        .concat(cookieName + '=' + raw)
        .join('; ');
      res.json(await state(req));
    }
  );
  app.post(base + '/leave', async (req, res) => {
    const input = z.object({eventId, teamId}).strict().parse(req.body);
    await transaction(db, async () => {
      const event = await eventRequired();
      const row = await joined(req, event);
      if (!row || event.id !== input.eventId || row.id !== input.teamId)
        throw new ApiError(409, '입장한 조가 변경됐습니다. 최신 화면을 확인해주세요.');
      await db.prepare('DELETE FROM bingoSessions WHERE tokenHash=?').run(hashToken(token(req)));
    });
    res.clearCookie(cookieName, {httpOnly: true, secure: secureCookies, sameSite: 'lax', path: base});
    req.headers.cookie = req.headers.cookie
      ?.split(';')
      .filter(c => !c.trim().startsWith(cookieName + '='))
      .join('; ');
    res.json(await state(req));
  });
  app.post(base + '/numbers', async (req, res) => {
    const input = z
      .object({...target, number})
      .strict()
      .parse(req.body);
    await transaction(db, async () => {
      const {event, row, team} = await editable(req, input, 'collecting');
      if (input.number > event.maxValue) throw new ApiError(400, '범위 안의 숫자를 입력해주세요.');
      if (team.acquired.includes(input.number)) throw new ApiError(409, '이미 획득한 숫자입니다.');
      await db
        .prepare('UPDATE bingoTeams SET acquired=?,revision=revision+1 WHERE id=?')
        .run(JSON.stringify([...team.acquired, input.number].sort((a, b) => a - b)), row.id);
    });
    res.json(await state(req));
  });
  app.delete(base + '/numbers/:number', async (req, res) => {
    const input = z.object(target).strict().parse(req.body);
    const value = number.parse(Number(req.params.number));
    await transaction(db, async () => {
      const {row, team} = await editable(req, input, 'collecting');
      if (team.board.includes(value)) throw new ApiError(409, '판에서 먼저 숫자를 빼주세요.');
      if (!team.acquired.includes(value)) throw new ApiError(404, '획득한 숫자가 아닙니다.');
      await db
        .prepare('UPDATE bingoTeams SET acquired=?,revision=revision+1 WHERE id=?')
        .run(JSON.stringify(team.acquired.filter(n => n !== value)), row.id);
    });
    res.json(await state(req));
  });
  app.put(base + '/board', async (req, res) => {
    const input = z
      .object({...target, board: z.array(number.nullable()).length(25)})
      .strict()
      .parse(req.body);
    await transaction(db, async () => {
      const {row, team} = await editable(req, input, 'collecting');
      const selected = input.board.filter((n): n is number => n !== null);
      if (new Set(selected).size !== selected.length || selected.some(n => !team.acquired.includes(n)))
        throw new ApiError(400, '획득한 숫자를 중복 없이 배치해주세요.');
      if (input.board.every((value, index) => value === team.board[index])) return;
      const hasNewPlacement = input.board.some((value, index) => value !== null && value !== team.board[index]);
      if (team.acquired.length < 25 && hasNewPlacement)
        throw new ApiError(409, '숫자 25개 이상을 모은 뒤 판을 채울 수 있습니다.');
      await db
        .prepare('UPDATE bingoTeams SET board=?,revision=revision+1 WHERE id=?')
        .run(JSON.stringify(input.board), row.id);
      await db.prepare('UPDATE bingoEvents SET revision=revision+1 WHERE id=?').run(row.eventId);
    });
    res.json(await state(req));
  });
  app.put(base + '/marks', async (req, res) => {
    const input = z
      .object({...target, number, checked: z.boolean()})
      .strict()
      .parse(req.body);
    await transaction(db, async () => {
      const actor = await auth.member(req);
      const {row, team} = await editable(req, input, 'playing');
      if (!team.ready || !team.board.includes(input.number))
        throw new ApiError(400, '완성된 우리 조 판의 숫자만 체크할 수 있습니다.');
      const marked = new Set(team.marked);
      if (input.checked) marked.add(input.number);
      else marked.delete(input.number);
      await db
        .prepare('UPDATE bingoTeams SET marked=?,revision=revision+1 WHERE id=?')
        .run(JSON.stringify([...marked].sort((a, b) => a - b)), row.id);
      await auth.audit(actor.id, row.id, 'bingo.mark', {number: input.number, checked: input.checked});
    });
    res.json(await state(req));
  });
  app.get(base + '/admin', async (req, res) => {
    await auth.admin(req);
    res.json(await bingoAdminState(db));
  });
  app.post(base + '/admin/events', async (req, res) => {
    const input = z.object({maxValue}).strict().parse(req.body);
    await transaction(db, async () => {
      const actor = await auth.admin(req);
      const previous = await currentBingoEvent(db);
      if (previous && previous.phase !== 'finished')
        throw new ApiError(409, '기존 이벤트를 종료한 뒤 새 이벤트를 만들 수 있습니다.');
      const id = randomUUID();
      await db
        .prepare("INSERT INTO bingoEvents(id,maxValue,phase,createdAt) VALUES(?,?,'collecting',?)")
        .run(id, input.maxValue, new Date().toISOString());
      await auth.audit(actor.id, id, 'bingo.create', input);
    });
    res.status(201).json(await bingoAdminState(db));
  });
  app.patch(base + '/admin/config', async (req, res) => {
    const input = z.object({eventId, maxValue, revision}).strict().parse(req.body);
    await transaction(db, async () => {
      const actor = await auth.admin(req),
        event = await eventRequired();
      collecting(event);
      eventVersion(event, input);
      const teams = (await bingoTeamRows(db, event.id)).map(bingoTeam);
      if (teams.some(t => t.acquired.some(n => n > input.maxValue)))
        throw new ApiError(409, '이미 획득한 숫자보다 최대 번호를 줄일 수 없습니다.');
      await db
        .prepare('UPDATE bingoEvents SET maxValue=?,revision=revision+1 WHERE id=?')
        .run(input.maxValue, event.id);
      await auth.audit(actor.id, event.id, 'bingo.configure', {maxValue: input.maxValue});
    });
    res.json(await bingoAdminState(db));
  });
  app.post(base + '/admin/teams', async (req, res) => {
    const input = z
      .object({eventId, name: z.string().trim().min(1).max(30)})
      .strict()
      .parse(req.body);
    await transaction(db, async () => {
      const actor = await auth.admin(req),
        event = await eventRequired();
      collecting(event);
      if (event.id !== input.eventId) throw new ApiError(409, '이벤트가 변경됐습니다. 최신 화면을 확인해주세요.');
      if (
        await db.prepare('SELECT id FROM bingoTeams WHERE eventId=? AND lower(name)=lower(?)').get(event.id, input.name)
      )
        throw new ApiError(409, '이미 등록된 조 이름입니다.');
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code: string;
      do {
        code = [...randomBytes(8)].map(b => alphabet[b % alphabet.length]).join('');
      } while (await db.prepare('SELECT id FROM bingoTeams WHERE code=?').get(code));
      const id = randomUUID();
      await db
        .prepare('INSERT INTO bingoTeams(id,eventId,name,code,board) VALUES(?,?,?,?,?)')
        .run(id, event.id, input.name, code, JSON.stringify(emptyBoard()));
      await db.prepare('UPDATE bingoEvents SET revision=revision+1 WHERE id=?').run(event.id);
      await auth.audit(actor.id, id, 'bingo.team.create', {name: input.name});
    });
    res.status(201).json(await bingoAdminState(db));
  });
  for (const action of ['start', 'finish'] as const)
    app.post(base + '/admin/' + action, async (req, res) => {
      const input = z.object({eventId, revision}).strict().parse(req.body);
      await transaction(db, async () => {
        const actor = await auth.admin(req),
          event = await eventRequired();
        eventVersion(event, input);
        if (action === 'start') {
          collecting(event);
          if (!(await bingoTeamRows(db, event.id)).some(row => bingoTeam(row).ready))
            throw new ApiError(409, '완성된 빙고판이 한 조 이상 있어야 시작할 수 있습니다.');
        } else if (event.phase !== 'playing') throw new ApiError(409, '진행 중인 빙고만 종료할 수 있습니다.');
        await db
          .prepare('UPDATE bingoEvents SET phase=?,revision=revision+1 WHERE id=?')
          .run(action === 'start' ? 'playing' : 'finished', event.id);
        await auth.audit(actor.id, event.id, 'bingo.' + action, {});
      });
      res.json(await bingoAdminState(db));
    });
}
