import { Body, Controller, Headers, HttpCode, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AuditService } from '../../common/audit.service';
import { Click } from './click';
import { click, payme, uzum } from './pay-links';
import { Payme } from './payme';
import { PrismaPaymentStore } from './store';
import { Uzum, type UzumMethod } from './uzum';

const UZUM_METHODS = ['check', 'create', 'confirm', 'reverse', 'status'] as const;

/**
 * To'lov tizimlarining serverdan-serverga so'rovlari. Sessiya yo'q: Payme Basic auth bilan,
 * Click MD5 imzo bilan tekshiriladi. Tizim ulanmagan bo'lsa yo'l 404 beradi (mavjud emasdek).
 * Swagger da ko'rinmaydi: bu mijoz uchun API emas.
 */
@ApiExcludeController()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly store: PrismaPaymentStore, private readonly audit: AuditService) {}

  @Post('payme') @HttpCode(200)
  async payme(@Body() body: unknown, @Headers('authorization') auth?: string) {
    const cfg = payme();
    if (!cfg) throw new NotFoundException();
    const out = await new Payme(this.store).handle(body, auth, cfg.key, cfg.login);
    await this.log('payme', body, out);
    return out;
  }

  @Post('click/prepare') @HttpCode(200)
  async clickPrepare(@Body() body: Record<string, unknown>) {
    const cfg = click();
    if (!cfg) throw new NotFoundException();
    const out = await new Click(this.store, cfg).prepare(body ?? {});
    await this.log('click.prepare', body, out);
    return out;
  }

  @Post('click/complete') @HttpCode(200)
  async clickComplete(@Body() body: Record<string, unknown>) {
    const cfg = click();
    if (!cfg) throw new NotFoundException();
    const out = await new Click(this.store, cfg).complete(body ?? {});
    await this.log('click.complete', body, out);
    return out;
  }

  /** Uzum Bank: har usul alohida yo'l, xato HTTP 400 bilan (spetsifikatsiya shunday talab qiladi). */
  @Post('uzum/:method')
  async uzum(@Param('method') method: string, @Body() body: unknown, @Res({ passthrough: true }) res: { status(code: number): unknown }, @Headers('authorization') auth?: string) {
    const cfg = uzum();
    if (!cfg || !(UZUM_METHODS as readonly string[]).includes(method)) throw new NotFoundException();
    const out = await new Uzum(this.store, cfg).handle(method as UzumMethod, body, auth);
    res.status(out.http);
    await this.log(`uzum.${method}`, body, { error: out.body.errorCode ?? null });
    return out.body;
  }

  /** Har so'rov auditda: pul bo'yicha nizo bo'lsa nima kelgani va nima javob berilgani ko'rinsin. Sirlar yozilmaydi. */
  private log(kind: string, body: unknown, out: Record<string, unknown>) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const meta = {
      method: b.method ?? b.action, ext: (b.params as Record<string, unknown> | undefined)?.id ?? b.click_trans_id,
      order: (b.params as { account?: { order_id?: unknown } } | undefined)?.account?.order_id ?? b.merchant_trans_id,
      error: (out.error as { code?: unknown } | undefined)?.code ?? out.error ?? null,
    };
    return this.audit.log({ actorId: null, action: `payment.${kind}`, entity: 'PaymentTxn', entityId: String(meta.ext ?? '-').slice(0, 64), meta }).catch(() => {});
  }
}
