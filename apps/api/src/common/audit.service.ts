import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xatolik audit yozuvi tufayli asosiy amalni to'xtatmasin.
   *
   * `strict`: qator kvotaning O'ZI bo'lgan joyda (telefon ochilishi). U yerda qator
   * yozilmasa odam kvotasiz raqam ocha berardi, shuning uchun xato yuqoriga chiqadi
   * va chaqiruvchi uni o'z javob kodiga o'raydi.
   */
  async log(
    e: { actorId?: string | null; action: string; entity?: string; entityId?: string; meta?: unknown; ip?: string },
    strict = false,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId: e.actorId ?? null, action: e.action, entity: e.entity, entityId: e.entityId, meta: e.meta as any, ip: e.ip },
      });
    } catch (err) {
      console.error('audit failed', err);
      if (strict) throw err;
    }
  }
}
