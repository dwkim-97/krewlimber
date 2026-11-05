// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, it} from 'vitest';
import {renderSiteMetadata} from '../server/metadata';

it.each(['http://127.0.0.1:4177', 'https://crew.example.com'])(
  'renders social metadata using the runtime site origin %s',
  origin => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    const document = new DOMParser().parseFromString(renderSiteMetadata(html, origin), 'text/html');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      `${origin}/chun-sik-02.webp`
    );
    expect(document.querySelector('meta[property="og:image:type"]')?.getAttribute('content')).toBe('image/webp');
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      `${origin}/chun-sik-02.webp`
    );
    expect(new URL(document.querySelector('link[rel="icon"]')!.getAttribute('href')!, origin).href).toBe(
      `${origin}/chun-sik-01.webp`
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(origin);
  }
);
