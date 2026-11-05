import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {Express, Request} from 'express';
import {z} from 'zod';
import type {User} from '../src/types';
import {transaction} from './db';
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
  db: DatabaseSync,
  authorization: {
    user: (req: Request) => User;
    member: (req: Request) => User;
    admin: (req: Request) => User;
    audit: (actorId: string, targetId: string, action: string, details: object) => void;
  }
) {
  function quarter(req: Request) {
    return quarterSchema.parse(req.query.quarter ?? currentQuarter(new Date()));
  }
  app.get('/api/titles', (req, res) => {
    authorization.member(req);
    res.json(getTitleBoard(db, quarter(req)));
  });
  app.get('/api/me/achievements', (req, res) => {
    const user = authorization.user(req);
    res.json(getAchievements(db, user.id));
  });
  app.patch('/api/me/featured-achievement', (req, res) => {
    const user = authorization.user(req);
    const {achievementId} = z.object({achievementId: z.string().min(1).max(64).nullable()}).parse(req.body);
    transaction(db, () => setFeaturedAchievement(db, user.id, achievementId));
    res.json(getAchievements(db, user.id));
  });
  app.get('/api/admin/progression', (req, res) => {
    authorization.admin(req);
    res.json(getAdminProgression(db, quarter(req)));
  });
  app.put('/api/admin/activity/:userId', (req, res) => {
    const actor = authorization.admin(req);
    const input = z.object({quarter: quarterSchema, counts: countsSchema}).parse(req.body);
    const userId = String(req.params.userId);
    transaction(db, () => {
      setActivityCounts(db, userId, input.quarter, input.counts);
      authorization.audit(actor.id, userId, 'activity.update', input);
    });
    res.json({ok: true});
  });
  app.post('/api/admin/achievements', (req, res) => {
    const actor = authorization.admin(req);
    const input = z
      .object({
        name: z.string().trim().min(2).max(40),
        description: z.string().trim().min(1).max(160),
        metric: metricSchema,
        target: z.number().int().min(1).max(1000000),
      })
      .parse(req.body);
    if (db.prepare('SELECT id FROM achievementDefinitions WHERE name=?').get(input.name))
      throw new ApiError(409, '이미 같은 이름의 업적이 있습니다.');
    const achievement = {id: randomUUID(), ...input};
    transaction(db, () => {
      db.prepare('INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES(?,?,?,?,?)').run(
        achievement.id,
        input.name,
        input.description,
        input.metric,
        input.target
      );
      authorization.audit(actor.id, achievement.id, 'achievement.create', input);
    });
    res.status(201).json({achievement});
  });
  app.delete('/api/admin/achievements/:id', (req, res) => {
    const actor = authorization.admin(req);
    const id = String(req.params.id);
    transaction(db, () => {
      const result = db.prepare('DELETE FROM achievementDefinitions WHERE id=?').run(id);
      if (!result.changes) throw new ApiError(404, '업적을 찾을 수 없습니다.');
      authorization.audit(actor.id, id, 'achievement.delete', {});
    });
    res.json({ok: true});
  });
}
