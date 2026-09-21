// Platforma rollari o'z-o'ziga xizmat yo'llaridan berilmasligi kerak.
//
// Tekshiruvda topilgan zanjir: moderator o'z tashkilotini ochadi (unda isOwner=true
// bo'ladi), uni PLATFORM turiga o'tkazadi, keyin o'zini PLATFORM_ADMIN qilib taklif
// qiladi. Huquq tekshiruvi rol qaysi tashkilotda ekanini qaramaydi, ya'ni u to'liq
// ega bo'lib qoladi. Shu ikki test o'sha zanjirning ikkala halqasini ushlab turadi.
import { describe, expect, it } from 'vitest';
import { filterRoles, rolesForKinds } from './rules';

describe('platforma rollari o\'z-o\'ziga berilmaydi', () => {
  it("PLATFORM turidagi tashkilot ham platforma rolini bermaydi", () => {
    expect(rolesForKinds(['PLATFORM'])).toEqual([]);
  });

  it("so'ralsa ham filtrdan o'tmaydi", () => {
    expect(filterRoles(['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'], ['PLATFORM'])).toEqual([]);
    expect(filterRoles(['PLATFORM_ADMIN', 'CLIENT'], ['SHIPPER'])).toEqual(['CLIENT']);
  });

  it("oddiy rollar tegilmaydi", () => {
    expect(rolesForKinds(['CARRIER'])).toContain('CARRIER');
    expect(rolesForKinds(['TERMINAL'])).toContain('TERMINAL_OPERATOR');
  });

  it("bo'sh so'rov ham platforma rolini qaytarmaydi", () => {
    expect(filterRoles(undefined, ['PLATFORM'])).toEqual([]);
  });
});
