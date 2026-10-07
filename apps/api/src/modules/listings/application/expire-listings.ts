import { LISTING, type SearchLang } from '@yuksaroy/domain';
import { notifyBoth } from '../../../common/telegram';
import type { PrismaService } from '../../../common/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

const HREF = '/dashboard/listings';
/** Bir siklda shuncha e'lon; qolgani ertangi siklda. ponytail: kuniga 200, yetmasa son oshiriladi. */
const BATCH = 200;
/** Eslatma muddat tugashidan shuncha kun oldin ketadi (obuna eslatmasi bilan bir xil). */
const REMIND_DAYS = 3;
/** Bitta egada bir kunda bir nechta e'lon tugashi mumkin: qolganlari oluvchining tilida sanaladi. */
const MORE: Record<SearchLang, (n: number) => string> = {
  uz: (n) => ` va yana ${n} ta`,
  ru: (n) => ` и ещё ${n}`,
  en: (n) => ` and ${n} more`,
};
/** Xabar uchun kerakli maydonlar: e'lon nomi va kimga ketishi. */
const OWNER = { id: true, title: true, orgId: true, ownerUserId: true, createdById: true } as const;
type Owned = { id: string; title: string; orgId: string | null; ownerUserId: string | null; createdById: string };

/**
 * Bitta egaga bitta hodisa: aks holda o'n e'loni tugagan odam o'nta qo'ng'iroq olardi.
 * Muddati o'tgani ham, tugayotgani ham shu yerdan ketadi: guruhlash ikki nusxada yashamasin.
 */
async function notifyOwners(
  prisma: PrismaService, notifications: NotificationsService, rows: Owned[],
  kind: 'listingExpired' | 'listingExpiring', vars: Record<string, number>,
) {
  const groups = new Map<string, Owned[]>();
  for (const r of rows) {
    const key = r.orgId ?? r.ownerUserId ?? r.createdById;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [, list] of groups) {
    const first = list[0]!;
    // Bitta egadagi xato qolganlarni to'xtatmasin
    await notifyBoth(prisma, notifications, {
      target: first.orgId ? { orgIds: [first.orgId] } : { userIds: [first.ownerUserId ?? first.createdById] },
      kind,
      inApp: 'listing',
      href: HREF,
      vars: (l) => ({ ...vars, title: first.title, more: list.length > 1 ? MORE[l](list.length - 1) : '' }),
    }).catch(() => {});
  }
}

/**
 * Muddati o'tgan e'lon ACTIVE bo'lib qolardi: katalogda ko'rinmasdi, lekin havola bilan
 * ochilardi, unga xabar yozish mumkin edi va egasi uni qaytara olmasdi (ACTIVE dan qayta
 * yuborish o'tish jadvalida yo'q).
 *
 * Holat AVVAL yoziladi, xabar KEYIN: qator ACTIVE dan faqat bir marta chiqadi, ya'ni
 * takroriy xabar bo'lmaydi. Jarayon oradan yiqilsa bitta guruh xabarsiz qoladi, ya'ni
 * yo'qotish bo'ladi, takror emas. Obuna eslatmasida ham aynan shu tanlov qilingan.
 */
export async function expireListings(prisma: PrismaService, notifications: NotificationsService, now = new Date()): Promise<number> {
  const rows = await prisma.listing.findMany({
    // Namuna e'londa muddat yo'q, lekin shart baribir yoziladi: unga xabar hech qachon ketmasin
    where: { status: 'ACTIVE', isDemo: false, expiresAt: { lt: now } },
    select: OWNER,
    orderBy: { expiresAt: 'asc' },
    take: BATCH,
  });
  if (!rows.length) return 0;
  const moved = await prisma.listing.updateMany({ where: { id: { in: rows.map((r) => r.id) }, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
  if (!moved.count) return 0;
  await notifyOwners(prisma, notifications, rows, 'listingExpired', { days: LISTING.expireDays });
  return moved.count;
}

/**
 * Muddat tugashidan uch kun oldin egasiga bitta eslatma. Ilgari egasi muddatni faqat
 * e'lon katalogdan tushgandan keyin bilardi: kabinet "bir hafta ichida tugaydi" deb
 * ko'rsatadi, lekin uni ko'rish uchun saytga kirish kerak, ya'ni eslatma aynan saytga
 * kirmaydigan odamga yetmasdi.
 *
 * Naqsh obuna eslatmasidan (expiry-reminder.ts): belgi e'lonning o'z qatorida va
 * YUBORISHDAN OLDIN qo'yiladi. Sikl qayta ishlasa ham xabar takrorlanmaydi; yuborish
 * yiqilsa bitta eslatma yo'qoladi, bu esa ikkita xabardan yaxshiroq. Belgi bitta muddatniki:
 * e'lon qayta faol bo'lganda activate() uni tozalaydi va keyingi muddatda yana eslatiladi.
 */
export async function remindExpiringListings(prisma: PrismaService, notifications: NotificationsService, now = new Date()): Promise<number> {
  const until = new Date(now.getTime() + REMIND_DAYS * 86_400_000);
  const rows = await prisma.listing.findMany({
    where: { status: 'ACTIVE', isDemo: false, expiryRemindedAt: null, expiresAt: { gt: now, lte: until } },
    select: { ...OWNER, updatedAt: true },
    // Oyna 200 tadan oshsa birinchi bo'lib tushadiganlari oldin eslatiladi
    orderBy: { expiresAt: 'asc' },
    take: BATCH,
  });
  const claimed: Owned[] = [];
  for (const r of rows) {
    // Belgini band qilish atomar: ikkinchi nusxa count 0 oladi va yubormaydi.
    // updatedAt o'z qiymatida qoldiriladi: Prisma uni updateMany da ham "hozir" qiladi, eslatma esa
    // egasining tahriri emas (kabinetdagi "Yangilangan" va ro'yxat tartibi shunga qaraydi). Shartda
    // ham turadi: oradagi tahrir eski vaqt bilan bosilmasin, bunday e'lon ertangi siklda eslatiladi
    const c = await prisma.listing.updateMany({
      where: { id: r.id, status: 'ACTIVE', expiryRemindedAt: null, updatedAt: r.updatedAt },
      data: { expiryRemindedAt: now, updatedAt: r.updatedAt },
    });
    if (c.count) claimed.push(r);
  }
  await notifyOwners(prisma, notifications, claimed, 'listingExpiring', { left: REMIND_DAYS, days: LISTING.expireDays });
  return claimed.length;
}
