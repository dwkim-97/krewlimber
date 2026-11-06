import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {ActivityCounts} from '../src/types';
import {catalogGyms} from './gym-catalog';
import {CLIMB_COLORS, todayInSeoul} from '../src/consts/climbing';

export function seedDemoVisitCounts(db: DatabaseSync, userId: string, quarter: string, counts: ActivityCounts) {
  const [year, part] = quarter.split('-Q');
  const first = new Date(Date.UTC(Number(year), (Number(part) - 1) * 3, 1));
  const end = new Date(Date.UTC(Number(year), Number(part) * 3, 0));
  const today = new Date(`${todayInSeoul(new Date())}T00:00:00Z`);
  const days = Math.max(1, Math.floor((Math.min(end.getTime(), today.getTime()) - first.getTime()) / 86400000) + 1);
  const start = first.toISOString().slice(0, 10),
    last = end.toISOString().slice(0, 10);
  if (
    db.prepare('SELECT id FROM climbingVisits WHERE userId=? AND date BETWEEN ? AND ? LIMIT 1').get(userId, start, last)
  )
    return;
  const gyms = catalogGyms().filter(gym => gym.franchiseId === 'theclimb');
  const metrics = ['red', 'pink', 'purple', 'gray'] as const;
  const n = Math.min(Math.max(counts.participation, metrics.some(key => counts[key] > 0) ? 1 : 0), days * gyms.length);
  for (let i = 0; i < n; i++) {
    const date = new Date(first.getTime() + (i % days) * 86400000).toISOString().slice(0, 10);
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO climbingVisits VALUES(?,?,?,?,?,?)').run(
      id,
      userId,
      gyms[Math.floor(i / days) % gyms.length].id,
      date,
      now,
      now
    );
    for (const key of metrics) {
      const count = Math.floor(counts[key] / n) + (i < counts[key] % n ? 1 : 0);
      if (!count) continue;
      const color = CLIMB_COLORS.find(c => c.key === key)!;
      db.prepare('INSERT INTO climbingColors VALUES(?,?,?,?,?)').run(id, key, color.name, color.hex, count);
    }
  }
}

export function seedExistingDemoClimbs(db: DatabaseSync) {
  const users = db
    .prepare(
      "SELECT id,username FROM users WHERE username IN ('test.admin','test.aiden','test.red','test.host','test.twin','test.badge','test.unset','test.rookie','test.rest')"
    )
    .all() as {id: string; username: string}[];
  for (const user of users) {
    const rows = db.prepare('SELECT quarter,metric,value FROM activityStats WHERE userId=?').all(user.id) as {
      quarter: string;
      metric: keyof ActivityCounts;
      value: number;
    }[];
    const quarters = new Map<string, ActivityCounts>();
    for (const row of rows) {
      const counts = quarters.get(row.quarter) ?? {
        participation: 0,
        hosted: 0,
        attended: 0,
        red: 0,
        pink: 0,
        purple: 0,
        gray: 0,
      };
      counts[row.metric] = row.value;
      quarters.set(row.quarter, counts);
    }
    for (const [quarter, counts] of quarters) seedDemoVisitCounts(db, user.id, quarter, counts);
    if (user.username === 'test.admin') {
      const gym = db
        .prepare("SELECT id FROM climbingGyms WHERE franchiseId='seoulforest' ORDER BY name LIMIT 1")
        .get() as {id: string};
      const date = todayInSeoul(new Date());
      if (
        !db.prepare('SELECT id FROM climbingVisits WHERE userId=? AND gymId=? AND date=?').get(user.id, gym.id, date)
      ) {
        const id = randomUUID(),
          now = new Date().toISOString();
        db.prepare('INSERT INTO climbingVisits VALUES(?,?,?,?,?,?)').run(id, user.id, gym.id, date, now, now);
        const insert = db.prepare('INSERT INTO climbingColors VALUES(?,?,?,?,?)');
        for (const [key, count] of [
          ['green', 8],
          ['blue', 4],
          ['red', 2],
        ] as const) {
          const c = CLIMB_COLORS.find(c => c.key === key)!;
          insert.run(id, key, c.name, c.hex, count);
        }
        insert.run(id, 'custom-17b6aa', '민트', '#17b6aa', 3);
      }
    }
  }
  return {users: users.length};
}
