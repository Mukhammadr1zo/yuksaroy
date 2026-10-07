import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { UPLOADS_DIR, UPLOAD_MAX_BYTES } from './modules/listings/presentation/uploads.controller';
import { AppModule } from './app.module';
import { env } from './common/env';
import { parseTrustProxy, securityHeaders } from './common/security';
import { isPrivateFilePath, isPrivateFileRequest } from './common/upload-visibility';
import { TokenService } from './modules/identity/application/token.service';
import { optionalUserId } from './modules/identity/presentation/jwt.guard';

async function bootstrap() {
  const isProd = env.NODE_ENV === 'production';
  // trustProxy sukut bo'yicha o'chiq: aks holda mijoz X-Forwarded-For bilan hamma IP chelagini chetlab o'tadi
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: parseTrustProxy(env.TRUST_PROXY) }));
  const fastify = app.getHttpAdapter().getInstance();
  const docsOn = !isProd || !!env.DOCS_TOKEN;

  // Hooklar marshrutlardan oldin: helmet o'rniga qo'lda sarlavhalar, /docs prodda token bilan
  fastify.addHook('onSend', (req: any, reply: any, payload: unknown, done: (e: Error | null, p?: unknown) => void) => {
    for (const [k, v] of Object.entries(securityHeaders(req.url ?? '', isProd))) reply.header(k, v);
    done(null, payload);
  });
  if (docsOn && env.DOCS_TOKEN) {
    fastify.addHook('onRequest', (req: any, reply: any, done: (e?: Error) => void) => {
      if (req.url?.startsWith('/docs') && req.headers['x-docs-token'] !== env.DOCS_TOKEN) { void reply.code(404).send(); return; }
      done();
    });
  }

  await app.register(fastifyCookie as any); // ponytail: @fastify/cookie v11 tip mosligi, ishlashga ta'sir qilmaydi

  /*
   * Maxfiy yuklamalar qorovuli. Cookie plagini ro'yxatdan o'tgandan KEYIN qo'shiladi:
   * hooklar qo'shilish tartibida ishlaydi, aks holda req.cookies hali bo'sh bo'lardi.
   *
   * Nega hook, nega Nest yo'li emas: fayllarni fastifyStatic beradi va u Nest
   * qorovullaridan o'tmaydi. Hook esa statik yo'lning oldida turadi.
   *
   * Nega faqat sessiya tekshiriladi, egalik emas: fayl nomi 96 bitli tasodifiy, ya'ni
   * manzilni taxmin qilib bo'lmaydi. Xavf manzilning tarqab ketishida edi. Sessiya talabi
   * shu xavfni yopadi: tarqagan manzil begona odamga endi hech narsa bermaydi.
   */
  const tokens = app.get(TokenService, { strict: false });
  fastify.addHook('onRequest', (req: any, reply: any, done: (e?: Error) => void) => {
    if (!isPrivateFileRequest(req.url ?? '')) { done(); return; }
    if (optionalUserId(req, tokens)) { done(); return; }
    void reply.code(401).send({ code: 'NO_TOKEN' });
  });

  // Yuklashlar: multipart (bitta fayl, 10 MB) va statik berish /v1/files/<yyyy>/<mm>/<nom>
  await app.register(fastifyMultipart as any, { limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 } });
  mkdirSync(UPLOADS_DIR, { recursive: true });
  /*
   * Kesh: send sukut bo'yicha "public, max-age=0" yozardi, ya'ni har surat har safar qayta
   * so'ralardi. Ochiq fayl nomi tasodifiy va hech qachon qayta ishlatilmaydi (storeFile), shuning
   * uchun mazmuni o'zgarmaydi: 30 kun, immutable. Maxfiy fayl (pasport, dalil, yozishma)
   * umuman saqlanmaydi: umumiy kompyuterda diskda nusxa qolmasin va har ko'rishda sessiya
   * qorovuldan qayta o'tsin. basename: diskdagi yo'l Windowsda teskari chiziq bilan keladi.
   */
  await app.register(fastifyStatic as any, {
    root: UPLOADS_DIR, prefix: '/v1/files/', decorateReply: false, index: false, list: false, cacheControl: false,
    setHeaders: (res: { setHeader(k: string, v: string): void }, file: string) =>
      res.setHeader('cache-control', isPrivateFilePath(basename(file)) ? 'private, no-store' : 'public, max-age=2592000, immutable'),
  });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Prisma xatolari o'qiladigan kodga aylanadi va kutilmaganlari loglanadi:
  // ilgari ular 500 bo'lib ketardi va panelda faqat "Saqlanmadi" ko'rinardi.
  app.useGlobalFilters(new PrismaExceptionFilter());

  if (docsOn) {
    const doc = new DocumentBuilder().setTitle('YukSaroy API').setVersion('0.1').addCookieAuth('ys_access').build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(env.API_PORT, '0.0.0.0');
  console.log(`API: http://localhost:${env.API_PORT}/v1${docsOn ? '  docs: /docs' : ''}`);
}
bootstrap();
