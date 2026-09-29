import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { pushError } from './runtime';

/**
 * Prisma xatolarini o'qiladigan kodga aylantiradi.
 *
 * Ilgari ular global filtrga tushib 500 bo'lardi va panelda faqat "Saqlanmadi" ko'rinardi:
 * takrorlangan qiymatmi, yo'q qatormi yoki bog'lanish muammosimi - operator bilmasdi va
 * o'sha qiymatni qayta-qayta yuboraverardi.
 *
 * Kutilmagan xatolar ham shu yerda loglanadi: aks holda javob 500 bo'lib ketardi va
 * serverga kirmasdan sababini bilib bo'lmasdi.
 */
@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Api');

  catch(e: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<FastifyReply>();
    const req = http.getRequest<{ method?: string; url?: string } | undefined>();
    // Tizim sahifasi halqasi: 5xx va baza xatolari. 4xx mijoz xatosi, u shovqin bo'lardi.
    // Fastify darajasidagi xatolar (masalan FST_ERR_CTP 400) bu filtrga yetmaydi va halqaga tushmaydi
    const note = (status: number, code: string, msg: string) => pushError({ status, code, method: req?.method ?? '', path: req?.url ?? '', msg });

    // Nest ning o'z xatolari (400, 404, 409 ...) o'zgarishsiz o'tadi
    if (e instanceof HttpException) {
      const body = e.getResponse();
      const status = e.getStatus();
      if (status >= 500) note(status, typeof body === 'string' ? body : String((body as { code?: unknown }).code ?? 'HTTP'), e.message);
      return res.status(status).send(typeof body === 'string' ? { code: body } : body);
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(',') : String(e.meta?.target ?? '');
      switch (e.code) {
        // Noyoblik cheklovi: qaysi maydon ekani ham qaytadi, operator nimani o'zgartirishni biladi
        case 'P2002':
          return res.status(409).send({ code: 'DUPLICATE', field: target || null });
        // Bog'langan qator yo'q (masalan o'chirilgan tashkilotga havola)
        case 'P2003':
          return res.status(409).send({ code: 'RELATED_NOT_FOUND', field: target || null });
        // Yangilanayotgan yoki o'chirilayotgan qator topilmadi
        case 'P2025':
          return res.status(404).send({ code: 'NOT_FOUND' });
        default:
          this.log.error(`prisma ${e.code}: ${e.message.split('\n').pop()}`);
          note(400, 'DB_ERROR', `${e.code}: ${e.message.split('\n').pop() ?? ''}`);
          return res.status(400).send({ code: 'DB_ERROR', prisma: e.code });
      }
    }

    if (e instanceof Prisma.PrismaClientValidationError) {
      this.log.error(`prisma validation: ${e.message.split('\n').pop()}`);
      note(400, 'DB_VALIDATION', e.message.split('\n').pop() ?? '');
      return res.status(400).send({ code: 'DB_VALIDATION' });
    }

    const msg = e instanceof Error ? e.message : String(e);
    this.log.error(`kutilmagan xato: ${msg}`, e instanceof Error ? e.stack : undefined);
    note(500, 'INTERNAL', msg);
    return res.status(500).send({ code: 'INTERNAL' });
  }
}
