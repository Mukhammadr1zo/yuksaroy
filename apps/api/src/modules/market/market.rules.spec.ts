import { describe, expect, it } from 'vitest';
import { MARKET_STATUSES } from '@yuksaroy/domain';
import { MARKET_TRANSITIONS, canMarketTransition, formatMarketNo, offerDenial, validateRequest } from './market.rules';

describe('bozor holatlari', () => {
  it("jadval to'liq, yakuniy holatdan chiqib bo'lmaydi", () => {
    for (const s of MARKET_STATUSES) expect(MARKET_TRANSITIONS[s]).toBeDefined();
    expect(canMarketTransition('OPEN', 'AWARDED')).toBe(true);
    expect(canMarketTransition('OPEN', 'CANCELLED')).toBe(true);
    expect(canMarketTransition('AWARDED', 'CLOSED')).toBe(true);
    expect(canMarketTransition('AWARDED', 'CANCELLED')).toBe(false);
    expect(canMarketTransition('CLOSED', 'OPEN')).toBe(false);
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

  it("yuk: yo'nalish, og'irlik, sana va kuzov tekshiriladi", () => {
    const e = validateRequest({ ...cargo, fromRegion: 'XX', toRegion: null, weightT: 0, loadDate: '2026-09-20', truckType: 'BUS', cargoName: ' ' }, today);
    expect(e).toEqual({ fromRegion: 'INVALID', toRegion: 'REQUIRED', weightT: 'RANGE', loadDate: 'PAST', truckType: 'INVALID', cargoName: 'REQUIRED' });
    expect(validateRequest({ ...cargo, loadDate: '22.09.2026' }, today).loadDate).toBe('INVALID');
    expect(validateRequest({ ...cargo, weightT: null }, today).weightT).toBe('REQUIRED');
  });

  it("xizmat: tur va viloyat shart, yuk maydonlari so'ralmaydi", () => {
    expect(validateRequest({ board: 'SERVICE', title: 'Deklaratsiya', description: 'Eksport hujjatlari kerak', serviceType: 'DOCS', regionCode: 'UZ-TK' }, today)).toEqual({});
    expect(validateRequest({ board: 'SERVICE', title: 'x', description: 'y', serviceType: 'PLUMBER' }, today)).toEqual({ serviceType: 'INVALID', regionCode: 'REQUIRED' });
  });

  it("sarlavha va tavsif chegarasi, noma'lum taxta", () => {
    expect(validateRequest({ board: 'CARGO', title: 'a'.repeat(121), description: '' }, today)).toMatchObject({ title: 'TOO_LONG', description: 'REQUIRED' });
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
