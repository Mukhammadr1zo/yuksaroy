import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { DRailwayClient } from '../wagon/d-railway.client';
import { FleetService } from './fleet.service';

const IX = '72000 123 73350';
const PARK = {
  company: 'Namuna Trans', ref: 1, count: 2,
  wagons: [
    { no: '77772001', station: 'Чукурсай', mtu: 'Toshkent', op: 'Отправление', loaded: true, cargo: 'ЦЕМЕНТ', dest: 'Сергели', from: 'Ахангаран', loadDate: '2099-06-01', train: IX, trainSize: 2, idleDays: null, opAt: 1 },
    { no: '77772003', station: 'Карши', mtu: 'Qarshi', op: 'Выгрузка', loaded: false, cargo: '', dest: '', from: '', loadDate: '', train: '', trainSize: 0, idleDays: 5, opAt: 1 },
  ],
};

function setup(org: { id: string; name: string; fleetName: string | null } | null, configured = true) {
  const calls: string[] = [];
  const prisma = {
    membership: {
      findFirst: async ({ where }: { where: { org: { kycStatus: string; fleetName: unknown } } }) => {
        // Shart so'rovning o'zida: tasdiqlanmagan yoki bog'lanmagan tashkilot umuman topilmaydi
        expect(where.org).toEqual({ kycStatus: 'VERIFIED', fleetName: { not: null } });
        return org ? { org } : null;
      },
    },
  } as unknown as PrismaService;
  const upstream = {
    configured,
    json: async (path: string) => {
      calls.push(path);
      if (path.startsWith('/api/v1/ys-fleet/park')) return PARK;
      if (path.startsWith('/api/v1/ys-fleet/train/')) return { ix: IX, count: 2, station: 'Чукурсай', wagons: [] };
      return null;
    },
  } as unknown as DRailwayClient;
  return { svc: new FleetService(prisma, upstream), calls };
}

describe('Mening vagonlarim', () => {
  it("tasdiqlangan va bog'langan tashkilot a'zosi parkni ko'radi; park 10 daqiqa keshda", async () => {
    const { svc, calls } = setup({ id: 'o1', name: 'Namuna Trans MChJ', fleetName: 'Namuna Trans' });
    const r = await svc.park('u1');
    expect(r.org).toEqual({ id: 'o1', name: 'Namuna Trans MChJ' });
    expect(r.park.count).toBe(2);
    expect(r.idleDays).toBe(3);
    await svc.park('u1');
    expect(calls.filter((c) => c.includes('/park'))).toHaveLength(1);
    expect(calls[0]).toBe('/api/v1/ys-fleet/park?company=Namuna+Trans');
  });

  it("operator emas: 403 FLEET_NONE", async () => {
    const { svc } = setup(null);
    await expect(svc.park('u2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("poyezd tarkibi faqat o'z vagoni turgan poyezd uchun", async () => {
    const { svc } = setup({ id: 'o1', name: 'N', fleetName: 'Namuna Trans' });
    expect((await svc.train('u1', IX)).count).toBe(2);
    await expect(svc.train('u1', '11111 111 11111')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.train('u1', 'bad')).rejects.toBeInstanceOf(NotFoundException);
  });

  it("d-railway ulanmagan: 503", async () => {
    const { svc } = setup({ id: 'o1', name: 'N', fleetName: 'X' }, false);
    await expect(svc.park('u1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
