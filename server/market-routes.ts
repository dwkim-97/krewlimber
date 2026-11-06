import {randomUUID} from 'node:crypto';
import type {SQLInputValue} from 'node:sqlite';
import type {Database} from './database';
import type {Express, Request} from 'express';
import {z} from 'zod';
import type {Page, Product, MarketOrder} from '../src/types/boards';
import type {BoardAuthorization} from './board-auth';
import {transaction} from './database';
import {ApiError} from './errors';
import {adjustPoints, changeOrder, createMarketOrder, getProduct, getWallet, orderSelect} from './market';

const categorySchema = z.enum(['gear', 'apparel', 'voucher', 'other']);
const productSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(2000),
    imageUrl: z
      .string()
      .trim()
      .max(2000)
      .refine(value => {
        if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password;
        } catch {
          return false;
        }
      }, '이미지는 HTTPS 주소 또는 사이트 내부 경로를 입력해주세요.')
      .nullable(),
    category: categorySchema,
    points: z.number().int().min(1).max(1000000),
    stock: z.number().int().min(0).max(1000000),
    active: z.boolean(),
  })
  .strict();
const pageSchema = z.coerce.number().int().min(1).max(100000);
function pageInfo(req: Request, total: number, pageSize: number) {
  const requested = pageSchema.parse(req.query.page ?? 1);
  const page = Math.min(requested, Math.max(1, Math.ceil(total / pageSize)));
  return {page, pageSize, offset: (page - 1) * pageSize};
}
export function registerMarketRoutes(app: Express, db: Database, auth: BoardAuthorization) {
  async function listProducts(req: Request, admin: boolean): Promise<Page<Product>> {
    const q = z
      .string()
      .trim()
      .max(100)
      .parse(req.query.q ?? '');
    const category = z.union([categorySchema, z.literal('all')]).parse(req.query.category ?? 'all');
    const parts = admin ? [] : ['active=1'];
    const values: SQLInputValue[] = [];
    if (q) {
      parts.push("name LIKE ? ESCAPE '\\'");
      values.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    }
    if (category !== 'all') {
      parts.push('category=?');
      values.push(category);
    }
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    const total = Number(
      (await db.prepare(`SELECT COUNT(*) AS count FROM marketProducts ${where}`).get(...values))!.count
    );
    const {page, pageSize, offset} = pageInfo(req, total, 12);
    const rows = await db
      .prepare(`SELECT * FROM marketProducts ${where} ORDER BY createdAt DESC,id DESC LIMIT ? OFFSET ?`)
      .all(...values, pageSize, offset);
    return {
      items: rows.map(row => ({...row, active: Boolean(row.active)})) as unknown as Product[],
      total,
      page,
      pageSize,
    };
  }
  async function listOrders(req: Request, userId: string | null): Promise<Page<MarketOrder>> {
    const status = z.enum(['all', 'pending', 'completed', 'cancelled']).parse(req.query.status ?? 'all');
    const parts: string[] = [];
    const values: SQLInputValue[] = [];
    if (userId !== null) {
      parts.push('o.userId=?');
      values.push(userId);
    }
    if (status !== 'all') {
      parts.push('o.status=?');
      values.push(status);
    }
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    const total = Number(
      (await db.prepare(`SELECT COUNT(*) AS count FROM marketOrders o ${where}`).get(...values))!.count
    );
    const {page, pageSize, offset} = pageInfo(req, total, 10);
    const items = (await db
      .prepare(`${orderSelect} ${where} ORDER BY o.createdAt DESC,o.id DESC LIMIT ? OFFSET ?`)
      .all(...values, pageSize, offset)) as unknown as MarketOrder[];
    return {items, total, page, pageSize};
  }
  app.get('/api/market/products', async (req, res) => {
    await auth.member(req);
    res.json(await listProducts(req, false));
  });
  app.get('/api/market/products/:id', async (req, res) => {
    await auth.member(req);
    const product = await getProduct(db, String(req.params.id));
    if (!product.active) throw new ApiError(404, '상품을 찾을 수 없습니다.');
    res.json({product});
  });
  app.get('/api/me/wallet', async (req, res) => res.json(await getWallet(db, (await auth.member(req)).id)));
  app.get('/api/me/orders', async (req, res) => res.json(await listOrders(req, (await auth.member(req)).id)));
  app.post('/api/market/orders', async (req, res) => {
    const user = await auth.member(req);
    const data = z
      .object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        requestId: z.string().uuid(),
        productRevision: z.number().int().min(1),
      })
      .strict()
      .parse(req.body);
    const result = await transaction(db, async () => {
      await auth.member(req);
      return await createMarketOrder(
        db,
        user,
        data.productId,
        data.quantity,
        data.requestId,
        data.productRevision,
        auth.audit
      );
    });
    res.status(result.created ? 201 : 200).json({order: result.order});
  });
  app.patch('/api/market/orders/:id/cancel', async (req, res) => {
    const user = await auth.member(req);
    res.json({
      order: await transaction(db, async () => {
        await auth.member(req);
        return await changeOrder(db, user, String(req.params.id), 'cancelled', auth.audit);
      }),
    });
  });
  app.get('/api/admin/market/products', async (req, res) => {
    await auth.admin(req);
    res.json(await listProducts(req, true));
  });
  app.get('/api/admin/market/products/:id', async (req, res) => {
    await auth.admin(req);
    res.json({product: await getProduct(db, String(req.params.id))});
  });
  app.post('/api/admin/market/products', async (req, res) => {
    const actor = await auth.admin(req);
    const p = productSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    await transaction(db, async () => {
      await auth.admin(req);
      await db
        .prepare(
          'INSERT INTO marketProducts(id,name,description,imageUrl,category,points,stock,active,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)'
        )
        .run(id, p.name, p.description, p.imageUrl, p.category, p.points, p.stock, Number(p.active), now, now);
      await auth.audit(actor.id, id, 'product.create', p);
    });
    res.status(201).json({product: await getProduct(db, id)});
  });
  app.patch('/api/admin/market/products/:id', async (req, res) => {
    const actor = await auth.admin(req);
    const {revision, ...p} = productSchema.extend({revision: z.number().int().min(1)}).parse(req.body);
    const id = String(req.params.id);
    await transaction(db, async () => {
      await auth.admin(req);
      if ((await getProduct(db, id)).revision !== revision)
        throw new ApiError(409, '상품 정보가 변경되었습니다. 목록을 새로고침한 뒤 상품을 다시 열어주세요.');
      const reserved = Number(
        (await db
          .prepare(
            "SELECT COALESCE(SUM(quantity),0) AS quantity FROM marketOrders WHERE productId=? AND status='pending'"
          )
          .get(id))!.quantity
      );
      if (p.stock + reserved > 1000000)
        throw new ApiError(400, '대기 중인 교환 수량을 포함해 재고는 1,000,000개까지 설정할 수 있습니다.');
      await db
        .prepare(
          'UPDATE marketProducts SET name=?,description=?,imageUrl=?,category=?,points=?,stock=?,active=?,updatedAt=?,revision=revision+1 WHERE id=?'
        )
        .run(
          p.name,
          p.description,
          p.imageUrl,
          p.category,
          p.points,
          p.stock,
          Number(p.active),
          new Date().toISOString(),
          id
        );
      await auth.audit(actor.id, id, 'product.update', p);
    });
    res.json({product: await getProduct(db, id)});
  });
  app.get('/api/admin/market/orders', async (req, res) => {
    await auth.admin(req);
    res.json(await listOrders(req, null));
  });
  app.patch('/api/admin/market/orders/:id', async (req, res) => {
    const actor = await auth.admin(req);
    const {status} = z
      .object({status: z.enum(['completed', 'cancelled'])})
      .strict()
      .parse(req.body);
    res.json({
      order: await transaction(db, async () => {
        await auth.admin(req);
        return await changeOrder(db, actor, String(req.params.id), status, auth.audit);
      }),
    });
  });
  app.get('/api/admin/points', async (req, res) => {
    await auth.admin(req);
    const userId = z.string().uuid().parse(req.query.userId);
    if (!(await db.prepare('SELECT id FROM users WHERE id=?').get(userId)))
      throw new ApiError(404, '회원을 찾을 수 없습니다.');
    res.json(await getWallet(db, userId));
  });
  app.post('/api/admin/points', async (req, res) => {
    const actor = await auth.admin(req);
    const input = z
      .object({
        userId: z.string().uuid(),
        amount: z
          .number()
          .int()
          .min(-1000000)
          .max(1000000)
          .refine(value => value !== 0),
        reason: z.string().trim().min(2).max(100),
        requestId: z.string().uuid(),
      })
      .strict()
      .parse(req.body);
    const created = await transaction(db, async () => {
      await auth.admin(req);
      const created = await adjustPoints(db, actor.id, input.userId, input.amount, input.reason, input.requestId);
      if (created) await auth.audit(actor.id, input.userId, 'points.adjust', input);
      return created;
    });
    res.status(created ? 201 : 200).json(await getWallet(db, input.userId));
  });
}
