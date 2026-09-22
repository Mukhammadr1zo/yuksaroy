import { describe, expect, it } from 'vitest';
import {
  ORDER_FINAL, ORDER_STATUSES, ORDER_TRANSITIONS, TransitionError,
  assertOrderTransition, canOrderTransition, formatOrderNo, uzDateText, uzLocalDate, uzLocalToUtc,
  type OrderStatus,
} from '@yuksaroy/domain';
import { defaultWindows, enumerateDates } from '../../booking/application/manage-slots.usecase';

describe('buyurtma holat-mashinasi', () => {
  it('tasdiq va rad - faqat terminal (yoki admin)', () => {
    expect(canOrderTransition('PENDING', 'CONFIRMED', 'TERMINAL')).toBe(true);
    expect(canOrderTransition('PENDING', 'REJECTED', 'ADMIN')).toBe(true);
    expect(canOrderTransition('PENDING', 'CONFIRMED', 'CLIENT')).toBe(false);
    expect(() => assertOrderTransition('PENDING', 'CONFIRMED', 'CLIENT')).toThrowError(TransitionError);
  });

  it('muddat - faqat tizim, bekor qilish - mijoz', () => {
    expect(canOrderTransition('PENDING', 'EXPIRED', 'SYSTEM')).toBe(true);
    expect(canOrderTransition('PENDING', 'EXPIRED', 'TERMINAL')).toBe(false);
    expect(canOrderTransition('PENDING', 'CANCELLED', 'CLIENT')).toBe(true);
    // Tasdiqlangandan keyin ham bekor qilinadi (12 soat qoidasi use-case'da tekshiriladi)
    expect(canOrderTransition('CONFIRMED', 'CANCELLED', 'CLIENT')).toBe(true);
    expect(canOrderTransition('CONFIRMED', 'CANCELLED', 'TERMINAL')).toBe(true); // NO_SHOW
  });

  it('yakuniy holatlardan chiqish yo\'q va sakrash mumkin emas', () => {
    for (const s of ORDER_FINAL) {
      expect(ORDER_TRANSITIONS.filter((t) => t.from === s)).toHaveLength(0);
    }
    expect(canOrderTransition('PENDING', 'DONE', 'TERMINAL')).toBe(false);
    expect(canOrderTransition('PENDING', 'IN_PROGRESS', 'TERMINAL')).toBe(false);
    expect(canOrderTransition('CONFIRMED', 'DONE', 'TERMINAL')).toBe(false); // avval IN_PROGRESS
  });

  it('to\'liq yo\'l: PENDING → CONFIRMED → IN_PROGRESS → DONE', () => {
    const path: OrderStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(() => assertOrderTransition(path[i]!, path[i + 1]!, 'TERMINAL')).not.toThrow();
    }
  });

  it('jadvaldagi barcha holatlar enum ichida', () => {
    for (const t of ORDER_TRANSITIONS) {
      expect(ORDER_STATUSES).toContain(t.from);
      expect(ORDER_STATUSES).toContain(t.to);
    }
  });
});

describe('slot kalendari va Toshkent vaqti', () => {
  it('kunlar oralig\'i, dam olish kunlarisiz', () => {
    expect(enumerateDates('2026-09-10', '2026-09-13', false)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
    // 12-sentabr shanba, 13-sentabr yakshanba (2026)
    expect(enumerateDates('2026-09-10', '2026-09-13', true)).toEqual(['2026-09-10', '2026-09-11']);
    expect(enumerateDates('2026-09-10', '2026-09-09', false)).toEqual([]);
  });

  it('oyna vaqti UTC ga to\'g\'ri o\'giriladi (UTC+5, yozgi vaqt yo\'q)', () => {
    expect(uzLocalToUtc('2026-09-10', '08:00').toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(uzLocalToUtc('2026-01-15', '18:00').toISOString()).toBe('2026-01-15T13:00:00.000Z');
    // Yarim tundan keyingi UTC vaqti - ertangi Toshkent kuni
    expect(uzLocalDate(new Date('2026-09-10T19:30:00Z'))).toBe('2026-09-11');
    expect(uzLocalDate(new Date('2026-09-10T18:59:00Z'))).toBe('2026-09-10');
  });

  // Sana odamga ko'rinadigan joyda (Telegram kanali posti) oy nomi bilan yoziladi
  it("sana odam o'qiydigan matnga o'giriladi", () => {
    expect(uzDateText('2026-10-04')).toBe('4-oktabr');
    expect(uzDateText('2026-01-31')).toBe('31-yanvar');
    expect(uzDateText('2026-12-09')).toBe('9-dekabr');
    // Noto'g'ri qiymat yutilmaydi: kiritilgani qaytadi, karta bo'sh qolmaydi
    expect(uzDateText('bekor')).toBe('bekor');
  });

  it('standart oynalar: 6 × 2 soat, raqamlar ketma-ket', () => {
    const w = defaultWindows();
    expect(w).toHaveLength(6);
    expect(w.map((x) => x.window)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(w[0]).toMatchObject({ start: '08:00', end: '10:00' });
    expect(w[5]).toMatchObject({ start: '18:00', end: '20:00' });
    expect(w.every((x) => x.end > x.start)).toBe(true);
  });

  it('buyurtma raqami YS-0000 formatida', () => {
    expect(formatOrderNo(1041)).toBe('YS-1041');
    expect(formatOrderNo(7)).toBe('YS-0007');
  });
});
