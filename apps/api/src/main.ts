import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import { UPLOADS_DIR, UPLOAD_MAX_BYTES } from './modules/listings/presentation/uploads.controller';
import { AppModule } from './app.module';
import { env } from './common/env';
import { parseTrustProxy, securityHeaders } from './common/security';

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
  // Yuklashlar: multipart (bitta fayl, 5 MB) va statik berish /v1/files/<yyyy>/<mm>/<nom>
  await app.register(fastifyMultipart as any, { limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 } });
  mkdirSync(UPLOADS_DIR, { recursive: true });
  await app.register(fastifyStatic as any, { root: UPLOADS_DIR, prefix: '/v1/files/', decorateReply: false, index: false, list: false });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (docsOn) {
    const doc = new DocumentBuilder().setTitle('YukSaroy API').setVersion('0.1').addCookieAuth('ys_access').build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(env.API_PORT, '0.0.0.0');
  console.log(`API: http://localhost:${env.API_PORT}/v1${docsOn ? '  docs: /docs' : ''}`);
}
bootstrap();
