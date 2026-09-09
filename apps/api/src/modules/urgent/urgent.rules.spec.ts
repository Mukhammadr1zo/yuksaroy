import { describe, expect, it } from 'vitest';
import { URGENT_STATUSES } from '@yuksaroy/domain';
import { URGENT_TRANSITIONS, awardOffers, canUrgentTransition, notifyRegions } from './urgent.rules';

describe('urgent holatlari', () => {
  it('jadval to\'liq va yakuniy holatlardan chiqib bo\'lmaydi', () => {
    for (const s of URGENT_STATUSES) expect(URGENT_TRANSITIONS[s]).toBeDefined();
    expect(canUrgentTransition('OPEN', 'AWARDED')).toBe(true);
    expect(canUrgentTransition('OPEN', 'CLOSED')).toBe(true);
    expect(canUrgentTransition('AWARDED', 'CLOSED')).toBe(true);
    expect(canUrgentTransition('AWARDED', 'AWARDED')).toBe(false);
    expect(canUrgentTransition('CLOSED', 'OPEN')).toBe(false);
    expect(canUrgentTransition('CANCELLED', 'AWARDED')).toBe(false);
    expect(canUrgentTransition('nope', 'CLOSED')).toBe(false);
  });

  it('awardOffers: tanlangani AWARDED, qolgan SENT lar DECLINED, boshqalar tegilmaydi', () => {
    const offers = [{ id: 'a', status: 'SENT' }, { id: 'b', status: 'SENT' }, { id: 'c', status: 'DECLINED' }];
    expect(awardOffers(offers, 'b')).toEqual([{ id: 'a', status: 'DECLINED' }, { id: 'b', status: 'AWARDED' }]);
    expect(awardOffers(offers, 'c')).toBeNull();
    expect(awardOffers(offers, 'zzz')).toBeNull();
  });

  it('notifyRegions: viloyat + qo\'shnilar', () => {
    expect(notifyRegions('UZ-TK')).toEqual(['UZ-TK', 'UZ-TO']);
    expect(notifyRegions('UZ-SA')).toEqual(['UZ-SA', 'UZ-QA', 'UZ-JI', 'UZ-NW', 'UZ-BU']);
  });
});
