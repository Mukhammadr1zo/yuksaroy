import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { esc, notifyTelegram, webUrl } from '../../common/telegram';

const MAX = 2000;

/**
 * So'rov ichidagi yozishma: mijoz e'lon egasiga yozadi, egasi shu yerda javob beradi.
 * Alohida "chat" jadvali emas: har yozishma bitta so'rovga (Inquiry) tegishli,
 * ya'ni suhbat doim aniq e'lon haqida bo'ladi.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Yozishmani ko'rish huquqi: so'rov yuborgan yoki e'lon egasi (tashkilot a'zosi yoki shaxsiy egasi). */
  private async thread(userId: string, inquiryId: string) {
    const inq = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { listing: { select: { id: true, slug: true, title: true, kind: true, orgId: true, ownerUserId: true } } },
    });
    if (!inq) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND' });
    const orgIds = (await this.prisma.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
    const isOwner = inq.listing.ownerUserId === userId || (!!inq.listing.orgId && orgIds.includes(inq.listing.orgId));
    const isSender = inq.fromUserId === userId;
    if (!isOwner && !isSender) throw new ForbiddenException({ code: 'NOT_IN_THREAD' });
    return { inq, isOwner };
  }

  async get(userId: string, inquiryId: string) {
    const { inq, isOwner } = await this.thread(userId, inquiryId);
    const messages = await this.prisma.inquiryMessage.findMany({ where: { inquiryId }, orderBy: { createdAt: 'asc' }, take: 200 });
    // Ochilgani o'qilgan deb belgilanadi (o'z xabarlari hisobga olinmaydi)
    const unread = messages.filter((m) => m.fromUserId !== userId && !m.readBy.includes(userId)).map((m) => m.id);
    if (unread.length) {
      await this.prisma.$transaction(unread.map((id) => this.prisma.inquiryMessage.update({ where: { id }, data: { readBy: { push: userId } } })));
    }
    const names = await this.names(messages.map((m) => m.fromUserId));
    return {
      id: inq.id,
      listing: { id: inq.listing.id, slug: inq.listing.slug, title: inq.listing.title, kind: inq.listing.kind },
      status: inq.status,
      role: isOwner ? ('owner' as const) : ('client' as const),
      createdAt: inq.createdAt,
      messages: messages.map((m) => ({ id: m.id, text: m.text, createdAt: m.createdAt, mine: m.fromUserId === userId, author: names[m.fromUserId] ?? null })),
    };
  }

  async send(userId: string, inquiryId: string, text: string) {
    const body = text.trim().slice(0, MAX);
    if (body.length < 1) throw new ForbiddenException({ code: 'MESSAGE_EMPTY' });
    const { inq, isOwner } = await this.thread(userId, inquiryId);
    const msg = await this.prisma.inquiryMessage.create({ data: { inquiryId, fromUserId: userId, text: body, readBy: [userId] } });
    await this.prisma.inquiry.update({ where: { id: inquiryId }, data: { lastMessageAt: msg.createdAt, status: isOwner ? 'ANSWERED' : inq.status } });
    void this.notify(userId, inq, isOwner, body).catch(() => {});
    return { id: msg.id, text: msg.text, createdAt: msg.createdAt, mine: true, author: null };
  }

  /** Xabar boshqa tomonga: saytdagi bildirishnoma va (bog'langan bo'lsa) Telegram. */
  private async notify(fromUserId: string, inq: { id: string; fromUserId: string; listing: { title: string; orgId: string | null; ownerUserId: string | null } }, isOwner: boolean, text: string) {
    const to = isOwner
      ? [inq.fromUserId]
      : await this.notifications.recipients({ orgIds: [inq.listing.orgId], userIds: [inq.listing.ownerUserId] });
    const others = to.filter((id) => id !== fromUserId);
    if (!others.length) return;
    const href = `/dashboard/inquiries/${inq.id}`;
    await this.notifications.push(others, { kind: 'message', title: inq.listing.title, body: text.slice(0, 200), href });
    await notifyTelegram(this.prisma, { userIds: others }, 'inquiryMessage', { title: esc(inq.listing.title), message: esc(text.slice(0, 500)), url: webUrl(href) });
  }

  private async names(userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return {} as Record<string, string | null>;
    const us = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    return Object.fromEntries(us.map((u) => [u.id, u.fullName]));
  }
}
