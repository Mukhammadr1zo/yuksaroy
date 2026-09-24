import { describe, expect, it } from 'vitest';
import { revealFunnel } from './admin-system.controller';

/**
 * Voronka to'rtta sonni beradi: nechta odam, nechta ochilish, shundan obunachi va
 * obunasiz ochilishlar. Yuqori qator ODAM, past qator OCHILISH: bu ikki birlik
 * aralashib ketmasligi uchun test ularni alohida qotiradi.
 */
describe('raqam ochish voronkasi', () => {
  it("obunachi odam bo'yicha, ochilish qator bo'yicha sanaladi", () => {
    const by = [
      { actorId: 'paid1', _count: { _all: 12 } },
      { actorId: 'free1', _count: { _all: 3 } },
      { actorId: 'paid2', _count: { _all: 5 } },
    ];
    expect(revealFunnel(by, new Set(['paid1', 'paid2']))).toEqual({ people: 3, reveals: 20, subscribers: 2, freeReveals: 3 });
  });

  it("bo'sh oyda to'rttasi ham nol", () => {
    expect(revealFunnel([], new Set())).toEqual({ people: 0, reveals: 0, subscribers: 0, freeReveals: 0 });
  });
});
