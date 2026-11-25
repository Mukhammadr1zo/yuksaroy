import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ActivityService } from '../modules/activity/activity.service';

@Injectable()
export class AuditService {
  // activity ixtiyoriy: audit yozuvi har holda yoziladi, superadminga xabar esa unga qo'shimcha (xato tashlamaydi)
  constructor(private readonly prisma: PrismaService, @Optional() private readonly activity?: ActivityService) {}

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
    // Strict xatoda yuqoriga chiqib ketdik (amal bajarilmadi). Bu yerga yetgan bo'lsa amal bo'ldi, qator yozilmagan bo'lsa ham
    this.activity?.record({ actorId: e.actorId, action: e.action, entity: e.entity, entityId: e.entityId, meta: e.meta, ip: e.ip });
  }

  /**
   * Guruh amali: har qator uchun alohida yozuv, bitta so'rovda.
   *
   * Nega har qatorga alohida: audit qatorni entityId bo'yicha qidiradi. Butun guruhga
   * bitta yozuv qoldirilsa "shu terminal nega yo'qoldi" degan savolga javob topilmaydi.
   */
  async logMany(rows: { actorId?: string | null; action: string; entity: string; entityId: string; meta?: unknown }[]) {
    if (!rows.length) return;
    try {
      await this.prisma.auditLog.createMany({
        data: rows.map((e) => ({ actorId: e.actorId ?? null, action: e.action, entity: e.entity, entityId: e.entityId, meta: e.meta as any })),
      });
    } catch (err) {
      console.error('audit failed', err);
    }
    // Bitta xabar: har amal turiga bitta hodisa, nechta qatorni bildirishi count da (40 ta terminal yashirilsa 40 xabar emas)
    const first = new Map<string, (typeof rows)[number] & { count: number }>();
    for (const r of rows) {
      const f = first.get(r.action);
      if (f) f.count++;
      else first.set(r.action, { ...r, count: 1 });
    }
    for (const r of first.values()) this.activity?.record({ actorId: r.actorId, action: r.action, entity: r.entity, entityId: r.entityId, meta: r.meta, count: r.count });
  }
}
