import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SearchLang } from '@yuksaroy/domain';
import type { NotificationsService } from '../modules/notifications/notifications.service';
import { PlatformAdmin } from '../modules/organizations/application/platform-admin';
import { IpBucket } from './ip-bucket';
import type { PrismaService } from './prisma.service';
import { pushError } from './runtime';
import { notifyBoth } from './telegram';

/** Audit amali: yangi so'rov necha odamga yuborilgani. Bosh sahifadagi NO_PROVIDER shu yerdan sanaydi. */
export const FANOUT_ACTION = 'request.fanout';

type Entity = 'UrgentRequest' | 'MarketRequest';

const log = new Logger('Fanout');
/**
 * Ogohlantirishning Telegram qismi soatiga bitta. chatBucket (bitta chatga soatiga 5 ta) hamma
 * xabar turiga umumiy: bo'sh viloyatlardan ketma-ket kelgan so'rovlar adminning buyurtma va navbat
 * xabarlarini jim tashlatib yuborardi. Panel qo'ng'irog'i va NO_PROVIDER har bir so'rovga qoladi.
 * ponytail: bitta jarayon xotirasida, restartda soat yangidan boshlanadi.
 */
const alertTelegram = new IpBucket(1, 3_600_000);

/**
 * Yangi so'rov (shoshilinch, yuk yoki xizmat) oluvchilarini topadi (find), necha odamga ketganini
 * jurnalga yozadi va haqiqiy oluvchilar sonini qaytaradi. NOLGA ketgani ham yoziladi, aslida aynan
 * u kerak: ilgari so'rov kelardi, hech kimga ketmasdi va buni hech kim bilmasdi.
 *
 * Ikki son: sent - hamma oluvchi, sentReal - haqiqiy ijrochilar. Haqiqiy emas: platforma adminlari
 * (platformaning o'z tashkiloti tashuvchi bo'lib turardi) va so'rov egasining hamkasblari (bir
 * tashkilot a'zolari: o'z xodimiga ketgan so'rov bozorga chiqmagan, "1 ta tashuvchiga yuborildi"
 * esa yolg'on bo'lardi). Ular xabarni oladi, faqat sanalmaydi. Ikkalasi SON bo'lib yoziladi,
 * chunki ogohlantirish 0 ni sanaydi (noProviderWhere).
 *
 * sentReal = 0 bo'lsa adminlar DARHOL biladi (panel qo'ng'irog'i va Telegram): mijoz javob kutyapti,
 * bosh sahifadagi ogohlantirish esa kimdir panelni ochguncha jim turadi. So'rovni yuborgan adminning
 * o'ziga bormaydi (AdminNotify qoidasi). Ogohlantirish kutilmaydi: yaratish javobi Telegramni kutmasin.
 *
 * find yiqilsa ham so'rov jim qolmaydi: sabab server jurnaliga va Tizim sahifasiga yoziladi, jurnalda
 * 0 (failed belgisi bilan), adminlarga sababi aytilgan ogohlantirish ketadi. Mijozga son aytilmaydi
 * (null): "bu hududda tashuvchi yo'q" bu yerda yolg'on bo'lardi.
 *
 * Boshqa xatolar yutiladi: jurnal yoki ogohlantirish tushsa ham so'rov va xabarning o'zi to'xtamasin.
 */
export async function logFanout(
  prisma: PrismaService,
  notifications: NotificationsService,
  f: {
    entity: Entity; id: string; no: string; createdById: string;
    board: 'URGENT' | 'CARGO' | 'SERVICE'; region: string | null; type: string | null;
    /** Oluvchilarni bazadan topadi. Yiqilishi shu yerda ushlanadi (yuqoriga qarang) */
    find: () => Promise<string[]>;
    /** Ogohlantirish matni uchun: nima so'ralgan (adminning tilida) va qayerda */
    what: (l: SearchLang) => string; where: string;
  },
): Promise<{ userIds: string[]; sentReal: number | null }> {
  const found = await f.find().catch((e: unknown) => {
    const msg = `${f.no}: ${e instanceof Error ? e.message : String(e)}`;
    log.error(`oluvchilarni topib bo'lmadi: ${msg}`);
    pushError({ status: 500, code: 'FANOUT_FAILED', method: 'POST', path: f.board === 'URGENT' ? '/v1/urgent' : '/v1/market/requests', msg });
    return null;
  });
  const userIds = found ?? [];
  // Admin yoki hamkasblar ro'yxati olinmasa hamma oluvchi haqiqiy sanaladi (eski xatti-harakat)
  const [admins, team] = await Promise.all([
    new PlatformAdmin(prisma).adminUserIds().catch(() => [] as string[]),
    userIds.length
      ? prisma.membership.findMany({ where: { userId: { in: userIds }, org: { members: { some: { userId: f.createdById } } } }, select: { userId: true } })
        .then((ms) => ms.map((m) => m.userId), () => [] as string[])
      : [],
  ]);
  const notReal = new Set([...admins, ...team]);
  const sentReal = userIds.filter((id) => !notReal.has(id)).length;
  await prisma.auditLog.create({
    data: { action: FANOUT_ACTION, entity: f.entity, entityId: f.id, meta: { board: f.board, region: f.region, type: f.type, sent: userIds.length, sentReal, ...(found ? {} : { failed: true }) } },
  }).catch(() => { /* jurnal ixtiyoriy, xabar muhimroq */ });
  if (!sentReal && admins.some((id) => id !== f.createdById)) {
    // Havola panelning o'sha so'rovni raqami bilan ochadigan ekrani (buyruq paleti ham shunday ochadi)
    const href = `/admin/${f.board === 'URGENT' ? 'urgent' : 'market'}?q=${encodeURIComponent(f.no)}`;
    void notifyBoth(prisma, notifications, {
      target: { userIds: admins, exceptUserId: f.createdById },
      kind: found ? 'adminNoProvider' : 'adminFanoutFailed',
      inApp: 'claim',
      href,
      vars: (l) => ({ no: f.no, what: f.what(l), where: f.where }),
      telegram: alertTelegram.take('alert'),
    }).catch(() => {});
  }
  return { userIds, sentReal: found ? sentReal : null };
}

/**
 * Mijozga ko'rinadigan son faqat sentReal dan. Eski qatorda (2026-10-06 dan) sentReal yo'q, sent esa
 * namuna tashkilot egalarini, bloklangan hisobni va adminni ham sanagan: undan son aytilmaydi, faqat
 * sent = 0 ishonchli (hech kimga ketmagan). Qidiruv yiqilgan qatorda ham son yo'q (failed).
 */
const realOf = (meta: Prisma.JsonValue): number | undefined => {
  const m = (meta ?? {}) as { sent?: number; sentReal?: number; failed?: boolean };
  if (m.failed) return undefined;
  return m.sentReal ?? (m.sent === 0 ? 0 : undefined);
};

/**
 * Jurnaldan: har so'rov nechta haqiqiy oluvchiga ketgan (kabinetdagi "N ta tashuvchiga
 * yuborildi"). Son ishonchli bo'lmagan so'rov (yozuvi yo'q, eski yoki qidiruv yiqilgan)
 * xaritada yo'q: u yerda son aytilmaydi, taxmin qilinmaydi.
 */
export async function sentCounts(prisma: PrismaService, entity: Entity, ids: readonly string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await prisma.auditLog.findMany({ where: { action: FANOUT_ACTION, entity, entityId: { in: [...ids] } }, select: { entityId: true, meta: true } });
  const out = new Map<string, number>();
  for (const x of rows) {
    const n = realOf(x.meta);
    if (n != null) out.set(x.entityId!, n);
  }
  return out;
}

/**
 * NO_PROVIDER: oynada birorta ham haqiqiy ijrochiga yetmagan so'rovlar (qidiruv yiqilgani ham:
 * u yerda sentReal = 0). Eski qatorda sentReal yo'q, u yerda sent qaraladi. Yangi qatorda sent = 0
 * bo'lsa sentReal ham 0, ya'ni bitta OR ikkala holni to'g'ri qamraydi va eski qator ikki marta sanalmaydi.
 */
export const noProviderWhere = (since: Date): Prisma.AuditLogWhereInput => ({
  action: FANOUT_ACTION,
  createdAt: { gte: since },
  OR: [{ meta: { path: ['sentReal'], equals: 0 } }, { meta: { path: ['sent'], equals: 0 } }],
});
