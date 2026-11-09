import {fileURLToPath, URL} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {renderSiteMetadata} from './server/metadata.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'deployment-metadata',
      apply: 'build',
      transformIndexHtml: html => renderSiteMetadata(html, process.env.APP_ORIGIN ?? 'http://localhost:4173'),
    },
  ],
  envDir: 'deploy',
  resolve: {alias: {'@': fileURLToPath(new URL('./src', import.meta.url))}},
});
