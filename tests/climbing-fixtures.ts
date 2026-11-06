import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {ActivityCounts} from '../src/types';
import {CLIMB_COLORS} from '../src/consts/climbing';
import {clearUnearnedFeaturedAchievement, setActivityCounts} from '../server/progression';

export function setVisitFixture(db: DatabaseSync, userId: string, quarter: string, counts: ActivityCounts) {
  const [year, part] = quarter.split('-Q');
  const month = String((Number(part) - 1) * 3 + 1).padStart(2, '0');
  const prefix = `${year}-${month}`;
  db.prepare('DELETE FROM climbingVisits WHERE userId=? AND date LIKE ?').run(userId, `${prefix}%`);
  const gym = db.prepare("SELECT id FROM climbingGyms WHERE franchiseId='theclimb' LIMIT 1").get() as {id: string};
  const sends = ['red', 'pink', 'purple', 'gray'] as const;
  const visits = Math.max(counts.participation, sends.some(key => counts[key] > 0) ? 1 : 0);
  for (let i = 0; i < visits; i++) {
    const id = randomUUID();
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1 + i)).toISOString().slice(0, 10);
    db.prepare('INSERT INTO climbingVisits VALUES(?,?,?,?,?,?)').run(
      id,
      userId,
      gym.id,
      date,
      '2026-01-01',
      '2026-01-01'
    );
    if (i === 0)
      for (const key of sends)
        if (counts[key]) {
          const c = CLIMB_COLORS.find(c => c.key === key)!;
          db.prepare('INSERT INTO climbingColors VALUES(?,?,?,?,?)').run(id, c.key, c.name, c.hex, counts[key]);
        }
  }
  setActivityCounts(db, userId, quarter, counts);
  clearUnearnedFeaturedAchievement(db, userId);
}
