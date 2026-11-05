import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {User} from '../src/types';
import {userColumns} from './auth';
import {transaction} from './db';
import {adjustPoints, changeOrder, createMarketOrder, getProduct} from './market';

export function seedBoardDemo(db: DatabaseSync) {
  const admin = db
    .prepare(`SELECT ${userColumns} FROM users WHERE username='test.admin' AND role='admin' AND status='approved'`)
    .get() as unknown as User | undefined;
  if (!admin) throw new Error('Create the existing preview test accounts first.');
  const audit = (actorId: string, targetId: string, action: string, details: object) => {
    db.prepare('INSERT INTO auditLog(actorId,targetId,action,details,createdAt) VALUES(?,?,?,?,?)').run(
      actorId,
      targetId,
      action,
      JSON.stringify(details),
      new Date().toISOString()
    );
  };
  const products = [
    [
      '11111111-1111-4111-8111-111111111101',
      '초크 리필 팩',
      '오늘도 뽀송한 손끝으로. 교환 후 운영진에게 수령해주세요.',
      'gear',
      300,
      20,
      null,
    ],
    ['11111111-1111-4111-8111-111111111102', '크루 초크백', '한 홀드 더 오르기 위한 작은 가방.', 'gear', 900, 8, null],
    [
      '11111111-1111-4111-8111-111111111103',
      '크루라이머 티셔츠',
      '암장에서도 일상에서도 함께 입어요. 사이즈는 수령 시 확인합니다.',
      'apparel',
      800,
      12,
      null,
    ],
    [
      '11111111-1111-4111-8111-111111111104',
      '더클라임 일일 이용권',
      '클라이밍 하루를 포인트로 교환해요. 사용 지점과 일정은 운영진에게 확인해주세요.',
      'voucher',
      1200,
      6,
      null,
    ],
    [
      '11111111-1111-4111-8111-111111111105',
      '크루라이머 스티커 팩',
      '초크백과 물병에 우리 크루의 흔적을 남겨요.',
      'other',
      200,
      30,
      '/chun-sik-02.webp',
    ],
    [
      '11111111-1111-4111-8111-111111111106',
      '클라이밍 테이프',
      '손가락의 든든한 지원군. 현재 재입고를 기다리고 있어요.',
      'gear',
      150,
      0,
      null,
    ],
    [
      '11111111-1111-4111-8111-111111111107',
      '한정판 크루 후디',
      '완등 후에도 따뜻하게. 오래 모은 포인트를 꺼낼 시간.',
      'apparel',
      5000,
      3,
      null,
    ],
    ['11111111-1111-4111-8111-111111111108', '이전 시즌 굿즈', '판매 중지된 테스트 상품입니다.', 'other', 100, 0, null],
  ] as const;
  transaction(db, () => {
    products.forEach((p, index) => {
      const time = new Date(Date.now() - index * 60000).toISOString();
      db.prepare(
        'INSERT OR IGNORE INTO marketProducts(id,name,description,category,points,stock,imageUrl,active,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)'
      ).run(...p, index === 7 ? 0 : 1, time, time);
    });
    const topics = [
      '크루라이머 이용 안내',
      '포인트 마켓 오픈 안내',
      '11월 정기 클라이밍 모임',
      '함께 지켜요, 암장 에티켓',
      '처음 오신 크루를 환영합니다',
      '번개 모임을 여는 방법',
      '포인트 지급과 교환 안내',
      '사진 공유 시 서로 확인해주세요',
      '부상 예방을 위한 준비 운동',
      '이번 달 추천 암장',
      '크루 티셔츠 수령 안내',
      '모임 장소 변경 안내',
      '처음 도전하는 색상도 함께',
      '다음 모임에서 만나요',
    ];
    topics.forEach((title, index) => {
      const id = `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`;
      const time = new Date(Date.now() - index * 86400000).toISOString();
      db.prepare(
        'INSERT OR IGNORE INTO notices(id,title,body,pinned,authorId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)'
      ).run(
        id,
        title,
        `${title}\n\n크루가 함께 확인할 수 있도록 준비한 테스트 공지입니다.\n\n포인트 상품은 신청 시 포인트가 차감되며, 처리 전 취소하면 돌려받습니다. 모임과 수령 관련 내용은 운영진에게 문의해주세요.`,
        index < 2 ? 1 : 0,
        admin.id,
        time,
        time
      );
    });
    const users = db
      .prepare(`SELECT ${userColumns} FROM users WHERE username LIKE 'test.%' AND status='approved'`)
      .all() as unknown as User[];
    for (const user of users) {
      const reason = '화면 확인용 초기 포인트';
      if (!db.prepare("SELECT id FROM pointLedger WHERE userId=? AND kind='grant' AND reason=?").get(user.id, reason))
        adjustPoints(
          db,
          admin.id,
          user.id,
          user.username === 'test.admin'
            ? 3200
            : user.username === 'test.aiden'
              ? 5000
              : user.username === 'test.rookie'
                ? 50
                : 600,
          reason,
          null
        );
    }
    if (!db.prepare('SELECT id FROM marketOrders WHERE userId=?').get(admin.id)) {
      createMarketOrder(db, admin, products[0][0], 1, randomUUID(), getProduct(db, products[0][0]).revision, audit);
      const done = createMarketOrder(
        db,
        admin,
        products[3][0],
        1,
        randomUUID(),
        getProduct(db, products[3][0]).revision,
        audit
      );
      changeOrder(db, admin, done.order.id, 'completed', audit);
      const cancelled = createMarketOrder(
        db,
        admin,
        products[2][0],
        1,
        randomUUID(),
        getProduct(db, products[2][0]).revision,
        audit
      );
      changeOrder(db, admin, cancelled.order.id, 'cancelled', audit);
    }
  });
  return {notices: 14, products: products.length};
}
