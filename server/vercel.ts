import {createApp} from './app';
import {openPostgresDatabase} from './database';
import {supabaseImageStorage} from './image-storage';

const origin = process.env.APP_ORIGIN;
if (!origin || new URL(origin).origin !== origin || !origin.startsWith('https://'))
  throw new Error('APP_ORIGIN must be an exact HTTPS origin');
if (!process.env.VERCEL) throw new Error('This entry point requires the Vercel runtime');
const app = createApp({
  db: openPostgresDatabase(),
  origin,
  secureCookies: true,
  trustProxy: 1,
  imageStorage: supabaseImageStorage(),
});
export default app;
