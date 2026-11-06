import {randomUUID} from 'node:crypto';
import type {Database} from './database';
import type {Express, Request} from 'express';
import {z} from 'zod';
import type {User} from '../src/types';
import {transaction} from './database';
import {ApiError} from './errors';
import {
  currentQuarter,
  getAchievements,
  getTitleBoard,
  getAdminProgression,
  setFeaturedAchievement,
  setActivityCounts,
} from './progression';

const quarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/, '올바른 분기를 선택해주세요.');
const metricSchema = z.enum(['participation', 'hosted', 'attended', 'red', 'pink', 'purple']);
const count = z.number().int().min(0).max(1000000);
const countsSchema = z
  .object({participation: count, hosted: count, attended: count, red: count, pink: count, purple: count})
  .strict();

export function registerProgressionRoutes(
  app: Express,
  db: Database,
  authorization: {
    user: (req: Request) => Promise<User>;
    member: (req: Request) => Promise<User>;
    admin: (req: Request) => Promise<User>;
    audit: (actorId: string, targetId: string, action: string, details: object) => Promise<void>;
  }
) {
  function quarter(req: Request) {
    return quarterSchema.parse(req.query.quarter ?? currentQuarter(new Date()));
  }
  app.get('/api/titles', async (req, res) => {
    await authorization.member(req);
    res.json(await getTitleBoard(db, quarter(req)));
  });
  app.get('/api/me/achievements', async (req, res) => {
    const user = await authorization.user(req);
    res.json(await getAchievements(db, user.id));
  });
  app.patch('/api/me/featured-achievement', async (req, res) => {
    const user = await authorization.user(req);
    const {achievementId} = z.object({achievementId: z.string().min(1).max(64).nullable()}).parse(req.body);
    await transaction(db, async () => {
      await authorization.user(req);
      return await setFeaturedAchievement(db, user.id, achievementId);
    });
    res.json(await getAchievements(db, user.id));
  });
  app.get('/api/admin/progression', async (req, res) => {
    await authorization.admin(req);
    res.json(await getAdminProgression(db, quarter(req)));
  });
  app.put('/api/admin/activity/:userId', async (req, res) => {
    const actor = await authorization.admin(req);
    const input = z.object({quarter: quarterSchema, counts: countsSchema}).parse(req.body);
    const userId = String(req.params.userId);
    await transaction(db, async () => {
      await authorization.admin(req);
      await setActivityCounts(db, userId, input.quarter, input.counts);
      await authorization.audit(actor.id, userId, 'activity.update', input);
    });
    res.json({ok: true});
  });
  app.post('/api/admin/achievements', async (req, res) => {
    const actor = await authorization.admin(req);
    const input = z
      .object({
        name: z.string().trim().min(2).max(40),
        description: z.string().trim().min(1).max(160),
        metric: metricSchema,
        target: z.number().int().min(1).max(1000000),
      })
      .parse(req.body);
    if (await db.prepare('SELECT id FROM achievementDefinitions WHERE name=?').get(input.name))
      throw new ApiError(409, '이미 같은 이름의 업적이 있습니다.');
    const achievement = {id: randomUUID(), ...input};
    await transaction(db, async () => {
      await authorization.admin(req);
      await db
        .prepare('INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES(?,?,?,?,?)')
        .run(achievement.id, input.name, input.description, input.metric, input.target);
      await authorization.audit(actor.id, achievement.id, 'achievement.create', input);
    });
    res.status(201).json({achievement});
  });
  app.delete('/api/admin/achievements/:id', async (req, res) => {
    const actor = await authorization.admin(req);
    const id = String(req.params.id);
    await transaction(db, async () => {
      await authorization.admin(req);
      const result = await db.prepare('DELETE FROM achievementDefinitions WHERE id=?').run(id);
      if (!result.changes) throw new ApiError(404, '업적을 찾을 수 없습니다.');
      await authorization.audit(actor.id, id, 'achievement.delete', {});
    });
    res.json({ok: true});
  });
}
