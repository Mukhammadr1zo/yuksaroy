import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderStatus } from '@yuksaroy/domain';
import { ORDER_REPOSITORY, type OrderRecord, type OrderRepository } from '../domain/ports';
import { OrderAccess } from './order-access';

export interface ListInput { scope: 'client' | 'terminal' | 'any'; status: OrderStatus[]; q?: string; page: number; limit: number }

/** Ro'yxat va bitta buyurtma - rol bo'yicha ko'rish doirasi bilan. */
@Injectable()
export class ListOrdersUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository, private readonly access: OrderAccess) {}

  async list(userId: string, input: ListInput) {
    const [shipperOrgIds, terminalIds] = await Promise.all([this.access.shipperOrgIds(userId), this.access.terminalIds(userId)]);
    const empty = { items: [] as OrderRecord[], total: 0, page: input.page, limit: input.limit };

    if (input.scope === 'client') {
      return shipperOrgIds.length ? this.orders.list({ shipperOrgIds, status: input.status, q: input.q }, input.page, input.limit) : empty;
    }
    if (input.scope === 'terminal') {
      return terminalIds.length ? this.orders.list({ terminalIds, status: input.status, q: input.q }, input.page, input.limit) : empty;
    }
    // any: terminal xodimi bo'lsa terminal navbati, aks holda o'z buyurtmalari (aralashtirilmaydi)
    if (terminalIds.length) return this.orders.list({ terminalIds, status: input.status, q: input.q }, input.page, input.limit);
    return shipperOrgIds.length ? this.orders.list({ shipperOrgIds, status: input.status, q: input.q }, input.page, input.limit) : empty;
  }

  async getForUser(userId: string, no: string): Promise<OrderRecord> {
    const o = await this.orders.findByNo(no);
    if (!o) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    const [shipperOrgIds, terminalIds] = await Promise.all([this.access.shipperOrgIds(userId), this.access.terminalIds(userId)]);
    const allowed = shipperOrgIds.includes(o.shipperOrgId) || terminalIds.includes(o.terminalId) || (await this.access.isAdmin(userId));
    if (!allowed) throw new ForbiddenException({ code: 'NOT_ORDER_PARTY' });
    return o;
  }

  async terminalSummary(userId: string) {
    const terminalIds = await this.access.terminalIds(userId);
    if (!terminalIds.length) return { terminals: 0, byStatus: {} as Record<string, number> };
    return { terminals: terminalIds.length, byStatus: await this.orders.countByStatus(terminalIds) };
  }
}
