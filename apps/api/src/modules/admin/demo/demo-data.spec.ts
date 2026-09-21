// Namuna ma'lumotlar: sonlar yetarli, hammasi isDemo, telefon yo'q, id/slug/telefon takrorlanmaydi, e'lonlar asl forma qoidasidan o'tadi.
import { describe, expect, it } from 'vitest';
import { SERVICE_TYPES, TRUCK_TYPES, validateListing } from '@yuksaroy/domain';
import { DEMO_LISTINGS, DEMO_ORGS, DEMO_REQUESTS, DEMO_SERVICES, DEMO_USERS, isRegion } from './demo-data';

const unique = (xs: string[]) => new Set(xs).size === xs.length;
const count = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

describe('namuna ma\'lumotlar', () => {
  it('tashkilotlar: 12 ta, turlar bo\'yicha, slug va viloyat to\'g\'ri', () => {
    expect(DEMO_ORGS).toHaveLength(12);
    expect(count(DEMO_ORGS, (o) => o.kind === 'CARRIER')).toBe(4);
    expect(count(DEMO_ORGS, (o) => o.kind === 'ASSET_OWNER')).toBe(3);
    expect(count(DEMO_ORGS, (o) => o.kind === 'FORWARDER')).toBe(2);
    expect(count(DEMO_ORGS, (o) => o.kind === 'DECLARANT')).toBe(2);
    expect(count(DEMO_ORGS, (o) => o.kind === 'SHIPPER')).toBe(1);
    expect(unique(DEMO_ORGS.map((o) => o.slug))).toBe(true);
    for (const o of DEMO_ORGS) { expect(o.slug).toMatch(/^namuna-[a-z0-9-]+$/); expect(isRegion(o.regionCode)).toBe(true); }
  });

  it('odamlar: har tashkilotga bitta egasi, telefonlar takrorlanmaydi va +998 9000001xx seriyasida', () => {
    expect(unique(DEMO_USERS.map((u) => u.phone))).toBe(true);
    expect(unique(DEMO_USERS.map((u) => u.id))).toBe(true);
    for (const u of DEMO_USERS) expect(u.phone).toMatch(/^\+9989000001\d{2}$/);
    for (const o of DEMO_ORGS) expect(count(DEMO_USERS, (u) => u.orgId === o.id && u.roles.length > 0)).toBe(1);
  });

  it('e\'lonlar: kamida 10 vagon, 10 avto, 5 teplovoz; telefon yo\'q; validateListing xatosiz', () => {
    expect(count(DEMO_LISTINGS, (l) => l.input.kind === 'WAGON')).toBeGreaterThanOrEqual(10);
    expect(count(DEMO_LISTINGS, (l) => l.input.kind === 'TRUCK')).toBeGreaterThanOrEqual(10);
    expect(count(DEMO_LISTINGS, (l) => l.input.kind === 'SHUNTING_LOCO')).toBeGreaterThanOrEqual(5);
    expect(unique(DEMO_LISTINGS.map((l) => l.slug))).toBe(true);
    expect(unique(DEMO_LISTINGS.map((l) => l.id))).toBe(true);
    const orgIds = new Set(DEMO_ORGS.map((o) => o.id));
    for (const l of DEMO_LISTINGS) {
      expect(l.input.contactPhone).toBeNull();
      expect(orgIds.has(l.orgId)).toBe(true);
      // Vagon va teplovoz faqat texnika egasidan, avto faqat tashuvchidan: karta egasi qatori mantiqli bo'lsin
      const org = DEMO_ORGS.find((o) => o.id === l.orgId)!;
      expect(org.kind).toBe(l.input.kind === 'TRUCK' ? 'CARRIER' : 'ASSET_OWNER');
      const { errors } = validateListing(l.input);
      expect(errors, `${l.slug}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('xizmat profillari: har turdan 10 ta, egasi namuna odam, viloyat 1-3 ta', () => {
    for (const t of SERVICE_TYPES) expect(count(DEMO_SERVICES, (s) => s.serviceType === t)).toBeGreaterThanOrEqual(10);
    expect(unique(DEMO_SERVICES.map((s) => s.id))).toBe(true);
    const userIds = new Set(DEMO_USERS.map((u) => u.id));
    for (const s of DEMO_SERVICES) {
      expect(userIds.has(s.userId)).toBe(true);
      expect(s.regions.length).toBeGreaterThanOrEqual(1);
      expect(s.regions.length).toBeLessThanOrEqual(3);
      expect(s.regions.every(isRegion)).toBe(true);
      expect(s.description.length).toBeGreaterThan(40);
    }
  });

  it('so\'rovlar: 10 yuk (turli viloyatlar orasida), 10 xizmat; egasi namuna odam', () => {
    const cargo = DEMO_REQUESTS.filter((r) => r.board === 'CARGO');
    const service = DEMO_REQUESTS.filter((r) => r.board === 'SERVICE');
    expect(cargo.length).toBeGreaterThanOrEqual(10);
    expect(service.length).toBeGreaterThanOrEqual(10);
    expect(unique(DEMO_REQUESTS.map((r) => r.id))).toBe(true);
    const userIds = new Set(DEMO_USERS.map((u) => u.id));
    for (const r of DEMO_REQUESTS) { expect(userIds.has(r.createdById)).toBe(true); expect(isRegion(r.regionCode)).toBe(true); }
    for (const r of cargo) {
      expect(r.fromRegion).not.toBe(r.toRegion);
      expect(r.fromRegion).toBe(r.regionCode);
      expect((TRUCK_TYPES as readonly string[]).includes(r.truckType!)).toBe(true);
      expect(r.weightT).toBeGreaterThan(0);
      expect(r.loadInDays).toBeGreaterThanOrEqual(1);
      expect(r.loadInDays).toBeLessThanOrEqual(14);
    }
    for (const r of service) expect((SERVICE_TYPES as readonly string[]).includes(r.serviceType!)).toBe(true);
  });

  it('matnda tipografik belgi yo\'q (loyiha qoidasi)', () => {
    const text = JSON.stringify([DEMO_ORGS, DEMO_USERS, DEMO_LISTINGS, DEMO_SERVICES, DEMO_REQUESTS]);
    for (const c of [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d]) expect(text.includes(String.fromCharCode(c))).toBe(false);
  });
});
