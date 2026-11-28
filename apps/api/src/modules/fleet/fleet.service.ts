/**
 * «Mening vagonlarim»: vagon operatori o'z parkini ko'radi (egasi qarori 2026-11-28).
 *
 * Kirish: foydalanuvchi a'zo bo'lgan tashkilot TASDIQLANGAN (kycStatus = VERIFIED) va admin unga
 * spravkadagi kompaniya nomini (fleetName) bog'lagan bo'lsa. Ma'lumot d-railway /ys-fleet/* dan,
 * faqat so'nggi spravka: qaysi vagon qayerda, yuklangan yoki bo'sh, yuk, manzil, poyezd tarkibi,
 * bo'sh vagon necha kun turgani. Kechikish va me'yorlar yo'q (egasi: "oddiy, tushunarli").
 *
 * Kesh: park 10 daqiqa (spravka kuniga bir necha marta yangilanadi), bir kompaniya uchun bitta.
 */
import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DRailwayClient } from '../wagon/d-railway.client';

export type FleetWagon = {
  no: string; station: string; mtu: string; op: string; loaded: boolean; cargo: string; dest: string; from: string; loadDate: string;
  train: string; trainSize: number; idleDays: number | null; opAt: number | null;
};
export type FleetPark = { company: string; ref: number; count: number; wagons: FleetWagon[] };
export type TrainWagon = { no: string; owner: string; company: string; country: string; loaded: boolean; cargo: string; station: string; dest: string };
export type Train = { ix: string; count: number; station: string; wagons: TrainWagon[] };

/** Bo'sh vagon shuncha kundan ko'p tursa belgi chiqadi (egasi: "3 sutkadan ortiq"). */
export const IDLE_DAYS = 3;
const TTL = 10 * 60_000;
const TRAIN_IX = /^\d{5} \d{3} \d{5}$/;

@Injectable()
export class FleetService {
  private cache = new Map<string, { at: number; park: FleetPark }>();

  constructor(private readonly prisma: PrismaService, private readonly upstream: DRailwayClient) {}

  /** Foydalanuvchining operator tashkiloti (birinchisi) yoki null. */
  async orgOf(userId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { userId, org: { kycStatus: 'VERIFIED', fleetName: { not: null } } },
      orderBy: { createdAt: 'asc' },
      select: { org: { select: { id: true, name: true, fleetName: true } } },
    });
    return m?.org ?? null;
  }

  async park(userId: string): Promise<{ org: { id: string; name: string }; park: FleetPark; idleDays: number }> {
    const org = await this.orgOf(userId);
    if (!org?.fleetName) throw new ForbiddenException({ code: 'FLEET_NONE' });
    return { org: { id: org.id, name: org.name }, park: await this.fetchPark(org.fleetName), idleDays: IDLE_DAYS };
  }

  /** Poyezd tarkibi faqat operatorning o'z vagoni turgan poyezd uchun: begona poyezdni so'rab bo'lmaydi. */
  async train(userId: string, ix: string): Promise<Train> {
    if (!TRAIN_IX.test(ix)) throw new NotFoundException({ code: 'TRAIN_NOT_FOUND' });
    const { park } = await this.park(userId);
    if (!park.wagons.some((w) => w.train === ix)) throw new NotFoundException({ code: 'TRAIN_NOT_FOUND' });
    const t = await this.call(() => this.upstream.json<Train>(`/api/v1/ys-fleet/train/${encodeURIComponent(ix)}`));
    if (!t) throw new NotFoundException({ code: 'TRAIN_NOT_FOUND' });
    return t;
  }

  /** Admin: spravkadagi kompaniya nomlari (bog'lash uchun). */
  companies(q: string) {
    return this.call(() => this.upstream.json<{ items: { name: string; wagons: number }[]; total: number }>(`/api/v1/ys-fleet/companies?${new URLSearchParams({ q: q.slice(0, 80) })}`));
  }

  private async fetchPark(company: string): Promise<FleetPark> {
    const key = company.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.park;
    const park = await this.call(() => this.upstream.json<FleetPark>(`/api/v1/ys-fleet/park?${new URLSearchParams({ company })}`));
    const out = park ?? { company, ref: 0, count: 0, wagons: [] };
    this.cache.set(key, { at: Date.now(), park: out });
    return out;
  }

  /** Manba ulanmagan yoki javob bermadi: 503, sabab faqat logda (manzil va login mijozga chiqmaydi). */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.upstream.configured) throw new ServiceUnavailableException({ code: 'FLEET_NOT_CONFIGURED' });
    try { return await fn(); }
    catch (e) { console.error('fleet upstream', (e as Error).message); throw new ServiceUnavailableException({ code: 'FLEET_UPSTREAM' }); }
  }
}
