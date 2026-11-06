import {createHash, randomUUID} from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import type {Database} from './database';
import {transaction} from './database';
import type {BoardAuthorization} from './board-auth';
import {ApiError} from './errors';
import {getAchievements} from './progression';
import {gymIdentity, gymDisplayName} from '../src/consts/gym-identity';

const text = z.string().trim().min(1).max(100);
const gradeSchema = z.object({name: z.string().trim().min(1).max(30), color: z.string().regex(/^#[0-9a-fA-F]{6}$/)});
const gymSchema = z
  .object({
    name: text,
    brandName: text.optional(),
    branchName: z.string().trim().max(100).optional(),
    placeId: z.string().regex(/^\d+$/).max(30).nullable().default(null),
    grades: z.array(gradeSchema).max(40).default([]),
    address: z.string().trim().max(200).default(''),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
  })
  .refine(x => (x.latitude === null) === (x.longitude === null), '위도와 경도를 함께 입력해주세요.')
  .refine(x => new Set(x.grades.map(g => g.name.toLowerCase())).size === x.grades.length, '난이도 이름이 중복됩니다.');

const visitSchema = z
  .object({
    requestId: z.string().uuid(),
    gymId: text,
    visitedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(s => {
        const d = new Date(s + 'T00:00:00Z');
        return (
          !isNaN(d.getTime()) &&
          d.toISOString().slice(0, 10) === s &&
          s <=
            new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date())
        );
      }, '오늘 이전의 올바른 날짜를 입력해주세요.'),
    note: z.string().trim().max(500).default(''),
    sends: z
      .array(z.object({gradeId: text, count: z.number().int().min(1).max(999)}))
      .min(1)
      .max(50),
  })
  .refine(x => new Set(x.sends.map(s => s.gradeId)).size === x.sends.length, '같은 난이도는 한 번만 입력해주세요.');
export function registerClimbingRoutes(app: Express, db: Database, auth: BoardAuthorization) {
  async function catalog() {
    const gyms = await db
      .prepare('SELECT id,name,brandName,branchName,address,latitude,longitude,placeId FROM gyms ORDER BY name')
      .all();
    const grades = await db.prepare('SELECT id,gymId,name,color FROM gymGrades ORDER BY sortOrder,createdAt,id').all();
    return gyms.map(g => {
      const own = grades.filter(d => d.gymId === g.id);
      return {
        ...g,
        ...gymIdentity({name: String(g.name), brandName: String(g.brandName), branchName: String(g.branchName)}),
        id: String(g.id),
        name: String(g.name),
        address: String(g.address),
        grades: own,
        revision: createHash('sha256')
          .update(JSON.stringify({...g, grades: own}))
          .digest('hex'),
      };
    });
  }
  async function visits(userId: string) {
    const rows = await db
      .prepare(
        'SELECT v.*,g.name AS gymName FROM climbingVisits v JOIN gyms g ON g.id=v.gymId WHERE v.userId=? ORDER BY v.visitedOn DESC,v.createdAt DESC'
      )
      .all(userId);
    const sends = await db
      .prepare(
        'SELECT s.visitId,s.gradeId,s.count,d.name,d.color FROM visitSends s JOIN gymGrades d ON d.id=s.gradeId JOIN climbingVisits v ON v.id=s.visitId WHERE v.userId=? ORDER BY d.name'
      )
      .all(userId);
    return rows.map(v => ({
      ...v,
      id: String(v.id),
      gymId: String(v.gymId),
      gymName: String(v.gymName),
      visitedOn: String(v.visitedOn),
      note: String(v.note),
      sends: sends.filter(s => s.visitId === v.id),
    }));
  }
  app.get('/api/gyms', async (req, res) => {
    await auth.member(req);
    res.json({gyms: await catalog()});
  });
  app.post('/api/gyms', async (req, res) => {
    const actor = await auth.member(req),
      parsed = gymSchema.parse(req.body),
      identity = gymIdentity(parsed),
      input = {...parsed, ...identity, name: gymDisplayName(identity.brandName, identity.branchName)},
      id = randomUUID();
    await transaction(db, async () => {
      await auth.member(req);
      if (input.placeId && (await db.prepare('SELECT id FROM gyms WHERE placeId=?').get(input.placeId)))
        throw new ApiError(409, '이미 등록된 카카오 장소입니다. 공용 암장 목록에서 찾아주세요.');
      if (
        await db
          .prepare('SELECT id FROM gyms WHERE lower(name)=lower(?) AND lower(address)=lower(?)')
          .get(input.name, input.address)
      )
        throw new ApiError(409, '이미 등록된 암장입니다.');
      await db
        .prepare(
          'INSERT INTO gyms(id,name,brandName,branchName,address,latitude,longitude,placeId,createdBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)'
        )
        .run(
          id,
          input.name,
          input.brandName,
          input.branchName,
          input.address,
          input.latitude,
          input.longitude,
          input.placeId,
          actor.id,
          new Date().toISOString()
        );
      for (const [index, grade] of input.grades.entries())
        await db
          .prepare('INSERT INTO gymGrades(id,gymId,name,color,createdBy,createdAt,sortOrder) VALUES(?,?,?,?,?,?,?)')
          .run(randomUUID(), id, grade.name, grade.color, actor.id, new Date().toISOString(), index);
      await auth.audit(actor.id, id, 'gym.create', input);
    });
    res.status(201).json({gym: (await catalog()).find(g => g.id === id)});
  });
  app.patch('/api/gyms/:id', async (req, res) => {
    const actor = await auth.member(req),
      id = String(req.params.id);
    const input = z
      .object({
        revision: z.string().regex(/^[a-f0-9]{64}$/),
        name: text,
        brandName: text.optional(),
        branchName: z.string().trim().max(100).optional(),
        location: z
          .object({
            placeId: z.string().regex(/^\d+$/).max(30),
            address: z.string().trim().min(1).max(200),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
          .optional(),
        grades: z.array(gradeSchema.extend({id: z.string().min(1).max(100).optional()})).max(40),
      })
      .refine(
        x => new Set(x.grades.map(g => g.name.toLowerCase())).size === x.grades.length,
        '난이도 이름이 중복됩니다.'
      )
      .refine(x => {
        const ids = x.grades.filter(g => g.id).map(g => g.id);
        return new Set(ids).size === ids.length;
      }, '같은 난이도가 중복됩니다.')
      .parse(req.body);
    await transaction(db, async () => {
      await auth.member(req);
      const before = (await catalog()).find(g => g.id === id);
      if (!before) throw new ApiError(404, '암장을 찾을 수 없습니다.');
      if (before.revision !== input.revision)
        throw new ApiError(409, '다른 회원이 먼저 수정했어요. 새로고침 후 다시 수정해주세요.');
      const duplicate = await db
        .prepare('SELECT id FROM gyms WHERE id<>? AND lower(name)=lower(?) AND lower(address)=lower(?)')
        .get(id, input.name, input.location?.address ?? before.address);
      if (duplicate) throw new ApiError(409, '같은 이름과 주소의 암장이 이미 등록되어 있어요.');
      for (const grade of input.grades)
        if (grade.id && !before.grades.some(g => g.id === grade.id))
          throw new ApiError(400, '이 암장에 속한 난이도만 수정할 수 있습니다.');
      const deleted = before.grades.filter(g => !input.grades.some(next => next.id === g.id));
      for (const grade of deleted) {
        if (
          await db
            .prepare('SELECT achievementId FROM achievementConditions WHERE gradeId=? LIMIT 1')
            .get(String(grade.id))
        )
          throw new ApiError(409, '업적 기준에 사용된 난이도는 삭제할 수 없어요. 먼저 해당 업적을 삭제해주세요.');
        if (await db.prepare('SELECT visitId FROM visitSends WHERE gradeId=? LIMIT 1').get(String(grade.id)))
          throw new ApiError(409, '등반 기록에 사용된 난이도는 삭제할 수 없어요.');
      }
      if (input.location) {
        const other = await db.prepare('SELECT id FROM gyms WHERE placeId=? AND id<>?').get(input.location.placeId, id);
        if (other) throw new ApiError(409, '이미 등록된 다른 암장의 위치입니다.');
        await db
          .prepare('UPDATE gyms SET address=?,latitude=?,longitude=?,placeId=? WHERE id=?')
          .run(input.location.address, input.location.latitude, input.location.longitude, input.location.placeId, id);
      }
      const identity = gymIdentity(input);
      await db
        .prepare('UPDATE gyms SET name=?,brandName=?,branchName=? WHERE id=?')
        .run(gymDisplayName(identity.brandName, identity.branchName), identity.brandName, identity.branchName, id);
      for (const grade of before.grades)
        await db.prepare('UPDATE gymGrades SET name=? WHERE id=?').run(`__editing_${randomUUID()}`, String(grade.id));
      for (const grade of deleted) await db.prepare('DELETE FROM gymGrades WHERE id=?').run(String(grade.id));
      for (const [order, grade] of input.grades.entries()) {
        if (grade.id)
          await db
            .prepare('UPDATE gymGrades SET name=?,color=?,sortOrder=? WHERE id=? AND gymId=?')
            .run(grade.name, grade.color, order, grade.id, id);
        if (grade.id)
          await db
            .prepare('UPDATE achievementConditions SET difficultyRank=? WHERE gradeId=?')
            .run(order + 1, grade.id);
        else
          await db
            .prepare('INSERT INTO gymGrades(id,gymId,name,color,createdBy,createdAt,sortOrder) VALUES(?,?,?,?,?,?,?)')
            .run(randomUUID(), id, grade.name, grade.color, actor.id, new Date().toISOString(), order);
      }
      await auth.audit(actor.id, id, 'gym.update', {before, after: input});
    });
    res.json({gym: (await catalog()).find(g => g.id === id)});
  });
  app.patch('/api/gyms/:id/location', async (req, res) => {
    const user = await auth.member(req),
      id = String(req.params.id);
    const input = z
      .object({
        address: z.string().trim().min(1).max(200),
        placeId: z.string().regex(/^\d+$/).max(30).nullable().default(null),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .parse(req.body);
    await transaction(db, async () => {
      await auth.member(req);
      const gym = await db.prepare('SELECT id,latitude,longitude FROM gyms WHERE id=?').get(id);
      if (!gym) throw new ApiError(404, '암장을 찾을 수 없습니다.');
      if (gym.latitude !== null || gym.longitude !== null) throw new ApiError(409, '이미 위치가 연결된 암장입니다.');
      if (input.placeId && (await db.prepare('SELECT id FROM gyms WHERE placeId=?').get(input.placeId)))
        throw new ApiError(409, '이미 등록된 카카오 장소입니다.');
      await db
        .prepare('UPDATE gyms SET address=?,latitude=?,longitude=?,placeId=? WHERE id=?')
        .run(input.address, input.latitude, input.longitude, input.placeId, id);
      await auth.audit(user.id, id, 'gym.location.add', input);
    });
    res.json({gym: (await catalog()).find(g => g.id === id)});
  });
  app.post('/api/gyms/:id/grades', async (req, res) => {
    const actor = await auth.member(req),
      gymId = String(req.params.id),
      input = gradeSchema.parse(req.body),
      id = randomUUID();
    await transaction(db, async () => {
      await auth.member(req);
      if (!(await db.prepare('SELECT id FROM gyms WHERE id=?').get(gymId)))
        throw new ApiError(404, '암장을 찾을 수 없습니다.');
      if (await db.prepare('SELECT id FROM gymGrades WHERE gymId=? AND lower(name)=lower(?)').get(gymId, input.name))
        throw new ApiError(409, '이미 등록된 난이도입니다.');
      const count = await db.prepare('SELECT COUNT(*) AS total FROM gymGrades WHERE gymId=?').get(gymId);
      if (Number(count?.total ?? 0) >= 40) throw new ApiError(400, '난이도는 암장당 40개까지 등록할 수 있어요.');
      const order = await db
        .prepare('SELECT COALESCE(MAX(sortOrder),-1) AS value FROM gymGrades WHERE gymId=?')
        .get(gymId);
      await db
        .prepare('INSERT INTO gymGrades(id,gymId,name,color,createdBy,createdAt,sortOrder) VALUES(?,?,?,?,?,?,?)')
        .run(id, gymId, input.name, input.color, actor.id, new Date().toISOString(), Number(order?.value ?? -1) + 1);
      await auth.audit(actor.id, id, 'gym.grade.create', {gymId, ...input});
    });
    res.status(201).json({grade: {id, gymId, ...input}});
  });
  app.get('/api/me/climbing', async (req, res) => {
    const user = await auth.member(req);
    res.json({visits: await visits(user.id)});
  });
  async function validate(input: z.infer<typeof visitSchema>) {
    if (!(await db.prepare('SELECT id FROM gyms WHERE id=?').get(input.gymId)))
      throw new ApiError(400, '등록된 암장을 선택해주세요.');
    const grades = await db.prepare('SELECT id FROM gymGrades WHERE gymId=?').all(input.gymId);
    if (input.sends.some(s => !grades.some(g => g.id === s.gradeId)))
      throw new ApiError(400, '선택한 암장의 난이도만 기록할 수 있습니다.');
  }
  for (const method of ['post', 'patch'] as const)
    app[method](method === 'post' ? '/api/me/climbing' : '/api/me/climbing/:id', async (req, res) => {
      const user = await auth.member(req),
        input = visitSchema.parse(req.body);
      let id = method === 'post' ? randomUUID() : String((req.params as Record<string, string>).id),
        created = method === 'post';
      await transaction(db, async () => {
        await auth.member(req);
        await validate(input);
        if (method === 'patch') {
          if (!(await db.prepare('SELECT id FROM climbingVisits WHERE id=? AND userId=?').get(id, user.id)))
            throw new ApiError(404, '기록을 찾을 수 없습니다.');
          await db
            .prepare('UPDATE climbingVisits SET gymId=?,visitedOn=?,note=?,updatedAt=? WHERE id=? AND userId=?')
            .run(input.gymId, input.visitedOn, input.note, new Date().toISOString(), id, user.id);
          await db.prepare('DELETE FROM visitSends WHERE visitId=?').run(id);
        } else {
          const previous = await db
            .prepare('SELECT id FROM climbingVisits WHERE userId=? AND requestId=?')
            .get(user.id, input.requestId);
          if (previous) {
            id = String((previous as {id: string}).id);
            const stored = (await visits(user.id)).find(v => v.id === id)!;
            const normalized = (sends: {gradeId: unknown; count: unknown}[]) =>
              JSON.stringify(
                sends
                  .map(s => ({gradeId: s.gradeId, count: s.count}))
                  .sort((a, b) => String(a.gradeId).localeCompare(String(b.gradeId)))
              );
            if (
              stored.gymId !== input.gymId ||
              stored.visitedOn !== input.visitedOn ||
              stored.note !== input.note ||
              normalized(stored.sends as {gradeId: unknown; count: unknown}[]) !== normalized(input.sends)
            )
              throw new ApiError(409, '이 저장 요청은 이미 처리됐어요. 방문 기록을 새로고침한 뒤 수정해주세요.');
            created = false;
            return;
          }
          const now = new Date().toISOString();
          await db
            .prepare(
              'INSERT INTO climbingVisits(id,userId,gymId,visitedOn,note,requestId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)'
            )
            .run(id, user.id, input.gymId, input.visitedOn, input.note, input.requestId, now, now);
        }
        for (const send of input.sends)
          await db
            .prepare('INSERT INTO visitSends(visitId,gradeId,count) VALUES(?,?,?)')
            .run(id, send.gradeId, send.count);
        await auth.audit(user.id, id, `climbing.${method === 'post' ? 'create' : 'update'}`, input);
      });
      res.status(created ? 201 : 200).json({visit: (await visits(user.id)).find(v => v.id === id)});
    });
  app.delete('/api/me/climbing/:id', async (req, res) => {
    const user = await auth.member(req),
      id = String(req.params.id);
    await transaction(db, async () => {
      await auth.member(req);
      const r = await db.prepare('DELETE FROM climbingVisits WHERE id=? AND userId=?').run(id, user.id);
      if (!r.changes) throw new ApiError(404, '기록을 찾을 수 없습니다.');
      await auth.audit(user.id, id, 'climbing.delete', {});
    });
    res.json({ok: true});
  });
  app.get('/api/me/level', async (req, res) => {
    const user = await auth.member(req),
      rows = await visits(user.id),
      achievements = await getAchievements(db, user.id);
    const byGrade = new Map<
      string,
      {gymId: string; gymName: string; gradeId: string; name: string; color: string; count: number}
    >();
    for (const visit of rows)
      for (const send of visit.sends) {
        const key = String(send.gradeId),
          old = byGrade.get(key);
        byGrade.set(key, {
          gymId: String(visit.gymId),
          gymName: String(visit.gymName),
          gradeId: key,
          name: String(send.name),
          color: String(send.color),
          count: (old?.count ?? 0) + Number(send.count),
        });
      }
    res.json({
      level: user.level ?? 0,
      inputs: {
        visits: rows.length,
        sends: [...byGrade.values()].reduce((n, g) => n + g.count, 0),
        gyms: new Set(rows.map(v => v.gymId)).size,
        earnedAchievements: achievements.achievements.filter(a => a.earned).map(a => ({id: a.id, name: a.name})),
        byGrade: [...byGrade.values()],
      },
    });
  });
}
