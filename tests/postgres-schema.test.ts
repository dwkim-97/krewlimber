import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {expect, it} from 'vitest';

it('creates the application schema with account uniqueness, ledger constraints and rollback', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(readFileSync('supabase/migrations/202611060001_initial.sql', 'utf8'));
    await db.query(
      "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES ('u1','ed.el','hash','에드','member','approved','2026-11-06')"
    );
    await expect(
      db.query(
        "INSERT INTO users(id,username,passwordHash,nickname,role,status,createdAt) VALUES ('u2','ED.EL','hash','에드','member','pending','2026-11-06')"
      )
    ).rejects.toThrow();
    await db.query(
      "INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt,requestId) VALUES ('u1',100,'테스트','u1','grant','2026-11-06','request-1')"
    );
    await expect(
      db.query(
        "INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt,requestId) VALUES ('u1',100,'테스트','u1','grant','2026-11-06','request-1')"
      )
    ).rejects.toThrow();
    await expect(
      db.query(
        "INSERT INTO pointLedger(userId,amount,reason,actorId,kind,createdAt) VALUES ('u1',0,'테스트','u1','grant','2026-11-06')"
      )
    ).rejects.toThrow();
    await db.exec('BEGIN');
    await db.query("UPDATE users SET nickname='변경' WHERE id='u1'");
    await db.exec('ROLLBACK');
    expect((await db.query<{nickname: string}>("SELECT nickname FROM users WHERE id='u1'")).rows[0].nickname).toBe(
      '에드'
    );
    expect((await db.query('SELECT * FROM achievementDefinitions')).rows).toHaveLength(8);
    const tables = await db.query<{relrowsecurity: boolean}>(
      "SELECT relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'"
    );
    expect(tables.rows.length).toBeGreaterThan(10);
    expect(tables.rows.every(row => row.relrowsecurity)).toBe(true);
    await db.exec('SET ROLE anon');
    await expect(db.query('SELECT * FROM users')).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30000);
