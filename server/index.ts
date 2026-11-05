import {resolve} from 'node:path';
import express from 'express';
import {config} from 'dotenv';
import {createApp} from './app';
import {openDatabase} from './db';
import {environmentFile} from './environment';

const production = process.env.NODE_ENV === 'production';
config({path: resolve(environmentFile(process.env)), quiet: true});
const port = Number(process.env.PORT ?? 4173);
const origin = process.env.APP_ORIGIN ?? (production ? '' : `http://localhost:${port}`);
const trustProxy = process.env.TRUST_PROXY || false;
if (production && !trustProxy) throw new Error('Production requires TRUST_PROXY with the exact proxy IP or CIDR.');
if (!origin || (production && !origin.startsWith('https://')))
  throw new Error('Production requires an HTTPS APP_ORIGIN.');
if (new URL(origin).origin !== origin)
  throw new Error('APP_ORIGIN must be an origin without a trailing slash or path.');
const db = openDatabase(process.env.DATABASE_PATH ?? './data/krewlimber.sqlite');
const app = createApp({db, origin, secureCookies: production, trustProxy});

if (production) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const {createServer} = await import('vite');
  const vite = await createServer({server: {middlewareMode: true, hmr: {port: port + 1}}, appType: 'spa'});
  app.use(vite.middlewares);
}
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`KREWLIMBER: ${origin}`));
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
