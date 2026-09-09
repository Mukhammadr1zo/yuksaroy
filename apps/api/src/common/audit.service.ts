import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Xatolik audit yozuvi tufayli asosiy amalni to'xtatmasin. */
  async log(e: { actorId?: string | null; action: string; entity?: string; entityId?: string; meta?: unknown; ip?: string }) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId: e.actorId ?? null, action: e.action, entity: e.entity, entityId: e.entityId, meta: e.meta as any, ip: e.ip },
      });
    } catch (err) {
      console.error('audit failed', err);
    }
  }
}
