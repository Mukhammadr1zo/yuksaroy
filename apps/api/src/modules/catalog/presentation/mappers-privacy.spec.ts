// Maxfiylik qoidasi: mas'ul shaxs ismi ochiq, telefoni faqat ro'yxatdan o'tganga.
// Bu qoida uch funksiyada uch marta yozilgan, shuning uchun uchalasi ham tekshiriladi. DB kerak emas.
import { describe, expect, it } from 'vitest';
import type { SidingRecord, TerminalRecord } from '../domain/ports';
import { publicSiding, publicTerminal, publicTerminalCard } from './mappers';

const PHONE = '+998901234567';

const railTerminal = (contactPhone: string | null = PHONE): TerminalRecord =>
  ({
    id: 't1', orgId: null, orgName: null, stationId: null, station: null, kind: 'RAIL', slug: 'bekobod-shahobcha-1',
    name: 'Bekobod shahobcha', description: null, address: null, phone: null, lat: null, lng: null, is24h: false,
    hours: null, passport: null, photos: [], status: 'ACTIVE', claimedAt: null, ratingAvg: 0, ratingCount: 0,
    claimStatus: 'NONE', claimOrgId: null, services: [], tariffs: [], regionCode: 'UZ-TO',
    rail: {
      name: 'Bekobod shahobcha', registryRef: null, trackCount: 2, capacityWagons: 10, occupiedWagons: null,
      deadEndDistanceM: null, junctionSwitch: null, brakeShoes: null, nogabarit: null, equipment: null,
      loadNorm: null, unloadNorm: null, loadFront: null, unloadFront: null, locoType: null, locoNote: null,
      processingHours: null, contractNo: null, contractStart: null, contractEnd: null, contractState: null,
      category: null, usageType: null, status: null, note: null,
      contactName: 'Ahmad Karimov', contactPhone,
      registryNo: 1, stationNameRaw: 'Бекабад', esrCode: '725302', rju: 'TASHKENT',
      ownerNameRaw: 'Bekobod sement MChJ', lengthM: 300, loadCapacity: 5, unloadCapacity: 4,
    },
  }) as unknown as TerminalRecord;

const siding = (contactPhone: string | null = PHONE): SidingRecord =>
  ({
    id: 's1', slug: 's1-slug', registryNo: 1, stationId: null, regionCode: 'UZ-TO', station: null,
    stationNameRaw: 'Бекабад', esrCode: '725302', rju: 'TASHKENT', ownerNameRaw: 'Bekobod sement MChJ',
    ownerOrgId: null, ownerOrgName: null, claimStatus: 'NONE', claimedAt: null, lengthM: 300,
    unloadCapacity: 4, loadCapacity: 5, photos: [], lat: null, lng: null,
    name: 'Bekobod shahobcha', registryRef: null, trackCount: 2, capacityWagons: 10, occupiedWagons: null,
    deadEndDistanceM: null, junctionSwitch: null, brakeShoes: null, nogabarit: null, equipment: null,
    loadNorm: null, unloadNorm: null, loadFront: null, unloadFront: null, locoType: null, locoNote: null,
    processingHours: null, contractNo: null, contractStart: null, contractEnd: null, contractState: null,
    category: null, usageType: null, status: null, note: null,
    contactName: 'Ahmad Karimov', contactPhone,
  }) as unknown as SidingRecord;

describe("mas'ul shaxs telefoni", () => {
  it('mehmonga berilmaydi, lekin borligi bilinadi', () => {
    const t = publicTerminal(railTerminal(), 0, false);
    expect(t.rail!.contactPhone).toBeNull();
    expect(t.rail!.hasPhone).toBe(true);
    expect(t.rail!.contactName).toBe('Ahmad Karimov');
  });

  it('kirgan foydalanuvchiga beriladi', () => {
    expect(publicTerminal(railTerminal(), 0, true).rail!.contactPhone).toBe(PHONE);
  });

  it('authed berilmasa mehmon deb hisoblanadi', () => {
    expect(publicTerminal(railTerminal()).rail!.contactPhone).toBeNull();
    expect(publicSiding(siding()).contactPhone).toBeNull();
  });

  // Karta ro'yxatda o'nlab marta chiziladi va hech qachon kirish tekshirilmaydi: raqam u yerda umuman bo'lmasligi kerak
  it('kartada raqam umuman yo\'q', () => {
    const c = publicTerminalCard(railTerminal()) as Record<string, unknown>;
    expect(JSON.stringify(c)).not.toContain(PHONE);
    expect((c.rail as { hasPhone: boolean }).hasPhone).toBe(true);
  });

  it('raqam yo\'q bo\'lsa hasPhone ham false', () => {
    expect(publicTerminal(railTerminal(null), 0, true).rail!.hasPhone).toBe(false);
    expect(publicSiding(siding(null), true).hasPhone).toBe(false);
  });

  it('shahobcha yo\'li ham xuddi shunday', () => {
    expect(publicSiding(siding(), false).contactPhone).toBeNull();
    expect(publicSiding(siding(), true).contactPhone).toBe(PHONE);
  });

  // .map(publicSiding) yozilsa ikkinchi argument sifatida indeks ketadi va 1 dan boshlab "authed" bo'lardi
  it('map orqali chaqirilganda indeks authed bo\'lib ketmaydi', () => {
    const items = [siding(), siding(), siding()].map((x) => publicSiding(x));
    expect(items.every((x) => x.contactPhone === null)).toBe(true);
  });

  it('avto terminalda rail bo\'limi umuman yo\'q', () => {
    const road = { ...railTerminal(), kind: 'ROAD', rail: null } as unknown as TerminalRecord;
    expect(publicTerminal(road).rail).toBeNull();
    expect(publicTerminalCard(road).rail).toBeNull();
  });
});
