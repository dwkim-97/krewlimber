import {build} from 'esbuild';
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: '.vercel-build/handler.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  packages: 'external',
});
