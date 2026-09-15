import { describe, expect, it } from 'vitest';
import {
  CLAIM_STATUS_LABELS, KYC_STATUS_LABELS, LISTING, LISTING_LABELS, LISTING_OWNER_LABELS, LISTING_RULES, LISTING_STATUSES, LISTING_TRANSITIONS,
  ORG_KINDS, ORG_KIND_LABELS, TransitionError, assertListingTransition, canListingTransition, orgSlug, validateListing,
  type ListingInput, type ListingStatus,
} from '@yuksaroy/domain';

const base: ListingInput = {
  kind: 'SHUNTING_LOCO', deal: 'RENT', title: 'TEM2 manevr teplovozi', description: null, regionCode: 'UZ-TK',
  terminalId: null, priceTiyin: 150_000_000, priceUnit: 'PER_MONTH', photos: ['/v1/files/a.jpg'],
  year: 2005, condition: 'GOOD', model: 'TEM2', qty: 1, wagonType: null, capacityT: 1200, truckType: null, tonnage: null,
  fleetSize: null, serviceRegions: [], routes: [], contactPhone: null, responseHours: 4,
};
const truck: ListingInput = {
  ...base, kind: 'TRUCK', deal: null, title: 'Tentli fura 20 t', year: null, condition: null, model: null, capacityT: null,
  priceTiyin: 250_000, priceUnit: 'PER_KM', photos: [], truckType: 'TENT', tonnage: 20, fleetSize: 3,
  serviceRegions: ['UZ-TK', 'UZ-TO'], routes: [{ from: 'UZ-TK', to: 'UZ-SA' }],
};
const codes = (r: { errors: { field: string; code: string }[] }) => r.errors.map((e) => `${e.field}:${e.code}`);

describe('validateListing', () => {
  it("to'liq teplovoz (RENT) xatosiz o'tadi", () => {
    const r = validateListing(base);
    expect(r.errors).toEqual([]);
    // terminalId ham sidingId ham yo'q: faqat ogohlantirish
    expect(r.warnings).toEqual([{ field: 'terminalId', code: 'MISSING_SHOULD' }]);
  });

  it('vagon turi bo\'lmasa REQUIRED', () => {
    const r = validateListing({ ...base, kind: 'WAGON', wagonType: null });
    expect(codes(r)).toContain('wagonType:REQUIRED');
    expect(validateListing({ ...base, kind: 'WAGON', wagonType: 'GONDOLA' }).errors).toEqual([]);
    expect(codes(validateListing({ ...base, kind: 'WAGON', wagonType: 'BOGIE' }))).toContain('wagonType:INVALID');
  });

  it("avto uchun bitim yo'q: DEAL_NOT_ALLOWED", () => {
    expect(validateListing(truck).errors).toEqual([]);
    expect(codes(validateListing({ ...truck, deal: 'RENT' }))).toEqual(['deal:DEAL_NOT_ALLOWED']);
  });

  it('terminal va shahobcha birga bo\'lmaydi: ONE_OBJECT_ONLY', () => {
    expect(validateListing({ ...base, terminalId: 't1' }).warnings).toEqual([]);
    expect(validateListing({ ...base, terminalId: 't1' }).warnings).toEqual([]);
  });

  it('narx birligi bitimga mos: UNIT_NOT_FOR_DEAL, PRICE_UNIT_REQUIRED', () => {
    expect(codes(validateListing({ ...base, deal: 'SALE', priceUnit: 'PER_MONTH' }))).toEqual(['priceUnit:UNIT_NOT_FOR_DEAL']);
    expect(validateListing({ ...base, deal: 'SALE', priceUnit: 'TOTAL' }).errors).toEqual([]);
    expect(codes(validateListing({ ...base, priceUnit: 'PER_KM' }))).toEqual(['priceUnit:UNIT_NOT_FOR_DEAL']);
    expect(codes(validateListing({ ...truck, priceUnit: 'PER_MONTH' }))).toEqual(['priceUnit:UNIT_NOT_FOR_DEAL']);
    expect(codes(validateListing({ ...base, priceUnit: null }))).toEqual(['priceUnit:PRICE_UNIT_REQUIRED']);
    // Narx so'rov bo'yicha: ikkalasi ham bo'sh, xato yo'q, faqat ogohlantirish
    const r = validateListing({ ...base, priceTiyin: null, priceUnit: null });
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.field)).toContain('priceTiyin');
  });

  it("should maydonlar yo'q bo'lsa faqat ogohlantirish", () => {
    const r = validateListing({ ...base, model: null, capacityT: null, priceTiyin: null, priceUnit: null, responseHours: null });
    expect(r.errors).toEqual([]);
    expect(r.warnings.every((w) => w.code === 'MISSING_SHOULD')).toBe(true);
    expect(r.warnings.map((w) => w.field).sort()).toEqual([...LISTING_RULES.SHUNTING_LOCO.should].sort());
  });

  it('must maydonlar: REQUIRED', () => {
    const r = validateListing({ ...base, title: '  ', deal: null, year: null, condition: null, photos: [] });
    expect(codes(r).sort()).toEqual(['condition:REQUIRED', 'deal:REQUIRED', 'photos:REQUIRED', 'title:REQUIRED', 'year:REQUIRED']);
    expect(codes(validateListing({ ...truck, serviceRegions: [], tonnage: null }))).toEqual(['tonnage:REQUIRED', 'serviceRegions:REQUIRED']);
  });

  it('diapazonlar: yil, soni, tonnaj, foto va yo\'nalish soni', () => {
    expect(codes(validateListing({ ...base, year: 1949 }))).toEqual(['year:RANGE']);
    expect(codes(validateListing({ ...base, year: new Date().getFullYear() + 1 }))).toEqual(['year:RANGE']);
    expect(codes(validateListing({ ...base, qty: 0 }))).toEqual(['qty:RANGE']);
    expect(codes(validateListing({ ...truck, tonnage: 101 }))).toEqual(['tonnage:RANGE']);
    expect(codes(validateListing({ ...base, photos: Array(LISTING.maxPhotos + 1).fill('x') }))).toEqual(['photos:TOO_MANY']);
    expect(codes(validateListing({ ...truck, routes: Array(LISTING.maxRoutes + 1).fill({ from: 'UZ-TK', to: 'UZ-SA' }) }))).toEqual(['routes:TOO_MANY']);
  });

  it('avto: xizmat hududi bazani o\'z ichiga oladi, yo\'nalish ikki xil viloyat', () => {
    expect(codes(validateListing({ ...truck, serviceRegions: ['UZ-SA'] }))).toEqual(['serviceRegions:SERVICE_REGIONS_MUST_INCLUDE_BASE']);
    expect(codes(validateListing({ ...truck, routes: [{ from: 'UZ-TK', to: 'UZ-TK' }] }))).toEqual(['routes:ROUTE_SAME_REGION']);
    expect(codes(validateListing({ ...truck, regionCode: 'UZ-XX' as never, serviceRegions: ['UZ-XX' as never] }))).toEqual(['regionCode:INVALID', 'serviceRegions:INVALID']);
  });

  it("egasi: avto yakka haydovchidan bo'ladi, temir yo'l texnikasi faqat tashkilotdan (ORG_REQUIRED)", () => {
    expect(validateListing({ ...truck, ownerType: 'person' }).errors).toEqual([]);
    expect(codes(validateListing({ ...base, kind: 'WAGON', wagonType: 'GONDOLA', ownerType: 'person' }))).toEqual(['ownerType:ORG_REQUIRED']);
    // ownerType bo'sh = tashkilot
    expect(validateListing({ ...base, ownerType: undefined }).errors).toEqual([]);
  });

  it('telefon: O\'zbekiston formati', () => {
    expect(validateListing({ ...base, contactPhone: '90 123 45 67' }).errors).toEqual([]);
    expect(codes(validateListing({ ...base, contactPhone: '12345' }))).toEqual(['contactPhone:INVALID']);
  });
});

describe('e\'lon holat-mashinasi', () => {
  it('egasi yuboradi, admin (yoki tizim) tasdiqlaydi, faqat admin rad etadi', () => {
    expect(canListingTransition('DRAFT', 'PENDING_REVIEW', 'OWNER')).toBe(true);
    expect(canListingTransition('DRAFT', 'PENDING_REVIEW', 'ADMIN')).toBe(false);
    expect(canListingTransition('PENDING_REVIEW', 'ACTIVE', 'ADMIN')).toBe(true);
    expect(canListingTransition('PENDING_REVIEW', 'ACTIVE', 'SYSTEM')).toBe(true);
    expect(canListingTransition('PENDING_REVIEW', 'ACTIVE', 'OWNER')).toBe(false);
    expect(canListingTransition('PENDING_REVIEW', 'REJECTED', 'SYSTEM')).toBe(false);
    expect(() => assertListingTransition('PENDING_REVIEW', 'REJECTED', 'OWNER')).toThrowError(TransitionError);
    expect(() => assertListingTransition('DRAFT', 'ACTIVE', 'ADMIN')).toThrowError(TransitionError);
  });

  it('faol: egasi yoki admin arxivlaydi, muddatni faqat tizim tugatadi', () => {
    expect(canListingTransition('ACTIVE', 'ARCHIVED', 'OWNER')).toBe(true);
    expect(canListingTransition('ACTIVE', 'ARCHIVED', 'ADMIN')).toBe(true);
    expect(canListingTransition('ACTIVE', 'EXPIRED', 'SYSTEM')).toBe(true);
    expect(canListingTransition('ACTIVE', 'EXPIRED', 'OWNER')).toBe(false);
  });

  it('simmetriya: DRAFT dan boshqa har bir holatga kiriladi va ACTIVE dan tashqari har biridan PENDING_REVIEW ga qaytiladi', () => {
    for (const t of LISTING_TRANSITIONS) {
      expect(LISTING_STATUSES).toContain(t.from);
      expect(LISTING_STATUSES).toContain(t.to);
      expect(t.from).not.toBe(t.to);
      expect(t.actors.length).toBeGreaterThan(0);
    }
    const targets = new Set(LISTING_TRANSITIONS.map((t) => t.to));
    for (const s of LISTING_STATUSES) expect(targets.has(s)).toBe(s !== 'DRAFT');
    const resubmit: ListingStatus[] = ['REJECTED', 'ARCHIVED', 'EXPIRED'];
    for (const s of resubmit) expect(canListingTransition(s, 'PENDING_REVIEW', 'OWNER')).toBe(true);
    expect(canListingTransition('ACTIVE', 'PENDING_REVIEW', 'OWNER')).toBe(false);
    // ACTIVE ga faqat PENDING_REVIEW orqali
    expect(LISTING_TRANSITIONS.filter((t) => t.to === 'ACTIVE').every((t) => t.from === 'PENDING_REVIEW')).toBe(true);
  });
});

describe('yorliqlar va slug', () => {
  it('uch tilda hamma kalit bor', () => {
    for (const lang of ['uz', 'ru', 'en'] as const) {
      for (const k of ORG_KINDS) expect(ORG_KIND_LABELS[lang][k]).toBeTruthy();
      expect(Object.keys(KYC_STATUS_LABELS[lang])).toHaveLength(4);
      expect(Object.keys(CLAIM_STATUS_LABELS[lang])).toHaveLength(4);
      for (const s of LISTING_STATUSES) expect(LISTING_LABELS[lang].status[s]).toBeTruthy();
      expect(Object.keys(LISTING_LABELS[lang].priceUnit)).toHaveLength(7);
      expect(LISTING_OWNER_LABELS[lang].person && LISTING_OWNER_LABELS[lang].org).toBeTruthy();
    }
  });

  it('orgSlug: lotin, kirill va bo\'sh nom', () => {
    expect(orgSlug("Toshkent Yuk Saroyi MCHJ")).toBe('toshkent-yuk-saroyi-mchj');
    expect(orgSlug('Ташкент Логистик')).toBe('tashkent-logistik');
    expect(orgSlug("O'zbekiston Temir Yo'llari")).toBe('ozbekiston-temir-yollari');
    expect(orgSlug('   ')).toBe('tashkilot');
    expect(orgSlug('***')).toBe('tashkilot');
  });
});
