import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

/**
 * Kunlik qatorlar soni, TOSHKENT kuni bo'yicha: bosh sahifadagi 30 kunlik chiziqchalar.
 *
 * Nega raw SQL: Prisma groupBy sanani kunga kesa olmaydi, 30 kunlik qatorlarni xotiraga
 * olib guruhlash esa yuk oshganda qimmatlashadi. Kun AT TIME ZONE bilan kesiladi, aks holda
 * chiziqcha UTC bo'yicha besh soat siljib, dayKeys bilan bir kunga kelmay qolardi.
 *
 * Jadval nomi kodda qat'iy Prisma.sql bo'lagi: parametr faqat sana va qo'shimcha shart.
 */
export type DayTable = 'WagonSearch' | 'Order' | 'AuditLog';
const TABLE: Record<DayTable, Prisma.Sql> = {
  WagonSearch: Prisma.sql`"WagonSearch"`,
  Order: Prisma.sql`"Order"`,
  AuditLog: Prisma.sql`"AuditLog"`,
};

/** `from` oynaning boshi (UTC instant). `extraWhere` `AND ...` bilan boshlanadi. */
export async function countByDay(prisma: PrismaService, table: DayTable, from: Date, extraWhere: Prisma.Sql = Prisma.empty): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ d: string; n: bigint }[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') d, count(*) n
    FROM ${TABLE[table]}
    WHERE "createdAt" >= ${from} ${extraWhere}
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.d, Number(r.n)]));
}
