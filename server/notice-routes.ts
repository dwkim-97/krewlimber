import {randomUUID} from 'node:crypto';
import type {Database} from './database';
import type {Express} from 'express';
import {z} from 'zod';
import type {Notice, NoticeSummary} from '../src/types/boards';
import type {BoardAuthorization} from './board-auth';
import {transaction} from './database';
import {ApiError} from './errors';

const noticeSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(120, '제목은 120자까지 입력해주세요.'),
  body: z.string().trim().min(1, '본문을 입력해주세요.').max(4000, '본문은 4,000자까지 입력해주세요.'),
  pinned: z.boolean(),
});
const summaryColumns = 'n.id, n.title, n.pinned, n.views, n.createdAt, n.updatedAt, u.nickname AS author';
const pageSize = 10;

export function registerNoticeRoutes(app: Express, db: Database, authorization: BoardAuthorization) {
  async function notice(id: string): Promise<Notice> {
    const row = (await db
      .prepare(`SELECT ${summaryColumns}, n.body FROM notices n JOIN users u ON u.id = n.authorId WHERE n.id = ?`)
      .get(id)) as (Omit<Notice, 'pinned'> & {pinned: number}) | undefined;
    if (!row) throw new ApiError(404, '공지사항을 찾을 수 없습니다.');
    return {...row, pinned: Boolean(row.pinned)};
  }

  app.get('/api/notices', async (req, res) => {
    await authorization.member(req);
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    const filter = "WHERE n.title LIKE ? ESCAPE '\\' OR n.body LIKE ? ESCAPE '\\'";
    const {total} = (await db.prepare(`SELECT count(*) AS total FROM notices n ${filter}`).get(pattern, pattern)) as {
      total: number;
    };
    const requested = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const page = Math.min(
      Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
      Math.max(1, Math.ceil(total / pageSize))
    );
    const rows = (await db
      .prepare(
        `SELECT ${summaryColumns} FROM notices n JOIN users u ON u.id = n.authorId ${filter}
        ORDER BY n.pinned DESC, n.createdAt DESC, n.id DESC LIMIT ? OFFSET ?`
      )
      .all(pattern, pattern, pageSize, (page - 1) * pageSize)) as (Omit<NoticeSummary, 'pinned'> & {pinned: number})[];
    res.json({items: rows.map(row => ({...row, pinned: Boolean(row.pinned)})), total, page, pageSize});
  });

  app.get('/api/notices/:id', async (req, res) => {
    await authorization.member(req);
    const result = await transaction(db, async () => {
      await authorization.member(req);
      const id = String(req.params.id);
      await db.prepare('UPDATE notices SET views = views + 1 WHERE id = ?').run(id);
      return await notice(id);
    });
    res.json({notice: result});
  });

  app.post('/api/admin/notices', async (req, res) => {
    const actor = await authorization.admin(req);
    const input = noticeSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    const result = await transaction(db, async () => {
      await authorization.admin(req);
      await db
        .prepare('INSERT INTO notices (id,title,body,pinned,authorId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
        .run(id, input.title, input.body, Number(input.pinned), actor.id, now, now);
      await authorization.audit(actor.id, id, 'notice.create', input);
      return await notice(id);
    });
    res.status(201).json({notice: result});
  });

  app.patch('/api/admin/notices/:id', async (req, res) => {
    const actor = await authorization.admin(req);
    const input = noticeSchema.parse(req.body);
    const result = await transaction(db, async () => {
      await authorization.admin(req);
      const id = String(req.params.id);
      const before = await notice(id);
      await db
        .prepare('UPDATE notices SET title = ?, body = ?, pinned = ?, updatedAt = ? WHERE id = ?')
        .run(input.title, input.body, Number(input.pinned), new Date().toISOString(), id);
      await authorization.audit(actor.id, id, 'notice.update', {
        before: {title: before.title, body: before.body, pinned: before.pinned},
        after: input,
      });
      return await notice(id);
    });
    res.json({notice: result});
  });

  app.delete('/api/admin/notices/:id', async (req, res) => {
    const actor = await authorization.admin(req);
    const id = String(req.params.id);
    await transaction(db, async () => {
      await authorization.admin(req);
      const removed = await db.prepare('DELETE FROM notices WHERE id = ?').run(id);
      if (!removed.changes) throw new ApiError(404, '공지사항을 찾을 수 없습니다.');
      await authorization.audit(actor.id, id, 'notice.delete', {});
    });
    res.json({ok: true});
  });
}
