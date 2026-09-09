import { BadRequestException, Controller, HttpException, PayloadTooLargeException, Post, Req, UnsupportedMediaTypeException, UseGuards } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { env } from '../../../common/env';
import { IpBucket } from '../../../common/ip-bucket';
import { detectImageExt } from '../../../common/security';

/** apps/api/uploads (src va dist dan bir xil chuqurlik). main.ts shu papkani /v1/files/ ostida beradi. */
export const UPLOADS_DIR = resolve(__dirname, '../../../../uploads');
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const quota = new IpBucket(30, 3_600_000); // bitta foydalanuvchi soatiga 30 ta yuklash (e'londa ko'pi bilan 10 foto)

interface MultipartFile { fieldname: string; mimetype: string; toBuffer(): Promise<Buffer> }

/** E'lon fotolari: multipart maydon "file", faqat jpeg/png/webp, 5 MB gacha. Javob: ochiq URL. */
@ApiTags('uploads')
@ApiCookieAuth('ys_access')
@Controller('uploads')
@UseGuards(JwtGuard)
export class UploadsController {
  constructor(private readonly audit: AuditService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  async upload(@CurrentUserId() userId: string, @Req() req: FastifyRequest) {
    if (!quota.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    // ponytail: @fastify/multipart FastifyRequest'ni kengaytiradi; pnpm'da tip birlashmasligi mumkin, shuning uchun lokal interfeys
    const part = await (req as FastifyRequest & { file?: () => Promise<MultipartFile | undefined> }).file?.();
    if (!part || part.fieldname !== 'file') throw new BadRequestException({ code: 'FILE_REQUIRED', field: 'file' });
    const ext = EXT[part.mimetype];
    if (!ext) throw new BadRequestException({ code: 'FILE_TYPE', allowed: Object.keys(EXT) });
    let buf: Buffer;
    try { buf = await part.toBuffer(); } catch (e) {
      if ((e as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new PayloadTooLargeException({ code: 'FILE_TOO_LARGE', maxBytes: UPLOAD_MAX_BYTES });
      throw e;
    }
    // Mijoz e'lon qilgan mimetype yetarli emas: mazmun imzosi mos kelmasa rad etiladi
    if (detectImageExt(buf) !== ext) throw new UnsupportedMediaTypeException({ code: 'FILE_CONTENT_MISMATCH', allowed: Object.keys(EXT) });
    const now = new Date();
    const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await mkdir(join(UPLOADS_DIR, rel), { recursive: true });
    await writeFile(join(UPLOADS_DIR, rel, name), buf);
    const url = `${(env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '')}/v1/files/${rel}/${name}`;
    await this.audit.log({ actorId: userId, action: 'upload.create', entity: 'Upload', entityId: `${rel}/${name}`, meta: { bytes: buf.length, mimetype: part.mimetype } });
    return { url };
  }
}
