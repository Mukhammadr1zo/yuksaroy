import type { AuditService } from '../../../common/audit.service';
import type { PrismaService } from '../../../common/prisma.service';
import { notifyBoth } from '../../../common/telegram';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { CatalogRepository, TerminalRecord } from '../domain/ports';
import { claimPhoneMatch } from '../domain/claim-phone';

/** Audit amali: da'vo telefon mosligi tufayli o'zi tasdiqlandi (qo'lda tasdiq esa terminal.claim.decide). */
export const AUTO_CLAIM_ACTION = 'terminal.claim.auto';

/**
 * 2026-10-07 egasi qarori: da'vogarning tasdiqlangan raqami reestrdagi mas'ul raqamga mos kelsa
 * da'vo adminni kutmaydi, admin tasdig'i bilan bir xil natija (orgId, claimedAt, APPROVED). Mos
 * kelmasa yoki solishtirib bo'lmasa (null) hech narsa qilinmaydi va da'vo navbatda qoladi.
 * Adminlarga bir marta xabar boradi (qo'ng'iroq + Telegram), noto'g'ri bo'lsa ular qaytarib oladi.
 * Chaqiruvchi (claimTerminal) xatoni yutadi: avtomatika yiqilsa da'vo baribir PENDING bo'lib turadi.
 */
export async function autoApproveClaim(
  d: { repo: CatalogRepository; prisma: PrismaService; audit: AuditService; notifications: NotificationsService; adminUserIds: () => Promise<string[]> },
  userId: string,
  terminal: TerminalRecord,
  now = new Date(),
): Promise<TerminalRecord | null> {
  const u = await d.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!u?.phone || claimPhoneMatch(u.phone, [terminal.rail?.contactPhone, terminal.phone]) !== true) return null;
  // Admin bir marta qaror qilgan (rad, qaytarib olish) yoki avto-tasdiq allaqachon bo'lgan obyekt:
  // raqam hamon mos, lekin admin rad etganini avtomat bekor qilmasligi kerak, shuning uchun navbatda qoladi.
  const decidedBefore = await d.prisma.auditLog.count({
    where: { entity: 'Terminal', entityId: terminal.id, action: { in: [AUTO_CLAIM_ACTION, 'terminal.claim.decide'] } },
  });
  if (decidedBefore > 0) return null;
  const t = await d.repo.decideTerminalClaim(terminal.id, true, now);
  if (!t) return null; // boshqa admin oldin hal qilgan
  await d.audit.log({ actorId: userId, action: AUTO_CLAIM_ACTION, entity: 'Terminal', entityId: t.id, meta: { orgId: t.claimOrgId, phoneMatch: true } });
  const admins = await d.adminUserIds().catch(() => [] as string[]);
  if (admins.length) {
    void notifyBoth(d.prisma, d.notifications, {
      target: { userIds: admins, exceptUserId: userId },
      kind: 'adminClaimAuto', inApp: 'claim', href: '/admin/moderation?tab=claims',
      vars: { what: t.name },
    }).catch(() => {});
  }
  // Egasiga ham xuddi qo'lda tasdiqlangandagidek xabar
  if (t.claimOrgId) {
    void notifyBoth(d.prisma, d.notifications, {
      target: { orgIds: [t.claimOrgId] }, kind: 'claimApproved', inApp: 'claim', href: '/dashboard/objects',
      vars: { object: t.name, reason: '' },
    }).catch(() => {});
  }
  return t;
}

/**
 * Navbatda "o'zi tasdiqlangan" belgisi uchun: berilgan obyektlardan qaysilarining OXIRGI hal qilinishi
 * avtomatik bo'lgan (keyin admin qarori kelgan bo'lsa belgi yo'q).
 */
export async function autoApprovedIds(prisma: PrismaService, ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await prisma.auditLog.findMany({
    where: { action: { in: [AUTO_CLAIM_ACTION, 'terminal.claim.decide'] }, entity: 'Terminal', entityId: { in: [...ids] } },
    orderBy: { createdAt: 'desc' }, select: { entityId: true, action: true },
  });
  const seen = new Set<string>();
  const auto = new Set<string>();
  for (const r of rows) {
    if (!r.entityId || seen.has(r.entityId)) continue;
    seen.add(r.entityId);
    if (r.action === AUTO_CLAIM_ACTION) auto.add(r.entityId);
  }
  return auto;
}
