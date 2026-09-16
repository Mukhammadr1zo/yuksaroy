import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply } from 'fastify';

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
    const res = host.switchToHttp().getResponse<FastifyReply>();

    // Nest ning o'z xatolari (400, 404, 409 ...) o'zgarishsiz o'tadi
    if (e instanceof HttpException) {
      const body = e.getResponse();
      return res.status(e.getStatus()).send(typeof body === 'string' ? { code: body } : body);
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
          return res.status(400).send({ code: 'DB_ERROR', prisma: e.code });
      }
    }

    if (e instanceof Prisma.PrismaClientValidationError) {
      this.log.error(`prisma validation: ${e.message.split('\n').pop()}`);
      return res.status(400).send({ code: 'DB_VALIDATION' });
    }

    const msg = e instanceof Error ? e.message : String(e);
    this.log.error(`kutilmagan xato: ${msg}`, e instanceof Error ? e.stack : undefined);
    return res.status(500).send({ code: 'INTERNAL' });
  }
}
