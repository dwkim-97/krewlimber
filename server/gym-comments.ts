import {randomUUID} from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import type {Database} from './database';
import {transaction} from './database';
import type {BoardAuthorization} from './board-auth';
import {ApiError} from './errors';
import {hasManagementAccess} from '../src/consts/roles';
export const gymCommentsSchema = `
CREATE TABLE IF NOT EXISTS gymComments (
 id TEXT PRIMARY KEY, gymId TEXT NOT NULL REFERENCES gyms(id), userId TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gymComments_gym ON gymComments(gymId,createdAt DESC,id DESC);
`;
export function registerGymComments(app: Express, db: Database, auth: BoardAuthorization) {
  const input = z.object({
    body: z.string().trim().min(1, '댓글을 입력해주세요.').max(1000, '댓글은 1,000자까지 입력해주세요.'),
  });
  async function checkGym(id: string) {
    if (!(await db.prepare('SELECT id FROM gyms WHERE id=?').get(id)))
      throw new ApiError(404, '암장을 찾을 수 없습니다.');
  }
  app.get('/api/gyms/:gymId/comments', async (req, res) => {
    const actor = await auth.member(req),
      gymId = String(req.params.gymId);
    await checkGym(gymId);
    const rows = await db
      .prepare(
        'SELECT c.id,c.body,c.createdAt,c.updatedAt,c.userId,u.nickname AS author FROM gymComments c JOIN users u ON u.id=c.userId WHERE c.gymId=? ORDER BY c.createdAt DESC,c.id DESC LIMIT 100'
      )
      .all(gymId);
    res.json({
      comments: rows.map(({userId, ...r}) => ({
        ...r,
        canEdit: userId === actor.id,
        canDelete: userId === actor.id || hasManagementAccess(actor.role),
      })),
    });
  });
  app.post('/api/gyms/:gymId/comments', async (req, res) => {
    const actor = await auth.member(req),
      gymId = String(req.params.gymId),
      {body} = input.parse(req.body),
      id = randomUUID(),
      now = new Date().toISOString();
    await transaction(db, async () => {
      await auth.member(req);
      await checkGym(gymId);
      await db
        .prepare('INSERT INTO gymComments(id,gymId,userId,body,createdAt,updatedAt) VALUES(?,?,?,?,?,?)')
        .run(id, gymId, actor.id, body, now, now);
      await auth.audit(actor.id, id, 'gym.comment.create', {gymId});
    });
    res.status(201).json({
      comment: {id, body, createdAt: now, updatedAt: now, author: actor.nickname, canEdit: true, canDelete: true},
    });
  });
  app.patch('/api/gyms/:gymId/comments/:id', async (req, res) => {
    await auth.member(req);
    const {body} = input.parse(req.body),
      id = String(req.params.id),
      gymId = String(req.params.gymId);
    await transaction(db, async () => {
      const actor = await auth.member(req);
      const r = await db
        .prepare('UPDATE gymComments SET body=?,updatedAt=? WHERE id=? AND gymId=? AND userId=?')
        .run(body, new Date().toISOString(), id, gymId, actor.id);
      if (!r.changes) throw new ApiError(404, '수정할 수 있는 댓글을 찾을 수 없습니다.');
      await auth.audit(actor.id, id, 'gym.comment.update', {gymId});
    });
    res.json({ok: true});
  });
  app.delete('/api/gyms/:gymId/comments/:id', async (req, res) => {
    const id = String(req.params.id),
      gymId = String(req.params.gymId);
    await transaction(db, async () => {
      const actor = await auth.member(req);
      const comment = await db.prepare('SELECT userId FROM gymComments WHERE id=? AND gymId=?').get(id, gymId);
      if (!comment || (comment.userId !== actor.id && !hasManagementAccess(actor.role)))
        throw new ApiError(404, '삭제할 수 있는 댓글을 찾을 수 없습니다.');
      await db.prepare('DELETE FROM gymComments WHERE id=? AND gymId=?').run(id, gymId);
      await auth.audit(actor.id, id, 'gym.comment.delete', {gymId});
    });
    res.json({ok: true});
  });
}
