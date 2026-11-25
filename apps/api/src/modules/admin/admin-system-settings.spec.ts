// Faoliyat xabari kalitlari: faqat son 0 yoki 1 qabul qilinadi.
import { describe, expect, it } from 'vitest';
import { PLATFORM_DEFAULTS } from '@yuksaroy/domain';
import { CHECK } from './admin-system.controller';

const KEYS = ['activityLogin', 'activityActions', 'activityVisits', 'activityAdmin', 'activitySystem', 'activitySelf', 'activityAdminVisits'] as const;

describe('faoliyat sozlamalari', () => {
  it.each(KEYS)('%s: 0 va 1 ok, boshqasi rad', (k) => {
    expect(CHECK[k](0)).toBe(true);
    expect(CHECK[k](1)).toBe(true);
    for (const bad of [2, -1, '1', true, 0.5, null, undefined]) expect(CHECK[k](bad), String(bad)).toBe(false);
  });
  it("standartlar: tizim hodisalari va xodim tashrifi o'chiq, qolgani (o'z amali ham) yoqiq", () => {
    expect(KEYS.map((k) => PLATFORM_DEFAULTS[k])).toEqual([1, 1, 1, 1, 0, 1, 0]);
  });
});
