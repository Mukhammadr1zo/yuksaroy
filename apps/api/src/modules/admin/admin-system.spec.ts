// Tizim sahifasi chegaralari, sof: vagon manbasi ohangi va kunlik sikl eskirgani.
import { describe, expect, it } from 'vitest';
import { STALE_DAILY_MS, staleDaily, wagonTone } from './admin-system';

describe('wagonTone', () => {
  it("xato yo'q: ok, qidiruv bo'lmasa ham", () => {
    expect(wagonTone(0, 10)).toBe('ok');
    expect(wagonTone(0, 0)).toBe('ok');
  });
  it('bitta xato ham warn', () => {
    expect(wagonTone(1, 10)).toBe('warn');
    expect(wagonTone(4, 10)).toBe('warn');
  });
  it("yarmi va undan ko'p: bad", () => {
    expect(wagonTone(5, 10)).toBe('bad');
    expect(wagonTone(10, 10)).toBe('bad');
    expect(wagonTone(1, 1)).toBe('bad');
  });
});

describe('staleDaily', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  it('26 soatgacha eski emas, undan keyin eski', () => {
    expect(staleDaily(new Date(now.getTime() - STALE_DAILY_MS), now)).toBe(false);
    expect(staleDaily(new Date(now.getTime() - STALE_DAILY_MS - 1), now)).toBe(true);
    expect(staleDaily(new Date(now.getTime() - 25 * 3_600_000), now)).toBe(false);
    expect(staleDaily(new Date(now.getTime() - 27 * 3_600_000), now)).toBe(true);
  });
  it('hali yugurmagan (null) eski emas: alohida holat', () => {
    expect(staleDaily(null, now)).toBe(false);
    expect(staleDaily(undefined, now)).toBe(false);
  });
});
