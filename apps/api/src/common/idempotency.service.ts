import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const TTL_HOURS = 24;

/**
 * `Idempotency-Key` bilan yuborilgan POST takrorlansa - saqlangan javob qaytadi (6.4).
 * Kalit bir foydalanuvchi + bir endpointga tegishli; boshqa foydalanuvchining kaliti ko'rinmaydi.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kalit bo'lmasa shunchaki `run()`. Bo'lsa: keshdan qaytaradi yoki bajarib, javobni saqlaydi. */
  async run<T>(key: string | undefined, userId: string, endpoint: string, run: () => Promise<T>): Promise<T> {
    if (!key) return run();
    const id = `${userId}:${endpoint}:${key}`.slice(0, 200);
    const now = new Date();

    const hit = await this.prisma.idempotencyKey.findUnique({ where: { key: id } });
    if (hit && hit.expiresAt > now) return hit.response as T;

    const result = await run();
    await this.prisma.idempotencyKey.upsert({
      where: { key: id },
      create: { key: id, userId, endpoint, status: 200, response: json(result), expiresAt: new Date(now.getTime() + TTL_HOURS * 3_600_000) },
      update: { status: 200, response: json(result), expiresAt: new Date(now.getTime() + TTL_HOURS * 3_600_000) },
    });
    return result;
  }

  /** Muddati o'tgan kalitlarni tozalash (sweeper chaqiradi). */
  async purge(now = new Date()) {
    const r = await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } });
    return r.count;
  }
}

/** BigInt/Date → JSON (Prisma Json ustuni uchun). */
function json(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x))) as Prisma.InputJsonValue;
}
