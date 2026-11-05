import {expect, it} from 'vitest';
import {environmentFile} from '../server/environment';

it('selects the production database environment for server and administrator commands', () => {
  expect(environmentFile({NODE_ENV: 'production'})).toBe('deploy/.env.production');
  expect(environmentFile({})).toBe('deploy/.env.local');
});

it('honors an explicit deployment phase for both entry points', () => {
  expect(environmentFile({NODE_ENV: 'production', PHASE: 'cbt'})).toBe('deploy/.env.cbt');
});
