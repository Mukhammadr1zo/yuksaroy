/**
 * Online to'lov uchun ma'lumot porti. Payme va Click qoidalari (payme.ts, click.ts) bazani
 * bilmaydi, faqat shu interfeysni: testda xotiradagi qatorlar, prodda Prisma.
 */
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

export type Provider = 'payme' | 'click' | 'uzum';

/** To'lanadigan buyurtma: obuna qatori (PAY-1042). */
export interface OrderRow { id: string; no: string; status: string; amountTiyin: bigint }

/** 1 yaratildi, 2 to'landi, -1 to'lovgacha bekor, -2 to'lovdan keyin bekor (pul qaytarildi). */
export interface TxnRow {
  id: string; provider: string; extId: string; subscriptionId: string; amountTiyin: bigint;
  state: number; reason: number | null; providerTime: bigint | null;
  createdAt: Date; performedAt: Date | null; cancelledAt: Date | null;
}

export interface PaymentStore {
  orderByNo(no: string): Promise<OrderRow | null>;
  orderById(id: string): Promise<OrderRow | null>;
  txn(provider: Provider, extId: string): Promise<TxnRow | null>;
  /** Shu buyurtmaning ochiq (state 1) tranzaksiyasi, qaysi tizimdan bo'lsa ham. */
  openTxn(subscriptionId: string): Promise<TxnRow | null>;
  createTxn(d: { provider: Provider; extId: string; subscriptionId: string; amountTiyin: bigint; providerTime?: bigint | null }): Promise<TxnRow>;
  updateTxn(id: string, d: Partial<Pick<TxnRow, 'state' | 'reason' | 'performedAt' | 'cancelledAt'>>): Promise<TxnRow>;
  /** Payme GetStatement: tizim vaqti [from, to] oralig'idagi tranzaksiyalar, buyurtma raqami bilan. */
  txnsBetween(provider: Provider, from: bigint, to: bigint): Promise<(TxnRow & { orderNo: string })[]>;
  /** Obunani faollashtiradi. Buyurtma PENDING bo'lmasa false: to'lovni qabul qilib bo'lmaydi. */
  activate(subscriptionId: string, provider: Provider, now: Date): Promise<boolean>;
  /** To'langan obuna bekor qilindi (pul qaytarildi): obuna yopiladi. */
  refund(subscriptionId: string, provider: Provider): Promise<void>;
}

@Injectable()
export class PrismaPaymentStore implements PaymentStore {
  constructor(private readonly prisma: PrismaService, private readonly subs: SubscriptionService) {}

  orderByNo(no: string) {
    return this.prisma.subscription.findUnique({ where: { no }, select: { id: true, no: true, status: true, amountTiyin: true } });
  }
  orderById(id: string) {
    return this.prisma.subscription.findUnique({ where: { id }, select: { id: true, no: true, status: true, amountTiyin: true } });
  }
  txn(provider: Provider, extId: string) {
    return this.prisma.paymentTxn.findUnique({ where: { provider_extId: { provider, extId } } });
  }
  openTxn(subscriptionId: string) {
    return this.prisma.paymentTxn.findFirst({ where: { subscriptionId, state: 1 }, orderBy: { createdAt: 'desc' } });
  }
  createTxn(d: { provider: Provider; extId: string; subscriptionId: string; amountTiyin: bigint; providerTime?: bigint | null }) {
    return this.prisma.paymentTxn.create({ data: { ...d, providerTime: d.providerTime ?? null } });
  }
  updateTxn(id: string, d: Partial<Pick<TxnRow, 'state' | 'reason' | 'performedAt' | 'cancelledAt'>>) {
    return this.prisma.paymentTxn.update({ where: { id }, data: d });
  }
  async txnsBetween(provider: Provider, from: bigint, to: bigint) {
    const rows = await this.prisma.paymentTxn.findMany({
      where: { provider, providerTime: { gte: from, lte: to } },
      orderBy: { providerTime: 'asc' }, take: 1000,
      include: { subscription: { select: { no: true } } },
    });
    return rows.map(({ subscription, ...t }) => ({ ...t, orderNo: subscription.no }));
  }
  async activate(subscriptionId: string, provider: Provider, now: Date) {
    try {
      await this.subs.confirm(subscriptionId, now, provider);
      return true;
    } catch (e) {
      // Buyurtma shu orada bekor qilingan yoki admin qo'lda tasdiqlagan: to'lov qabul qilinmaydi
      if (e instanceof ConflictException) return false;
      throw e;
    }
  }
  async refund(subscriptionId: string, provider: Provider) {
    // Pul qaytdi: daromaddan ham chiqadi (moneyReceived = false)
    await this.subs.revoke(subscriptionId, `${provider}: to'lov qaytarildi`, false).catch((e) => {
      if (!(e instanceof ConflictException)) throw e; // allaqachon yopilgan obuna: qaytarish baribir qayd etiladi
    });
  }
}
