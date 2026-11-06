import {expect, it} from 'vitest';
import catalog from '../server/gyms.catalog.json';
import {canonicalGymId} from '../server/gym-catalog';
import {gymColors} from '../src/consts/climbing';
import {openDatabase} from '../server/db';
import {climbingSummary, saveClimb} from '../server/climbing';

it('keeps Off The Wall separate from The Wall with its own palette and summary', () => {
  expect(canonicalGymId('constructor')).toBe('constructor');
  expect(canonicalGymId('toString')).toBe('toString');
  const off = catalog.gyms.find(g => g.name === '오프더월클라이밍')!;
  const wall = catalog.gyms.find(g => g.name === '더월클라이밍')!;
  expect(off.franchiseId).toBe('offthewall');
  expect(wall.franchiseId).toBe('thewall');
  expect(catalog.gyms.find(g => g.name === '원더월클라이밍')!.franchiseId).not.toBe('thewall');
  expect(gymColors(off.franchiseId).map(c => c.key)).toEqual([
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'navy',
    'purple',
    'brown',
    'black',
    'white',
  ]);
  const db = openDatabase(':memory:');
  try {
    db.prepare(
      "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES('a','catalog.test','hash','카탈로그','member','approved','2026-01-01')"
    ).run();
    saveClimb(db, 'a', null, {date: '2026-10-01', gymId: off.id, colors: []});
    saveClimb(db, 'a', null, {date: '2026-10-01', gymId: wall.id, colors: []});
    expect(
      climbingSummary(db, 'a')
        .groups.map(g => g.franchiseId)
        .sort()
    ).toEqual(['offthewall', 'theclimb']);
  } finally {
    db.close();
  }
});
