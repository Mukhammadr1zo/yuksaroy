import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { REVIEW, ratingDisplay, recomputeRating } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * E'lon izohlari: xizmatdan foydalangan odam baho va izoh qoldiradi.
 * Dalil: shu e'lon bo'yicha so'rov ochgan va EGASI javob bergan bo'lishi kerak.
 * Buyurtma yo'q (texnika va avtotransport kelishuvi platformadan tashqarida bo'ladi),
 * shuning uchun yagona haqiqiy iz - ikki tomonli yozishma.
 */
@Injectable()
export class ListingReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ochiq ro'yxat: o'rtacha faqat REVIEW.minToShow dan keyin ko'rsatiladi (bitta bahodan o'rtacha ma'nosiz). */
  async list(slug: string, page = 1, limit = 20) {
    const l = await this.prisma.listing.findUnique({ where: { slug }, select: { id: true, status: true, ratingAvg: true, ratingCount: true } });
    if (!l || l.status !== 'ACTIVE') throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    const [rows, total] = await Promise.all([
      this.prisma.listingReview.findMany({ where: { listingId: l.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.listingReview.count({ where: { listingId: l.id } }),
    ]);
    const names = await this.names(rows.map((r) => r.userId));
    return {
      rating: ratingDisplay({ avg: l.ratingAvg ?? 0, count: l.ratingCount }),
      minToShow: REVIEW.minToShow,
      total, page, limit,
      items: rows.map((r) => ({
        id: r.id, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, createdAt: r.createdAt,
        author: names[r.userId] ?? null,
      })),
    };
  }

  /** Foydalanuvchi shu e'longa izoh yoza oladimi va yozganmi. */
  async eligibility(userId: string, listingId: string) {
    const mine = await this.prisma.listingReview.findUnique({ where: { listingId_userId: { listingId, userId } }, select: { id: true, rating: true, text: true } });
    if (mine) return { canReview: false, already: mine };
    return { canReview: await this.answered(userId, listingId), already: null };
  }

  /** Ikki tomonli yozishma bormi: men yozdim va boshqa tomon javob berdi. */
  private async answered(userId: string, listingId: string): Promise<boolean> {
    const inquiries = await this.prisma.inquiry.findMany({ where: { listingId, fromUserId: userId }, select: { id: true } });
    if (!inquiries.length) return false;
    const ids = inquiries.map((i) => i.id);
    const reply = await this.prisma.inquiryMessage.findFirst({ where: { inquiryId: { in: ids }, NOT: { fromUserId: userId } }, select: { id: true } });
    return !!reply;
  }

  async create(userId: string, listingId: string, rating: number, text: string | null) {
    const l = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, title: true, slug: true, kind: true, orgId: true, ownerUserId: true, ratingAvg: true, ratingCount: true } });
    if (!l) throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    if (l.ownerUserId === userId) throw new ForbiddenException({ code: 'SELF_REVIEW' });
    if (!(await this.answered(userId, listingId))) throw new ForbiddenException({ code: 'NO_CONTACT' });
    const dup = await this.prisma.listingReview.findUnique({ where: { listingId_userId: { listingId, userId } }, select: { id: true } });
    if (dup) throw new ConflictException({ code: 'REVIEW_EXISTS' });

    const r = await this.prisma.$transaction(async (tx) => {
      const next = recomputeRating({ avg: l.ratingAvg ?? 0, count: l.ratingCount }, rating);
      await tx.listing.update({ where: { id: listingId }, data: { ratingAvg: next.avg, ratingCount: next.count } });
      return tx.listingReview.create({ data: { listingId, userId, rating, text } });
    });

    const to = (await this.notifications.recipients({ orgIds: [l.orgId], userIds: [l.ownerUserId] })).filter((x) => x !== userId);
    void this.notifications.push(to, { kind: 'message', title: l.title, body: `${rating}/5${text ? ` - ${text.slice(0, 120)}` : ''}`, href: `/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}` }).catch(() => {});
    return { id: r.id, rating: r.rating, text: r.text, createdAt: r.createdAt };
  }

  /** Egasi bir marta javob yozadi. */
  async reply(userId: string, reviewId: string, reply: string) {
    const r = await this.prisma.listingReview.findUnique({ where: { id: reviewId }, include: { listing: { select: { orgId: true, ownerUserId: true } } } });
    if (!r) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    const orgIds = (await this.prisma.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
    const isOwner = r.listing.ownerUserId === userId || (!!r.listing.orgId && orgIds.includes(r.listing.orgId));
    if (!isOwner) throw new ForbiddenException({ code: 'NOT_OWNER' });
    const updated = await this.prisma.listingReview.update({ where: { id: reviewId }, data: { reply: reply.trim().slice(0, 1000), repliedAt: new Date() } });
    return { id: updated.id, reply: updated.reply, repliedAt: updated.repliedAt };
  }

  private async names(userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return {} as Record<string, string | null>;
    const us = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    return Object.fromEntries(us.map((u) => [u.id, u.fullName]));
  }
}
