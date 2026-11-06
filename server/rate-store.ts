import type {Options, Store} from 'express-rate-limit';
import type {Database} from './database';

export class DatabaseRateStore implements Store {
  private windowMs = 60000;
  readonly localKeys = false;
  constructor(
    private readonly db: Database,
    readonly prefix: string
  ) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  async increment(key: string) {
    const now = Date.now();
    const reset = now + this.windowMs;
    const row = await this.db
      .prepare(
        `INSERT INTO rateLimits(key,hits,resetAt) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN rateLimits.resetAt<=? THEN 1 ELSE rateLimits.hits+1 END,
      resetAt=CASE WHEN rateLimits.resetAt<=? THEN excluded.resetAt ELSE rateLimits.resetAt END
      RETURNING hits,resetAt`
      )
      .get(this.prefix + key, reset, now, now);
    return {totalHits: Number(row!.hits), resetTime: new Date(Number(row!.resetat ?? row!.resetAt))};
  }
  async decrement(key: string) {
    await this.db.prepare('UPDATE rateLimits SET hits=GREATEST(0,hits-1) WHERE key=?').run(this.prefix + key);
  }
  async resetKey(key: string) {
    await this.db.prepare('DELETE FROM rateLimits WHERE key=?').run(this.prefix + key);
  }
}
