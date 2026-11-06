import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import express, {type Express} from 'express';
import sharp from 'sharp';
import type {BoardAuthorization} from './board-auth';
import {ApiError} from './errors';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function registerMarketImageRoutes(app: Express, uploadsDir: string, auth: BoardAuthorization) {
  app.post(
    '/api/admin/market/images',
    (req, _res, next) => {
      auth.admin(req);
      if (!imageTypes.has(req.get('Content-Type')?.split(';')[0] ?? ''))
        throw new ApiError(415, 'JPG, PNG, WebP 이미지를 선택해주세요.');
      next();
    },
    express.raw({type: [...imageTypes], limit: 5 * 1024 * 1024, inflate: false}),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ApiError(400, '이미지 파일을 선택해주세요.');
      let bytes: Buffer;
      try {
        const source = sharp(req.body, {limitInputPixels: 25000000, failOn: 'warning'});
        const metadata = await source.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported image');
        bytes = await source
          .rotate()
          .resize(1800, 1800, {fit: 'inside', withoutEnlargement: true})
          .webp({quality: 85})
          .toBuffer();
      } catch {
        throw new ApiError(400, '이미지를 읽을 수 없습니다. 2,500만 화소 이하의 JPG, PNG, WebP 파일을 선택해주세요.');
      }
      const filename = `${createHash('sha256').update(bytes).digest('hex')}.webp`;
      await mkdir(uploadsDir, {recursive: true});
      const temporaryPath = join(uploadsDir, `.${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, bytes, {flag: 'wx'});
        await rename(temporaryPath, join(uploadsDir, filename));
      } finally {
        await rm(temporaryPath, {force: true});
      }
      res.status(201).json({imageUrl: `/api/market/images/${filename}`});
    }
  );
  app.get('/api/market/images/:filename', async (req, res) => {
    auth.member(req);
    const filename = String(req.params.filename);
    if (!/^[a-f0-9]{64}\.webp$/.test(filename)) throw new ApiError(404, '이미지를 찾을 수 없습니다.');
    let bytes: Buffer;
    try {
      bytes = await readFile(join(uploadsDir, filename));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw new ApiError(404, '이미지를 찾을 수 없습니다.');
      throw error;
    }
    res.type('image/webp').send(bytes);
  });
}
