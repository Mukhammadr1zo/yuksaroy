// E'lon egasining o'lchangan javob signali: oxirgi faolligi va javob bergan
// yozishmalari nisbati. Egasi o'zi yozgan "javob N soat ichida" o'rniga keladi.
//
// Nega alohida fayl: qaror (qaysi chelak, qator chiziladimi) sof funksiyalarda
// turadi va test qilinadi, baza so'rovlari esa bitta joyda qoladi. Kelajakda
// terminal sahifasi ham shu funksiyani chaqirsa bo'ladi: u faqat egani biladi.
import { Prisma } from '@prisma/client';
import { uzLocalDate } from '@yuksaroy/domain';
import type { PrismaService } from '../../../common/prisma.service';

/** Oxirgi faollik chelagi. */
export type Seen = 'today' | 'week' | 'away';

export interface OwnerSignal {
  /** null = aniq aytadigan gap yo'q, qator chizilmaydi. */
  seen: Seen | null;
  /** of = kelgan yozishmalar, answered = egasi javob berganlari. */
  replied: { of: number; answered: number } | null;
}

/** Signalsiz javob: namuna e'lon va egasi aniqlanmagan holat uchun. */
export const SIGNAL_NONE: OwnerSignal = { seen: null, replied: null };

/**
 * Uchtadan kam yozishmada nisbat tasodifga yaqin: "1 tadan 1 tasi" hech narsa
 * demaydi, lekin ekranda 100% bo'lib ko'rinadi.
 */
const MIN_THREADS = 3;
const DAY_MS = 86_400_000;

/**
 * Oxirgi faollikdan chelak.
 *
 * "Bugun" Toshkent kuni bo'yicha, 24 soat bo'yicha emas: kecha kechqurun kirgan
 * odam ertalab ham "bugun kirgan" bo'lib ko'rinmasligi kerak.
 *
 * 'week' oynasi kalendar hafta emas, aylanma 7 kun: shuning uchun matn ham
 * "oxirgi bir haftada" deb yozilgan.
 *
 * Yettinchi kundan o'n uchinchi kungacha ataylab null: u yerda "oxirgi bir haftada"
 * ham, "ikki haftadan beri kirmagan" ham yolg'on bo'lardi. Yolg'on qatordan ko'ra
 * qator yo'q.
 */
export function seenBucket(last: Date | null, now: Date): Seen | null {
  // Sessiya qatori qolmagan: kunlik tozalash eski qatorlarni o'chiradi, ya'ni
  // bu odam ancha vaqtdan beri kirmagan
  if (!last) return 'away';
  if (uzLocalDate(last) === uzLocalDate(now)) return 'today';
  const days = (now.getTime() - last.getTime()) / DAY_MS;
  if (days < 7) return 'week';
  return days >= 14 ? 'away' : null;
}

/** Sanoqdan qator. Chegaradan past bo'lsa null (qator chizilmaydi). */
export function repliedRow(c: { of: number; answered: number }): OwnerSignal['replied'] {
  return c.of < MIN_THREADS ? null : { of: c.of, answered: c.answered };
}

type Owner = { isDemo?: boolean; orgId: string | null; ownerUserId: string | null };

/**
 * Ikki yig'ma so'rov: qator emas, son qaytadi.
 *
 * Namuna e'lon: egasi haqiqiy hisob emas va unga yozib ham bo'lmaydi,
 * shuning uchun bazaga umuman borilmaydi.
 *
 * Tashkilot egasida signal butun tashkilot bo'yicha: uning terminallariga kelgan
 * yozishmalar ham sanaladi. Savol "shu e'lon" emas, "shu sotuvchi javob beradimi".
 */
export async function ownerSignal(prisma: PrismaService, l: Owner, now = new Date()): Promise<OwnerSignal> {
  if (l.isDemo) return SIGNAL_NONE;
  const to = l.orgId
    ? Prisma.sql`i."toOrgId" = ${l.orgId}`
    : l.ownerUserId
      ? Prisma.sql`i."toUserId" = ${l.ownerUserId}`
      : null;
  if (!to) return SIGNAL_NONE;
  // Egasi tarafi kim: tashkilot bo'lsa a'zolari, shaxsiy e'lon bo'lsa egasining o'zi
  const who: Prisma.SessionWhereInput = l.orgId
    ? { user: { memberships: { some: { orgId: l.orgId } } } }
    : { userId: l.ownerUserId! };
  const [session, [threads]] = await Promise.all([
    // Bekor qilingan sessiya ham sanaladi: chiqib ketgan bo'lsa ham o'sha kuni kirgan.
    // Rotatsiya har yangilashda yangi qator yozadi, ya'ni eng kattasi = oxirgi faollik.
    // ponytail: mavjud @@index([userId]) yetadi, qatorlar 30 kunda tozalanadi.
    // Sessiya jadvali kattalashsa @@index([userId, createdAt]) qo'shiladi (o'lchab).
    prisma.session.aggregate({ where: who, _max: { createdAt: true } }),
    // Javob bergan = yozishmada mijozdan boshqa odamning kamida bitta xabari bor (threadRole:
    // mijozdan boshqa yozuvchi faqat egasi tarafi; baho huquqidagi answered() ham shunday).
    // status ataylab o'qilmaydi: egasi qarori (2026-10-07) bilan mijoz yana yozsa suhbat OPEN ga
    // qaytadi va "rahmat" bilan tugagan, javob olgan suhbat javobsiz bo'lib sanalardi.
    // ponytail: nisbat umrbod. Oyna kerak bo'lsa shu yerga i."createdAt" >= ... qo'shiladi
    prisma.$queryRaw<{ of: number; answered: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "of",
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM "InquiryMessage" m WHERE m."inquiryId" = i."id" AND m."fromUserId" <> i."fromUserId"
        ))::int AS "answered"
      FROM "Inquiry" i WHERE ${to}`),
  ]);
  return { seen: seenBucket(session._max.createdAt, now), replied: repliedRow(threads) };
}
