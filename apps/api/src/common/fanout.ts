import type { PrismaService } from './prisma.service';

/** Audit amali: yangi so'rov necha odamga yuborilgani. Bosh sahifadagi NO_PROVIDER shu yerdan sanaydi. */
export const FANOUT_ACTION = 'request.fanout';

/**
 * Yangi so'rov (shoshilinch, yuk yoki xizmat) necha odamga ketganini yozadi. NOLGA ketgani
 * ham yoziladi, aslida aynan u kerak: ilgari so'rov kelardi, hech kimga ketmasdi va buni
 * hech kim bilmasdi. sent SON bo'lib yoziladi, chunki ogohlantirish sent = 0 ni sanaydi.
 *
 * Xato e'tiborsiz va try ichida: yozuv tushmasa xabarning o'zi to'xtamasin.
 */
export async function logFanout(
  prisma: PrismaService,
  entity: 'UrgentRequest' | 'MarketRequest',
  entityId: string,
  meta: { board: 'URGENT' | 'CARGO' | 'SERVICE'; region: string | null; type: string | null; sent: number },
): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { action: FANOUT_ACTION, entity, entityId, meta } });
  } catch { /* jurnal ixtiyoriy, xabar muhimroq */ }
}
