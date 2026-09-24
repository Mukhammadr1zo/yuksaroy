import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformAdmin } from '../organizations/application/platform-admin';
import { notifyBoth } from '../../common/telegram';
import { FILE_URL } from '../../common/file-url';
import { AttachmentError, parseAttachments, type Attachment } from './domain/attachments';
import { threadRole, type ThreadRole } from './domain/access';

const MAX = 2000;

type Subject = { kind: 'listing' | 'terminal'; id: string; slug: string; title: string; sub: string | null };

/**
 * Yozishma: mijoz obyekt egasiga yozadi, egasi shu yerda javob beradi.
 * Mavzu e'lon yoki terminal bo'ladi. Reestrdan kelgan, egasi hali ro'yxatdan
 * o'tmagan terminal haqidagi xabarga platforma javob beradi, ya'ni murojaat
 * javobsiz qolmaydi.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly platform: PlatformAdmin,
  ) {}

  private static readonly INCLUDE = {
    listing: { select: { id: true, slug: true, title: true, kind: true } },
    terminal: { select: { id: true, slug: true, name: true, kind: true } },
  } as const;

  /** Yozishma va ko'ruvchining roli. Huquq qarori domain/access.ts da. */
  private async thread(userId: string, inquiryId: string) {
    const inq = await this.prisma.inquiry.findUnique({ where: { id: inquiryId }, include: ChatService.INCLUDE });
    if (!inq) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND' });
    const orgIds = (await this.prisma.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
    // Platforma tekshiruvi faqat kerak bo'lganda: har xabar uchun ortiqcha so'rov qilinmaydi
    const isPlatformAdmin = inq.toPlatform ? await this.platform.isPlatformAdmin(userId) : false;
    const role = threadRole(inq, { userId, orgIds, isPlatformAdmin });
    if (!role) throw new ForbiddenException({ code: 'NOT_IN_THREAD' });
    return { inq, role };
  }

  private static subject(inq: { listing: { id: string; slug: string; title: string; kind: string } | null; terminal: { id: string; slug: string; name: string; kind: string } | null }): Subject | null {
    if (inq.listing) return { kind: 'listing', id: inq.listing.id, slug: inq.listing.slug, title: inq.listing.title, sub: inq.listing.kind };
    if (inq.terminal) return { kind: 'terminal', id: inq.terminal.id, slug: inq.terminal.slug, title: inq.terminal.name, sub: inq.terminal.kind };
    return null;
  }

  /**
   * Yozishmalar ro'yxati. `owner`: menga kelganlar, `mine`: men boshlaganlarim.
   *
   * Tartib oxirgi xabar bo'yicha: ilgari ochilish vaqti bo'yicha edi va javob
   * kelayotgan suhbat ro'yxat tubiga cho'kib ketardi.
   */
  async list(userId: string, scope: 'owner' | 'mine') {
    const where = scope === 'mine'
      ? { fromUserId: userId }
      : { OR: (await this.partyOf(userId)).filter((o) => !('fromUserId' in o)), NOT: { fromUserId: userId } };
    const rows = await this.prisma.inquiry.findMany({
      where,
      include: ChatService.INCLUDE,
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 200,
    });
    const [unread, fromOrgs] = await Promise.all([this.unreadCounts(userId, rows.map((r) => r.id)), this.orgNames(rows.map((r) => r.fromOrgId))]);
    return rows.map((r) => ({
      id: r.id,
      subject: ChatService.subject(r),
      message: r.message,
      status: r.status,
      fromOrgName: r.fromOrgId ? (fromOrgs[r.fromOrgId] ?? null) : null,
      createdAt: r.createdAt,
      lastMessageAt: r.lastMessageAt,
      unread: unread[r.id] ?? 0,
    }));
  }

  /**
   * Chap menyudagi belgi uchun: men qatnashgan barcha yozishmalardagi o'qilmagan
   * xabarlar soni. Tashkilotga kelganlari ham kiradi, aks holda tashkilot nomidan
   * ishlayotgan odam yangi xabarni umuman sezmasdi.
   */
  async unreadTotal(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.inquiryMessage.count({
      where: { fromUserId: { not: userId }, NOT: { readBy: { has: userId } }, inquiry: { OR: await this.partyOf(userId) } },
    });
    return { count };
  }

  /** Foydalanuvchi qaysi yozishmalarda tomon: yuborgan, shaxsan qabul qilgan, tashkiloti yoki platforma. */
  private async partyOf(userId: string): Promise<object[]> {
    const orgIds = (await this.prisma.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
    const or: object[] = [{ fromUserId: userId }, { toUserId: userId }];
    if (orgIds.length) or.push({ toOrgId: { in: orgIds } });
    if (await this.platform.isPlatformAdmin(userId)) or.push({ toPlatform: true });
    return or;
  }

  /** Har yozishmadagi o'qilmagan xabarlar soni: ro'yxatda nuqta shu songa qarab chiqadi. */
  private async unreadCounts(userId: string, ids: string[]): Promise<Record<string, number>> {
    if (!ids.length) return {};
    const rows = await this.prisma.inquiryMessage.groupBy({
      by: ['inquiryId'],
      where: { inquiryId: { in: ids }, fromUserId: { not: userId }, NOT: { readBy: { has: userId } } },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.inquiryId, r._count._all]));
  }

  private async orgNames(ids: (string | null)[]): Promise<Record<string, string>> {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    if (!list.length) return {};
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: list } }, select: { id: true, name: true } });
    return Object.fromEntries(orgs.map((o) => [o.id, o.name]));
  }

  /** Terminalni slug yoki id bo'yicha topish; yopiq obyektga yozib bo'lmaydi. */
  private async openTerminal(slugOrId: string) {
    const terminal = await this.prisma.terminal.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
      select: { id: true, name: true, slug: true, orgId: true, status: true },
    });
    // Yashirilgan yoki qoralama terminal katalogda ko'rinmaydi, demak unga yozib ham
    // bo'lmasligi kerak: e'lon yo'lida ham xuddi shunday tekshiruv bor.
    if (!terminal || terminal.status !== 'ACTIVE') throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    return terminal;
  }

  /**
   * Shu obyekt bo'yicha shu odamning yozishmasi.
   *
   * Qabul qiluvchi ham shartga kiradi: reestr obyekti egalik qilingandan keyin
   * eski yozishma davom etmasligi kerak, aks holda xabar eski manzilga tushardi.
   */
  private static mine(userId: string, terminalId: string, orgId: string | null) {
    return { terminalId, fromUserId: userId, toOrgId: orgId, toPlatform: orgId === null };
  }

  /** Oyna ochilganda avvalgi yozishma bor-yo'qligi: bo'lsa tarixi darhol ko'rinadi. */
  async findForSubject(userId: string, terminalSlug?: string, listingId?: string): Promise<{ id: string | null }> {
    if (terminalSlug) {
      const t = await this.openTerminal(terminalSlug);
      const inq = await this.prisma.inquiry.findFirst({ where: ChatService.mine(userId, t.id, t.orgId), select: { id: true }, orderBy: { createdAt: 'desc' } });
      return { id: inq?.id ?? null };
    }
    if (listingId) {
      const inq = await this.prisma.inquiry.findFirst({ where: { listingId, fromUserId: userId }, select: { id: true }, orderBy: { createdAt: 'desc' } });
      return { id: inq?.id ?? null };
    }
    return { id: null };
  }

  /**
   * Terminal egasiga yozishma ochish. Katalogdagi obyektga oldin faqat qo'ng'iroq
   * qilish mumkin edi; endi yozib qo'yish ham mumkin va kelishuv izi platformada qoladi.
   *
   * Bitta obyektga bitta ochiq yozishma yetarli: takroriy murojaat eskisiga qo'shiladi,
   * aks holda egasining ro'yxati bir xil odamdan kelgan o'nlab tred bilan to'lib ketardi.
   */
  async startTerminal(userId: string, slugOrId: string, message: string, orgId: string | null, rawAttachments?: unknown) {
    const terminal = await this.openTerminal(slugOrId);
    if (orgId) {
      const member = await this.prisma.membership.findFirst({ where: { userId, orgId }, select: { id: true } });
      if (!member) throw new ForbiddenException({ code: 'NOT_ORG_MEMBER' });
    }
    const files = this.files(rawAttachments);
    const text = message.trim();
    const existing = await this.prisma.inquiry.findFirst({
      where: ChatService.mine(userId, terminal.id, terminal.orgId),
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await this.send(userId, existing.id, text, rawAttachments);
      return { id: existing.id };
    }
    const inquiry = await this.prisma.inquiry.create({
      data: {
        terminalId: terminal.id,
        fromOrgId: orgId,
        fromUserId: userId,
        message: text,
        toOrgId: terminal.orgId,
        toPlatform: terminal.orgId === null,
        lastMessageAt: new Date(),
      },
    });
    await this.prisma.inquiryMessage.create({ data: { inquiryId: inquiry.id, fromUserId: userId, text, attachments: files as unknown as object, readBy: [userId] } });
    void this.notifyNew(userId, inquiry.id, terminal, text).catch(() => {});
    return { id: inquiry.id };
  }

  /** Mijoz yuborgan ilovalarni tekshirish. Xato kodi mijozga o'qiladigan holda qaytadi. */
  private files(raw: unknown): Attachment[] {
    try { return parseAttachments(raw, FILE_URL); } catch (e) {
      if (e instanceof AttachmentError) throw new BadRequestException({ code: e.code });
      throw e;
    }
  }

  private async notifyNew(fromUserId: string, inquiryId: string, terminal: { name: string; orgId: string | null }, text: string) {
    const to = (terminal.orgId ? await this.notifications.recipients({ orgIds: [terminal.orgId] }) : await this.platform.adminUserIds()).filter((id) => id !== fromUserId);
    if (!to.length) return;
    const from = await this.prisma.user.findUnique({ where: { id: fromUserId }, select: { fullName: true, phone: true } }).then((u) => u?.fullName || u?.phone || '');
    const href = `/dashboard/inquiries/${inquiryId}`;
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds: to },
      kind: 'inquiry',
      inApp: 'inquiry',
      href,
      vars: { title: terminal.name, from, message: text.slice(0, 500) },
      card: { title: terminal.name, body: text.slice(0, 200) },
    });
  }

  async get(userId: string, inquiryId: string) {
    const { inq, role } = await this.thread(userId, inquiryId);
    const messages = await this.prisma.inquiryMessage.findMany({ where: { inquiryId }, orderBy: { createdAt: 'asc' }, take: 200 });
    // Ochilgani o'qilgan deb belgilanadi (o'z xabarlari hisobga olinmaydi)
    const unread = messages.filter((m) => m.fromUserId !== userId && !m.readBy.includes(userId)).map((m) => m.id);
    if (unread.length) {
      await this.prisma.$transaction(unread.map((id) => this.prisma.inquiryMessage.update({ where: { id }, data: { readBy: { push: userId } } })));
    }
    const names = await this.names(messages.map((m) => m.fromUserId));
    return {
      id: inq.id,
      subject: ChatService.subject(inq),
      status: inq.status,
      role,
      createdAt: inq.createdAt,
      messages: messages.map((m) => ({
        id: m.id,
        text: m.text,
        attachments: (m.attachments ?? []) as unknown as Attachment[],
        createdAt: m.createdAt,
        mine: m.fromUserId === userId,
        author: names[m.fromUserId] ?? null,
      })),
    };
  }

  async send(userId: string, inquiryId: string, text: string, rawAttachments?: unknown) {
    const files = this.files(rawAttachments);
    const body = text.trim().slice(0, MAX);
    // Faqat fayl yuborish ham xabar: matn majburiy emas
    if (!body && !files.length) throw new BadRequestException({ code: 'MESSAGE_EMPTY' });
    const { inq, role } = await this.thread(userId, inquiryId);
    const msg = await this.prisma.inquiryMessage.create({
      data: { inquiryId, fromUserId: userId, text: body, attachments: files as unknown as object, readBy: [userId] },
    });
    await this.prisma.inquiry.update({ where: { id: inquiryId }, data: { lastMessageAt: msg.createdAt, status: role === 'owner' ? 'ANSWERED' : inq.status } });
    void this.notify(userId, inq, role, body || `${files.length} ta fayl`).catch(() => {});
    return { id: msg.id, text: msg.text, attachments: files, createdAt: msg.createdAt, mine: true, author: null };
  }

  /** Xabar boshqa tomonga: saytdagi bildirishnoma va (bog'langan bo'lsa) Telegram. */
  private async notify(
    fromUserId: string,
    inq: { id: string; fromUserId: string; toOrgId: string | null; toUserId: string | null; toPlatform: boolean; listing: { title: string } | null; terminal: { name: string } | null },
    role: ThreadRole,
    text: string,
  ) {
    const to = role === 'owner' ? [inq.fromUserId] : await this.receivers(inq);
    const others = to.filter((id) => id !== fromUserId);
    if (!others.length) return;
    const title = inq.listing?.title ?? inq.terminal?.name ?? '';
    const href = `/dashboard/inquiries/${inq.id}`;
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds: others },
      kind: 'inquiryMessage',
      inApp: 'message',
      href,
      vars: { title, message: text.slice(0, 500) },
      card: { title, body: text.slice(0, 200) },
    });
  }

  /** Qabul qiluvchi tomon: tashkilot a'zolari, shaxsiy egasi yoki platforma. */
  private async receivers(inq: { toOrgId: string | null; toUserId: string | null; toPlatform: boolean }): Promise<string[]> {
    if (inq.toPlatform) return this.platform.adminUserIds();
    return this.notifications.recipients({ orgIds: [inq.toOrgId], userIds: [inq.toUserId] });
  }

  private async names(userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return {} as Record<string, string | null>;
    const us = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    return Object.fromEntries(us.map((u) => [u.id, u.fullName]));
  }
}
