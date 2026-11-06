import {createHash} from 'node:crypto';
import express, {type Express} from 'express';
import sharp from 'sharp';
import type {BoardAuthorization} from './board-auth';
import {ApiError} from './errors';
import {localImageStorage, type ImageStorage} from './image-storage';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function registerMarketImageRoutes(
  app: Express,
  uploadsDir: string,
  auth: BoardAuthorization,
  storage: ImageStorage = localImageStorage(uploadsDir)
) {
  app.post(
    '/api/admin/market/images',
    async (req, _res, next) => {
      await auth.admin(req);
      if (!imageTypes.has(req.get('Content-Type')?.split(';')[0] ?? ''))
        throw new ApiError(415, 'JPG, PNG, WebP 이미지를 선택해주세요.');
      next();
    },
    express.raw({type: [...imageTypes], limit: 4 * 1024 * 1024, inflate: false}),
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
      await storage.put(filename, bytes);
      res.status(201).json({imageUrl: `/api/market/images/${filename}`});
    }
  );
  app.get('/api/market/images/:filename', async (req, res) => {
    await auth.member(req);
    const filename = String(req.params.filename);
    if (!/^[a-f0-9]{64}\.webp$/.test(filename)) throw new ApiError(404, '이미지를 찾을 수 없습니다.');
    const bytes = await storage.get(filename);
    res.type('image/webp').send(bytes);
  });
}
