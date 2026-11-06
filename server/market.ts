import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {MarketOrder, Product, Wallet} from '../src/types/boards';
import type {User} from '../src/types';
import type {BoardAuthorization} from './board-auth';
import {ApiError} from './errors';
import {clearUnearnedFeaturedAchievement} from './progression';

export function pointBalance(db: DatabaseSync, userId: string): number {
  return Number(
    db.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM pointLedger WHERE userId=?').get(userId)!.balance
  );
}
export function getWallet(db: DatabaseSync, userId: string): Wallet {
  return {
    balance: pointBalance(db, userId),
    entries: db
      .prepare(
        `SELECT l.id,l.amount,l.reason,l.createdAt,u.nickname AS actor FROM pointLedger l
      JOIN users u ON u.id=l.actorId WHERE l.userId=? ORDER BY l.id DESC LIMIT 20`
      )
      .all(userId) as unknown as Wallet['entries'],
  };
}
export function getProduct(db: DatabaseSync, id: string): Product {
  const row = db.prepare('SELECT * FROM marketProducts WHERE id=?').get(id);
  if (!row) throw new ApiError(404, '상품을 찾을 수 없습니다.');
  return {...row, active: Boolean(row.active)} as unknown as Product;
}
export const orderSelect = `SELECT o.id,o.userId,u.username,u.nickname,o.productId,o.productName,o.imageUrl,o.points,o.quantity,o.total,o.status,o.createdAt,o.updatedAt FROM marketOrders o JOIN users u ON u.id=o.userId`;
export function getOrder(db: DatabaseSync, id: string): MarketOrder {
  const row = db.prepare(`${orderSelect} WHERE o.id=?`).get(id);
  if (!row) throw new ApiError(404, '교환 신청을 찾을 수 없습니다.');
  return row as unknown as MarketOrder;
}
export function adjustPoints(
  db: DatabaseSync,
  actorId: string,
  userId: string,
  amount: number,
  reason: string,
  requestId: string | null
): boolean {
  if (requestId !== null) {
    const existing = db
      .prepare('SELECT userId,amount,reason FROM pointLedger WHERE actorId=? AND requestId=?')
      .get(actorId, requestId);
    if (existing) {
      if (existing.userId !== userId || existing.amount !== amount || existing.reason !== reason)
        throw new ApiError(409, '이미 사용한 포인트 작업 번호입니다. 새 작업을 시작해주세요.');
      return false;
    }
  }
  if (!db.prepare("SELECT id FROM users WHERE id=? AND status='approved'").get(userId))
    throw new ApiError(400, '활동 중인 회원을 선택해주세요.');
  const next = pointBalance(db, userId) + amount;
  if (!Number.isSafeInteger(next) || next < 0) throw new ApiError(409, '보유 포인트보다 많이 차감할 수 없습니다.');
  db.prepare(
    "INSERT INTO pointLedger(userId,amount,reason,actorId,orderId,kind,createdAt,requestId) VALUES(?,?,?,?,NULL,'grant',?,?)"
  ).run(userId, amount, reason, actorId, new Date().toISOString(), requestId);
  if (amount < 0) clearUnearnedFeaturedAchievement(db, userId);
  return true;
}
export function createMarketOrder(
  db: DatabaseSync,
  user: User,
  productId: string,
  quantity: number,
  requestId: string,
  productRevision: number,
  audit: BoardAuthorization['audit']
) {
  const existing = db
    .prepare('SELECT id,productId,quantity FROM marketOrders WHERE userId=? AND requestId=?')
    .get(user.id, requestId);
  if (existing) {
    if (existing.productId !== productId || existing.quantity !== quantity)
      throw new ApiError(409, '이미 사용한 신청 번호입니다. 새 신청을 진행해주세요.');
    return {order: getOrder(db, String(existing.id)), created: false};
  }
  const product = getProduct(db, productId);
  if (product.revision !== productRevision)
    throw new ApiError(409, '상품 정보가 변경되었습니다. 새 가격과 재고를 확인한 뒤 다시 신청해주세요.');
  if (!product.active) throw new ApiError(409, '판매가 중지된 상품입니다.');
  if (product.stock < quantity) throw new ApiError(409, '상품 재고가 부족합니다.');
  const total = product.points * quantity;
  if (pointBalance(db, user.id) < total) throw new ApiError(409, '보유 포인트가 부족합니다.');
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO marketOrders(id,userId,productId,productName,imageUrl,points,quantity,total,status,requestId,createdAt,updatedAt)
    VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?)`
  ).run(id, user.id, productId, product.name, product.imageUrl, product.points, quantity, total, requestId, now, now);
  db.prepare('UPDATE marketProducts SET stock=stock-?,updatedAt=?,revision=revision+1 WHERE id=?').run(
    quantity,
    now,
    productId
  );
  db.prepare(
    "INSERT INTO pointLedger(userId,amount,reason,actorId,orderId,kind,createdAt) VALUES(?,?,?,?,?,'purchase',?)"
  ).run(user.id, -total, `상품 교환 · ${product.name}`, user.id, id, now);
  audit(user.id, id, 'order.create', {productId, quantity, total});
  return {order: getOrder(db, id), created: true};
}
export function changeOrder(
  db: DatabaseSync,
  actor: User,
  id: string,
  status: 'completed' | 'cancelled',
  audit: BoardAuthorization['audit']
): MarketOrder {
  const order = getOrder(db, id);
  if (actor.role !== 'admin' && actor.id !== order.userId) throw new ApiError(404, '교환 신청을 찾을 수 없습니다.');
  if (status === 'completed' && actor.role !== 'admin') throw new ApiError(403, '관리자 권한이 필요합니다.');
  if (order.status === status) return order;
  if (order.status !== 'pending') throw new ApiError(409, '처리가 끝난 신청은 변경할 수 없습니다.');
  const now = new Date().toISOString();
  if (status === 'cancelled') {
    db.prepare('UPDATE marketProducts SET stock=stock+?,updatedAt=?,revision=revision+1 WHERE id=?').run(
      order.quantity,
      now,
      order.productId
    );
    db.prepare(
      "INSERT INTO pointLedger(userId,amount,reason,actorId,orderId,kind,createdAt) VALUES(?,?,?,?,?,'refund',?)"
    ).run(order.userId, order.total, `교환 취소 · ${order.productName}`, actor.id, id, now);
  }
  db.prepare('UPDATE marketOrders SET status=?,updatedAt=? WHERE id=?').run(status, now, id);
  if (status === 'cancelled') clearUnearnedFeaturedAchievement(db, order.userId);
  audit(actor.id, id, `order.${status}`, {total: order.total});
  return getOrder(db, id);
}
