// Maxfiylik qoidasi: mas'ul shaxs ismi ochiq, telefon raqami ochiq javobda hech qachon
// yo'q (u obunachiga GET /contacts orqali beriladi), lekin bor-yo'qligi bilinadi.
// Ilgari raqam kirgan foydalanuvchiga javobning o'zida qaytardi; endi bunday yo'l yo'q.
// Bu qoida bir nechta funksiyada takrorlanadi, shuning uchun hammasi tekshiriladi. DB kerak emas.
import { describe, expect, it } from 'vitest';
import type { SidingRecord, TerminalRecord } from '../domain/ports';
import { publicSiding, publicTerminal, publicTerminalCard } from './mappers';

const PHONE = '+998901234567';
const OWN_PHONE = '+998712000000';

const railTerminal = (contactPhone: string | null = PHONE, phone: string | null = null): TerminalRecord =>
  ({
    id: 't1', orgId: null, orgName: null, stationId: null, station: null, kind: 'RAIL', slug: 'bekobod-shahobcha-1',
    name: 'Bekobod shahobcha', description: null, address: null, phone, lat: null, lng: null, is24h: false,
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

describe('telefon raqami ochiq javobda', () => {
  it("terminal tafsilotida raqam umuman yo'q, lekin borligi bilinadi", () => {
    const t = publicTerminal(railTerminal(PHONE, OWN_PHONE), 0);
    const json = JSON.stringify(t);
    expect(json).not.toContain(PHONE);
    expect(json).not.toContain(OWN_PHONE);
    expect(t.hasPhone).toBe(true);
    expect(t.rail!.hasPhone).toBe(true);
    expect(t.rail!.contactName).toBe('Ahmad Karimov');
  });

  it("obyektning o'z raqami bo'lsa ham hasPhone true", () => {
    expect(publicTerminal(railTerminal(null, OWN_PHONE)).hasPhone).toBe(true);
  });

  it("ikkala raqam ham yo'q bo'lsa hasPhone false", () => {
    expect(publicTerminal(railTerminal(null, null)).hasPhone).toBe(false);
    expect(publicTerminal(railTerminal(null, null)).rail!.hasPhone).toBe(false);
    expect(publicSiding(siding(null)).hasPhone).toBe(false);
  });

  // Karta ro'yxatda o'nlab marta chiziladi: raqam u yerda umuman bo'lmasligi kerak
  it("kartada raqam umuman yo'q", () => {
    const c = publicTerminalCard(railTerminal(PHONE, OWN_PHONE)) as Record<string, unknown>;
    const json = JSON.stringify(c);
    expect(json).not.toContain(PHONE);
    expect(json).not.toContain(OWN_PHONE);
    expect((c.rail as { hasPhone: boolean }).hasPhone).toBe(true);
  });

  it("shahobcha yo'li ham xuddi shunday", () => {
    const s = publicSiding(siding());
    expect(JSON.stringify(s)).not.toContain(PHONE);
    expect(s.hasPhone).toBe(true);
    expect(s.contactName).toBe('Ahmad Karimov');
  });

  // .map(publicSiding) yozilsa ikkinchi argument sifatida indeks ketadi: hech qanday ta'siri bo'lmasligi kerak
  it("map orqali chaqirilganda ham raqam chiqmaydi", () => {
    const items = [siding(), siding(), siding()].map((x) => publicSiding(x));
    expect(JSON.stringify(items)).not.toContain(PHONE);
  });

  it("avto terminalda rail bo'limi umuman yo'q", () => {
    const road = { ...railTerminal(), kind: 'ROAD', rail: null } as unknown as TerminalRecord;
    expect(publicTerminal(road).rail).toBeNull();
    expect(publicTerminalCard(road).rail).toBeNull();
  });
});
