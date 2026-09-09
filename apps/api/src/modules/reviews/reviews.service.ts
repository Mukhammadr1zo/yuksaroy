import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REVIEW, maskOrderNo, ratingDisplay, recomputeRating } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { ORDER_REPOSITORY, type OrderRepository } from '../orders/domain/ports';
import { OrderAccess } from '../orders/application/order-access';
import { ListOrdersUseCase } from '../orders/application/list-orders.usecase';
import { isRelatedParty } from './arms-length';

const view = (r: { id: string; orderNo: string; terminalId: string; rating: number; text: string | null; reply: string | null; repliedAt: Date | null; createdAt: Date }) =>
  ({ id: r.id, orderNo: r.orderNo, terminalId: r.terminalId, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, createdAt: r.createdAt });

/** Baho: DONE buyurtmaning yuk egasi beradi (bitta), terminal xodimi javob beradi, ro'yxat ochiq (raqam yashirin). */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly access: OrderAccess,
    private readonly listing: ListOrdersUseCase,
  ) {}

  /** Buyurtma tomonlari (yuk egasi, terminal xodimi, admin): bor bo'lsa baho, bo'lmasa null. */
  async forOrder(userId: string, no: string) {
    await this.listing.getForUser(userId, no);
    const r = await this.prisma.review.findUnique({ where: { orderNo: no } });
    return r ? view(r) : null;
  }

  async create(userId: string, no: string, rating: number, text: string | null) {
    const o = await this.orders.findByNo(no);
    if (!o) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    await this.access.assertShipper(userId, o.shipperOrgId);
    if (o.status !== 'DONE') throw new ConflictException({ code: 'ORDER_NOT_DONE', status: o.status });
    if (await this.prisma.review.findUnique({ where: { orderNo: no }, select: { id: true } })) throw new ConflictException({ code: 'REVIEW_EXISTS' });
    const excluded = await this.isSelfReview(o.shipperOrgId, o.terminalId);
    // ponytail: prev o'qib + yangilash; bir terminalga bir vaqtda ikki baho kamdan-kam, kerak bo'lsa review.aggregate ga o'tiladi
    const r = await this.prisma.$transaction(async (tx) => {
      if (!excluded) {
        const t = await tx.terminal.findUniqueOrThrow({ where: { id: o.terminalId }, select: { ratingAvg: true, ratingCount: true } });
        const next = recomputeRating({ avg: t.ratingAvg, count: t.ratingCount }, rating);
        await tx.terminal.update({ where: { id: o.terminalId }, data: { ratingAvg: next.avg, ratingCount: next.count } });
      }
      return tx.review.create({ data: { orderNo: no, terminalId: o.terminalId, orgId: o.shipperOrgId, userId, rating, text, excluded } });
    });
    return view(r);
  }

  /** Buyurtmachi va terminal egasi bir tomonmi: sharh yoziladi, lekin reytingga kirmaydi. */
  private async isSelfReview(shipperOrgId: string, terminalId: string): Promise<boolean> {
    const t = await this.prisma.terminal.findUnique({ where: { id: terminalId }, select: { orgId: true } });
    const terminalOrgId = t?.orgId ?? null;
    if (terminalOrgId === null) return false;
    if (terminalOrgId === shipperOrgId) return true;
    const ms = await this.prisma.membership.findMany({ where: { orgId: { in: [shipperOrgId, terminalOrgId] } }, select: { orgId: true, userId: true } });
    return isRelatedParty(
      { orgId: shipperOrgId, memberIds: ms.filter((m) => m.orgId === shipperOrgId).map((m) => m.userId) },
      { orgId: terminalOrgId, memberIds: ms.filter((m) => m.orgId === terminalOrgId).map((m) => m.userId) },
    );
  }

  /** Terminal xodimi javobi: REVIEW.maxReplyDays ichida; qayta yozish mumkin. */
  async reply(userId: string, id: string, reply: string) {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    await this.access.assertTerminalOf(userId, r.terminalId);
    if (Date.now() - r.createdAt.getTime() > REVIEW.maxReplyDays * 86_400_000) throw new ConflictException({ code: 'REPLY_WINDOW_CLOSED', days: REVIEW.maxReplyDays });
    return view(await this.prisma.review.update({ where: { id }, data: { reply, repliedAt: new Date() } }));
  }

  /** Ochiq ro'yxat: yangi birinchi, yuk egasi tashkilot nomi, buyurtma raqami YS-10** ko'rinishida. */
  async listForTerminal(slug: string, page: number, limit = 20) {
    const t = await this.prisma.terminal.findUnique({ where: { slug }, select: { id: true, status: true, ratingAvg: true, ratingCount: true } });
    if (!t || t.status !== 'ACTIVE') throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    const where = { terminalId: t.id };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({ where, include: { org: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, createdAt: r.createdAt, orgName: r.org.name, orderNo: maskOrderNo(r.orderNo) })),
      total, page, limit, avg: ratingDisplay({ avg: t.ratingAvg, count: t.ratingCount }).avg, count: t.ratingCount,
    };
  }
}
