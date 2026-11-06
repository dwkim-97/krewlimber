import type {DatabaseSync} from 'node:sqlite';
import type {Express} from 'express';
import {z} from 'zod';
import {gymColors, todayInSeoul} from '../src/consts/climbing';
import type {BoardAuthorization} from './board-auth';
import catalog from './gyms.catalog.json';
import {catalogGyms, canonicalGymId} from './gym-catalog';
import {transaction} from './db';
import {ApiError} from './errors';
import {climbRecords, climbingSummary, findGym, saveClimb} from './climbing';
import {clearUnearnedFeaturedAchievement} from './progression';

const inputSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(value => {
        const date = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value >= '1900-01-01' &&
          value <= todayInSeoul(new Date())
        );
      }, '오늘 또는 이전의 올바른 날짜를 선택해주세요.'),
    gymId: z.string().min(1).max(30),
    colors: z
      .array(
        z
          .object({
            key: z.string().min(1).max(40),
            name: z.string().trim().min(1).max(20),
            hex: z
              .string()
              .regex(/^#[a-fA-F0-9]{6}$/)
              .toLowerCase(),
            count: z.number().int().min(1).max(1000),
          })
          .strict()
      )
      .max(32),
  })
  .strict();
export function registerClimbingRoutes(app: Express, db: DatabaseSync, authorization: BoardAuthorization) {
  app.get('/api/gyms', (req, res) => {
    authorization.member(req);
    res.json({...catalog, gyms: catalogGyms()});
  });
  app.get('/api/me/climbs', (req, res) => {
    const user = authorization.member(req);
    res.json({records: climbRecords(db, user.id)});
  });
  app.get('/api/me/climbing-summary', (req, res) => {
    const user = authorization.member(req);
    res.json(climbingSummary(db, user.id));
  });
  function input(body: unknown) {
    const data = inputSchema.parse(body);
    data.gymId = canonicalGymId(data.gymId);
    const gym = findGym(db, data.gymId);
    if (!gym) throw new ApiError(400, '목록에서 암장을 선택해주세요.');
    const palette = gymColors(gym.franchiseId);
    const seen = new Set<string>();
    for (const color of data.colors) {
      if (seen.has(color.key)) throw new ApiError(400, '같은 색상은 한 번만 입력해주세요.');
      seen.add(color.key);
      if (color.key === `custom-${color.hex.slice(1)}`) continue;
      const preset = palette.find(c => c.key === color.key);
      if (!preset || preset.name !== color.name || preset.hex !== color.hex)
        throw new ApiError(400, '암장의 색상을 다시 선택해주세요.');
    }
    return data;
  }
  app.post('/api/me/climbs', (req, res) => {
    const user = authorization.member(req);
    const data = input(req.body);
    const id = transaction(db, () => {
      const id = saveClimb(db, user.id, null, data);
      authorization.audit(user.id, id, 'climb.create', {date: data.date, gymId: data.gymId});
      return id;
    });
    res.status(201).json({record: climbRecords(db, user.id).find(r => r.id === id)});
  });
  app.put('/api/me/climbs/:id', (req, res) => {
    const user = authorization.member(req);
    const data = input(req.body);
    const id = String(req.params.id);
    transaction(db, () => {
      saveClimb(db, user.id, id, data);
      clearUnearnedFeaturedAchievement(db, user.id);
      authorization.audit(user.id, id, 'climb.update', {date: data.date, gymId: data.gymId});
    });
    res.json({record: climbRecords(db, user.id).find(r => r.id === id)});
  });
  app.delete('/api/me/climbs/:id', (req, res) => {
    const user = authorization.member(req);
    const id = String(req.params.id);
    transaction(db, () => {
      if (!db.prepare('DELETE FROM climbingVisits WHERE id=? AND userId=?').run(id, user.id).changes)
        throw new ApiError(404, '기록을 찾을 수 없습니다.');
      clearUnearnedFeaturedAchievement(db, user.id);
      authorization.audit(user.id, id, 'climb.delete', {});
    });
    res.json({ok: true});
  });
}
