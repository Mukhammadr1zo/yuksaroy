import { LISTING, type SearchLang } from '@yuksaroy/domain';
import { notifyBoth } from '../../../common/telegram';
import type { PrismaService } from '../../../common/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

const HREF = '/dashboard/listings';
/** Bir siklda shuncha e'lon; qolgani ertangi siklda. ponytail: kuniga 200, yetmasa son oshiriladi. */
const BATCH = 200;
/** Bitta egada bir kunda bir nechta e'lon tugashi mumkin: qolganlari oluvchining tilida sanaladi. */
const MORE: Record<SearchLang, (n: number) => string> = {
  uz: (n) => ` va yana ${n} ta`,
  ru: (n) => ` и ещё ${n}`,
  en: (n) => ` and ${n} more`,
};

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
    select: { id: true, title: true, orgId: true, ownerUserId: true, createdById: true },
    orderBy: { expiresAt: 'asc' },
    take: BATCH,
  });
  if (!rows.length) return 0;
  const moved = await prisma.listing.updateMany({ where: { id: { in: rows.map((r) => r.id) }, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
  if (!moved.count) return 0;
  // Bitta egaga bitta hodisa: aks holda o'n e'loni tugagan odam o'nta qo'ng'iroq olardi
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.orgId ?? r.ownerUserId ?? r.createdById;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [, list] of groups) {
    const first = list[0]!;
    // Bitta egadagi xato qolganlarni to'xtatmasin
    await notifyBoth(prisma, notifications, {
      target: first.orgId ? { orgIds: [first.orgId] } : { userIds: [first.ownerUserId ?? first.createdById] },
      kind: 'listingExpired',
      inApp: 'listing',
      href: HREF,
      vars: (l) => ({ title: first.title, more: list.length > 1 ? MORE[l](list.length - 1) : '', days: LISTING.expireDays }),
    }).catch(() => {});
  }
  return moved.count;
}
