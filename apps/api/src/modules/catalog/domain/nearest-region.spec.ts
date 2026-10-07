import { describe, expect, it } from 'vitest';
import { nearestRegionWith } from './nearest-region';

/**
 * Bo'sh katalog sahifasidagi "eng yaqin natija" havolasi. Xato ishlasa havola yo bo'sh
 * viloyatga olib boradi, yo yonidagi viloyat turib uzoqdagisini ko'rsatadi.
 */
describe("bo'sh natijada eng yaqin viloyat", () => {
  it("qo'shni viloyatda bo'lsa o'sha va uning soni", () => {
    expect(nearestRegionWith('UZ-SI', { 'UZ-TO': 3 })).toEqual({ region: 'UZ-TO', total: 3 });
  });

  it("bitta halqada markazi yaqini tanlanadi, soni ko'pi emas", () => {
    // Samarqanddan Jizzax ~90 km, Buxoro ~215 km
    expect(nearestRegionWith('UZ-SA', { 'UZ-BU': 9, 'UZ-JI': 1 })).toEqual({ region: 'UZ-JI', total: 1 });
  });

  it("qo'shni halqa masofadan ustun", () => {
    // Qashqadaryodan Navoiy markazi Surxondaryodan yaqinroq, lekin u qo'shni emas
    expect(nearestRegionWith('UZ-QA', { 'UZ-NW': 5, 'UZ-SU': 1 })?.region).toBe('UZ-SU');
  });

  it("qo'shnilarda yo'q bo'lsa keyingi halqadan, uzoq bo'lsa ham", () => {
    expect(nearestRegionWith('UZ-TK', { 'UZ-SI': 2 })?.region).toBe('UZ-SI');
    expect(nearestRegionWith('UZ-SU', { 'UZ-FA': 1 })?.region).toBe('UZ-FA');
  });

  it("nol sanoq va so'ralgan viloyatning o'zi hisobga olinmaydi", () => {
    expect(nearestRegionWith('UZ-SI', { 'UZ-TO': 0, 'UZ-JI': 2 })?.region).toBe('UZ-JI');
    expect(nearestRegionWith('UZ-SI', { 'UZ-SI': 4 })).toBeNull();
    expect(nearestRegionWith('UZ-SI', {})).toBeNull();
  });
});
