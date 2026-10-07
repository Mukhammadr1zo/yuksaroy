import { describe, expect, it } from 'vitest';
import { MARKET_STATUSES } from '@yuksaroy/domain';
import { MARKET_TRANSITIONS, canMarketTransition, cargoTitle, formatMarketNo, isListed, offerDenial, validateRequest } from './market.rules';

describe('bozor holatlari', () => {
  it("jadval to'liq, yakuniy holatdan chiqib bo'lmaydi", () => {
    for (const s of MARKET_STATUSES) expect(MARKET_TRANSITIONS[s]).toBeDefined();
    expect(canMarketTransition('OPEN', 'AWARDED')).toBe(true);
    expect(canMarketTransition('OPEN', 'CANCELLED')).toBe(true);
    expect(canMarketTransition('AWARDED', 'CLOSED')).toBe(true);
    expect(canMarketTransition('AWARDED', 'CANCELLED')).toBe(false);
    expect(canMarketTransition('CLOSED', 'OPEN')).toBe(false);
    expect(canMarketTransition('AWARDED', 'DONE')).toBe(true);
    // Ish qilinmagan so'rovni bajarilgan deb belgilab bo'lmaydi
    expect(canMarketTransition('OPEN', 'DONE')).toBe(false);
    // DONE yakuniy: sanoq ortga qaytmasin
    expect(canMarketTransition('DONE', 'CLOSED')).toBe(false);
    expect(canMarketTransition('DONE', 'OPEN')).toBe(false);
    expect(canMarketTransition('nope', 'CLOSED')).toBe(false);
  });

  it('raqam taxtaga qarab prefiks oladi', () => {
    expect(formatMarketNo('CARGO', 1001)).toBe('CR-1001');
    expect(formatMarketNo('SERVICE', 1002)).toBe('SR-1002');
  });
});

describe('validateRequest', () => {
  const today = '2026-09-21';
  const cargo = { board: 'CARGO', title: 'Sement', description: '20 t sement Toshkentdan Samarqandga', fromRegion: 'UZ-TK', toRegion: 'UZ-SA', cargoName: 'Sement', weightT: 20, loadDate: '2026-09-22', truckType: 'TENT' };

  it("to'g'ri yuk e'loni xatosiz", () => {
    expect(validateRequest(cargo, today)).toEqual({});
    expect(validateRequest({ ...cargo, loadDate: today, truckType: null }, today)).toEqual({});
  });

  // Yuk e'lonida sarlavha va tavsif so'ralmaydi: sarlavha yuk nomi va og'irligidan
  // tuziladi, tavsif esa ixtiyoriy. Xizmat so'rovida ikkalasi ham majburiy bo'lib qoladi.
  it("yukda sarlavha va tavsif talab qilinmaydi", () => {
    const { title, description, ...noText } = { ...cargo, title: undefined, description: undefined };
    expect(validateRequest(noText as never, today)).toEqual({});
  });

  it("xizmat so'rovida sarlavha va tavsif majburiy", () => {
    const svc = { board: 'SERVICE', serviceType: 'DOCS', regionCode: 'UZ-TK' };
    const e = validateRequest(svc as never, today);
    expect(e.title).toBe('REQUIRED');
    expect(e.description).toBe('REQUIRED');
  });

  it("narx aytishga yordam beradigan uch maydon tekshiriladi", () => {
    expect(validateRequest({ ...cargo, volumeM3: -1 }, today).volumeM3).toBe('RANGE');
    expect(validateRequest({ ...cargo, volumeM3: 2000 }, today).volumeM3).toBe('RANGE');
    expect(validateRequest({ ...cargo, trucksCount: 0 }, today).trucksCount).toBe('RANGE');
    expect(validateRequest({ ...cargo, trucksCount: 2.5 }, today).trucksCount).toBe('RANGE');
    expect(validateRequest({ ...cargo, paymentTerm: 'BARTER' }, today).paymentTerm).toBe('INVALID');
    expect(validateRequest({ ...cargo, volumeM3: 40, trucksCount: 3, paymentTerm: 'CASH' }, today)).toEqual({});
  });

  it("sarlavha yuk nomi va og'irligidan tuziladi", () => {
    expect(cargoTitle({ cargoName: 'Sement', weightT: 20 })).toBe('Sement, 20 t');
    expect(cargoTitle({ cargoName: "  Bug'doy  ", weightT: null })).toBe("Bug'doy");
    expect(cargoTitle({ cargoName: 'x'.repeat(200), weightT: 5 }).length).toBeLessThanOrEqual(120);
  });

  // Telefon tekshiruvi kontrollerdan shu yerga ko'chdi: endi mijoz ham xuddi shu qoidani ishlatadi
  it("telefon raqami tekshiriladi, bo'sh bo'lsa talab qilinmaydi", () => {
    expect(validateRequest({ ...cargo, contactPhone: '123' }, today).contactPhone).toBe('INVALID');
    expect(validateRequest({ ...cargo, contactPhone: '+998901234567' }, today)).toEqual({});
    expect(validateRequest({ ...cargo, contactPhone: '' }, today)).toEqual({});
  });

  it("yuk: yo'nalish, og'irlik, sana va kuzov tekshiriladi", () => {
    const e = validateRequest({ ...cargo, fromRegion: 'XX', toRegion: null, weightT: 0, loadDate: '2026-09-20', truckType: 'BUS', cargoName: ' ' }, today);
    expect(e).toEqual({ fromRegion: 'INVALID', toRegion: 'REQUIRED', weightT: 'RANGE', loadDate: 'PAST', truckType: 'INVALID', cargoName: 'REQUIRED' });
    expect(validateRequest({ ...cargo, loadDate: '22.09.2026' }, today).loadDate).toBe('INVALID');
    // Kalendarda yo'q kun: Date uni 3-martga surardi, so'rovchi kiritmagan sana saqlanib qolardi
    expect(validateRequest({ ...cargo, loadDate: '2026-02-31' }, today).loadDate).toBe('INVALID');
    expect(validateRequest({ ...cargo, loadDate: '2026-13-01' }, today).loadDate).toBe('INVALID');
    expect(validateRequest({ ...cargo, loadDate: '2028-02-29' }, today)).toEqual({});
    expect(validateRequest({ ...cargo, weightT: null }, today).weightT).toBe('REQUIRED');
  });

  it("xizmat: tur va viloyat shart, yuk maydonlari so'ralmaydi", () => {
    expect(validateRequest({ board: 'SERVICE', title: 'Deklaratsiya', description: 'Eksport hujjatlari kerak', serviceType: 'DOCS', regionCode: 'UZ-TK' }, today)).toEqual({});
    expect(validateRequest({ board: 'SERVICE', title: 'x', description: 'y', serviceType: 'PLUMBER' }, today)).toEqual({ serviceType: 'INVALID', regionCode: 'REQUIRED' });
  });

  it("sarlavha va tavsif chegarasi, noma'lum taxta", () => {
    // Uzunlik chegarasi endi xizmat so'rovida: yuk sarlavhasini server o'zi tuzadi
    expect(validateRequest({ board: 'SERVICE', serviceType: 'DOCS', regionCode: 'UZ-TK', title: 'a'.repeat(121), description: '' }, today))
      .toMatchObject({ title: 'TOO_LONG', description: 'REQUIRED' });
    // Yukda uzun tavsif baribir kesiladi
    expect(validateRequest({ ...cargo, description: 'a'.repeat(2001) }, today)).toMatchObject({ description: 'TOO_LONG' });
    expect(validateRequest({ board: 'X', title: 'a', description: 'b' }, today)).toEqual({ board: 'INVALID' });
  });
});

describe('offerDenial', () => {
  const svc = { status: 'OPEN', createdById: 'u1', board: 'SERVICE', serviceType: 'DOCS' };
  const cargo = { status: 'OPEN', createdById: 'u1', board: 'CARGO', serviceType: null };

  it("o'ziga va yopiq so'rovga yo'q", () => {
    expect(offerDenial(svc, 'u1', ['DOCS'])).toBe('OWN_REQUEST');
    expect(offerDenial({ ...svc, status: 'CLOSED' }, 'u2', ['DOCS'])).toBe('NOT_OPEN');
  });

  it("xizmat so'roviga faqat o'sha turdagi faol profil, yukka kirgan har kim", () => {
    expect(offerDenial(svc, 'u2', ['DOCS'])).toBeNull();
    expect(offerDenial(svc, 'u2', ['FORWARDER'])).toBe('NOT_PROVIDER');
    expect(offerDenial(svc, 'u2', [])).toBe('NOT_PROVIDER');
    expect(offerDenial(cargo, 'u2', [])).toBeNull();
  });
});

describe("namuna so'rovga taklif", () => {
  it('rad etiladi, holati OPEN bo\'lsa ham', () => {
    const demo = { status: 'OPEN', createdById: 'u-owner', board: 'CARGO', serviceType: null, isDemo: true };
    expect(offerDenial(demo, 'u-other', [])).toBe('DEMO_TARGET');
    // Haqiqiy so'rovda bayroq yo'q yoki false: qoida aralashmaydi
    expect(offerDenial({ ...demo, isDemo: false }, 'u-other', [])).toBeNull();
  });
});

/** Kabinet "so'rovingiz doskada turadi" ni faqat shunda aytadi: ochiq doska (visible) bilan bir qoida. */
describe("doskada ko'rinadimi (isListed)", () => {
  const now = new Date('2026-10-07T10:00:00Z');
  const r = (over: { status?: string; createdAt?: Date; loadDate?: Date | null } = {}) => ({ status: 'OPEN', createdAt: new Date('2026-10-01T00:00:00Z'), loadDate: null, ...over });

  it("ochiq, yangi va yuklash kuni o'tmagan so'rov doskada; bugungi kun ham", () => {
    expect(isListed(r(), now)).toBe(true);
    expect(isListed(r({ loadDate: new Date('2026-10-07T00:00:00Z') }), now)).toBe(true);
  });

  it("bekor qilingan, sanasi o'tgan yoki 30 kundan eski so'rov doskada emas", () => {
    expect(isListed(r({ status: 'CANCELLED' }), now)).toBe(false);
    expect(isListed(r({ status: 'AWARDED' }), now)).toBe(false);
    expect(isListed(r({ loadDate: new Date('2026-10-06T00:00:00Z') }), now)).toBe(false);
    expect(isListed(r({ createdAt: new Date('2026-09-01T00:00:00Z') }), now)).toBe(false);
  });

  it('kun Toshkent bilan almashadi: UTC kechqurun Toshkentda ertangi kun', () => {
    // 20:00 UTC = Toshkentda ertasi 01:00, ya'ni 7-oktabrdagi yuklash allaqachon o'tgan
    expect(isListed(r({ loadDate: new Date('2026-10-07T00:00:00Z') }), new Date('2026-10-07T20:00:00Z'))).toBe(false);
  });
});
