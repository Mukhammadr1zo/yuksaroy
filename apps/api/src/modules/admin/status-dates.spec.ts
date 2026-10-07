import { describe, expect, it } from 'vitest';
import { statusDates } from './admin-ops.controller';

const now = new Date('2026-10-07T10:00:00Z');

describe('admin holatni qo\'lda o\'zgartirganda sanalar', () => {
  it("bir xil holatda saqlash sanaga tegmaydi: yakunlangan oy joyida qoladi", () => {
    expect(statusDates('DONE', 'DONE', now)).toEqual({});
    expect(statusDates('CONFIRMED', 'CONFIRMED', now)).toEqual({});
  });

  it("haqiqiy o'tishda sana qo'yiladi", () => {
    expect(statusDates('IN_PROGRESS', 'DONE', now)).toEqual({ closedAt: now });
    expect(statusDates('CONFIRMED', 'CANCELLED', now)).toEqual({ closedAt: now });
    expect(statusDates('PENDING', 'CONFIRMED', now)).toEqual({ confirmedAt: now });
    expect(statusDates('DONE', 'IN_PROGRESS', now)).toEqual({});
  });
});
