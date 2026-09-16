import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TokenService } from './token.service';
import type { SessionStore } from '../domain/ports';
import { hashSecret } from '../domain/otp';
import { env } from '../../../common/env';

/**
 * Yangilash poygasi. Sahifa bir nechta so'rovni barobar yuboradi va kirish tokeni
 * eskirgan bo'lsa hammasi bir vaqtda yangilashni so'raydi. Server buni o'g'irlangan
 * token deb bilib foydalanuvchining hamma sessiyasini yopib qo'yardi: panelning bir
 * qismi yuklanar, qolgani "yuklanmadi" deb qolar, odam esa tizimdan chiqib ketardi.
 *
 * Shu bilan birga haqiqiy takror ishlatish hamon xavf deb qolishi kerak.
 */

type Row = { id: string; userId: string; expiresAt: Date; revokedAt: Date | null; replacedById: string | null };

/** Eslab qoladigan soxta ombor: rotate haqiqiy kabi eskisini bekor qilib, yangisini yaratadi. */
function store(rows: Row[]) {
  const byHash = new Map<string, string>(); // hash -> session id
  const revokedAll: string[] = [];
  let n = rows.length;
  const api: SessionStore & { rows: Row[]; revokedAll: string[]; byHash: Map<string, string> } = {
    rows, revokedAll, byHash,
    create: async () => ({ id: 'yangi' }),
    findByRefreshHash: async (h) => rows.find((r) => r.id === byHash.get(h)) ?? null,
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    findLive: async (id) => rows.find((r) => r.id === id) ?? null,
    rotate: async (oldId, next) => {
      const old = rows.find((r) => r.id === oldId)!;
      const created: Row = { id: `s${++n}`, userId: old.userId, expiresAt: next.expiresAt, revokedAt: null, replacedById: null };
      rows.push(created);
      byHash.set(next.refreshHash, created.id);
      old.revokedAt = new Date();
      old.replacedById = created.id;
      return { id: created.id };
    },
    revoke: async () => {},
    revokeAllForUser: async (userId) => {
      revokedAll.push(userId);
      for (const r of rows) if (!r.revokedAt) r.revokedAt = new Date();
    },
  };
  return api;
}

const svc = (s: SessionStore) => new TokenService(new JwtService({ secret: 'test-secret-at-least-32-characters-long' }), s);

describe('yangilash poygasi', () => {
  it("bir vaqtda ketgan ikki yangilash ikkalasi ham ishlaydi va sessiyalar yopilmaydi", async () => {
    const st = store([{ id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 86400000), revokedAt: null, replacedById: null }]);
    const t = svc(st);
    const token = 'xom-token';
    // Ombor hash bo'yicha qidiradi: xizmat hash ni o'zi hisoblaydi, shuning uchun
    // birinchi chaqiruvda topilishi uchun qo'lda bog'lab qo'yamiz.
    st.byHash.set(hashSecret(token, env.JWT_SECRET), 's1');

    const first = await t.refresh(token);
    expect(first.accessToken).toBeTruthy();

    // Ikkinchi so'rov XUDDI SHU eski tokenni yuboradi: bu poyga, o'g'rilik emas
    const second = await t.refresh(token);
    expect(second.accessToken).toBeTruthy();
    expect(second.userId).toBe('u1');
    expect(st.revokedAll).toEqual([]); // hamma sessiya yopilmadi
  });

  it('haqiqiy takror ishlatish hamon hamma sessiyani yopadi', async () => {
    const old = new Date(Date.now() - 10 * 60_000); // oyna ancha oldin yopilgan
    const st = store([
      { id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 86400000), revokedAt: old, replacedById: 's2' },
      { id: 's2', userId: 'u1', expiresAt: new Date(Date.now() + 86400000), revokedAt: null, replacedById: null },
    ]);
    const t = svc(st);
    const token = 'o-g-irlangan';
    st.byHash.set(hashSecret(token, env.JWT_SECRET), 's1');

    await expect(t.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(st.revokedAll).toEqual(['u1']);
  });
});
