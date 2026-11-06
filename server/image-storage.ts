import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ApiError} from './errors';

export interface ImageStorage {
  put(filename: string, bytes: Buffer): Promise<void>;
  get(filename: string): Promise<Buffer>;
}
export function localImageStorage(directory: string): ImageStorage {
  return {
    async put(filename, bytes) {
      await mkdir(directory, {recursive: true});
      const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, bytes, {flag: 'wx'});
        await rename(temporaryPath, join(directory, filename));
      } finally {
        await rm(temporaryPath, {force: true});
      }
    },
    async get(filename) {
      try {
        return await readFile(join(directory, filename));
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
          throw new ApiError(404, '이미지를 찾을 수 없습니다.');
        throw error;
      }
    },
  };
}
export function supabaseImageStorage(environment: NodeJS.ProcessEnv = process.env): ImageStorage {
  const origin = environment.SUPABASE_URL;
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key || new URL(origin).protocol !== 'https:')
    throw new Error('Missing Supabase Storage configuration');
  const base = `${origin}/storage/v1/object`;
  const bucket = environment.SUPABASE_STORAGE_BUCKET ?? 'market-images';
  const headers: Record<string, string> = {apikey: key};
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  function path(filename: string) {
    if (!/^[a-f0-9]{64}\.webp$/.test(filename)) throw new Error('Invalid storage filename');
    return `${encodeURIComponent(bucket)}/${filename}`;
  }
  return {
    async put(filename, bytes) {
      const response = await fetch(`${base}/${path(filename)}`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true'},
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new ApiError(502, '이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    },
    async get(filename) {
      const response = await fetch(`${base}/authenticated/${path(filename)}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 404 || response.status === 400) throw new ApiError(404, '이미지를 찾을 수 없습니다.');
      if (!response.ok) throw new ApiError(502, '이미지를 불러오지 못했습니다.');
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
