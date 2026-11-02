// Telefon mosligi bo'yicha o'zi tasdiqlash (2026-10-07 egasi qarori). Telegram chaqirilmaydi:
// notifications.recipients bo'sh qaytadi, notifyBoth esa oluvchi bo'lmasa darhol chiqadi.
import { describe, expect, it } from 'vitest';
import { AUTO_CLAIM_ACTION, autoApproveClaim, autoApprovedIds } from './auto-approve-claim';

const T = { id: 't1', name: 'SOLANUZ', phone: null, claimOrgId: 'org1', rail: { contactPhone: '71 299-12-34, +998 90 111 22 33' } };

function make(phone: string | null, decide: 'ok' | 'null' = 'ok', before = 0) {
  const audits: { action: string }[] = [];
  const decided: unknown[][] = [];
  const asked: unknown[] = [];
  const d = {
    repo: { decideTerminalClaim: async (...a: unknown[]) => { decided.push(a); return decide === 'ok' ? { ...T, claimStatus: 'APPROVED' } : null; } },
    prisma: { user: { findUnique: async () => ({ phone }) }, auditLog: { count: async () => before } },
    audit: { log: async (a: { action: string }) => { audits.push(a); } },
    notifications: { recipients: async (t: unknown) => { asked.push(t); return []; }, push: async () => 0 },
    adminUserIds: async () => ['admin1', 'admin2'],
  };
  return { d: d as never, audits, decided, asked };
}

describe('autoApproveClaim', () => {
  it('raqam mos: darhol tasdiqlanadi, audit yoziladi, adminlarga va egasiga bir martadan xabar', async () => {
    const m = make('+998901112233');
    const now = new Date('2026-10-07T00:00:00Z');
    expect(await autoApproveClaim(m.d, 'u1', T as never, now)).toMatchObject({ claimStatus: 'APPROVED' });
    expect(m.decided).toEqual([['t1', true, now]]);
    expect(m.audits.map((a) => a.action)).toEqual([AUTO_CLAIM_ACTION]);
    await new Promise((r) => setTimeout(r, 0));
    expect(m.asked).toHaveLength(2); // adminlar bir marta, egasi bir marta
    expect(m.asked[0]).toMatchObject({ userIds: ['admin1', 'admin2'], exceptUserId: 'u1' });
  });

  it("oldin avto-tasdiq yoki admin qarori bo'lgan obyekt: raqam mos bo'lsa ham navbatda qoladi", async () => {
    const m = make('+998901112233', 'ok', 1);
    expect(await autoApproveClaim(m.d, 'u1', T as never)).toBeNull();
    expect(m.decided).toHaveLength(0);
    expect(m.audits).toHaveLength(0);
  });

  it("raqam mos emas yoki yo'q: tasdiqlanmaydi, audit va xabar yo'q", async () => {
    for (const phone of ['+998909999999', null]) {
      const m = make(phone);
      expect(await autoApproveClaim(m.d, 'u1', T as never)).toBeNull();
      expect(m.decided).toHaveLength(0);
      expect(m.audits).toHaveLength(0);
      expect(m.asked).toHaveLength(0);
    }
  });

  it("obyektda raqam yo'q: solishtirib bo'lmaydi, da'vo navbatda qoladi", async () => {
    const m = make('+998901112233');
    expect(await autoApproveClaim(m.d, 'u1', { ...T, rail: null } as never)).toBeNull();
    expect(m.decided).toHaveLength(0);
  });

  it("boshqa admin oldin hal qilgan bo'lsa audit yozilmaydi", async () => {
    const m = make('+998901112233', 'null');
    expect(await autoApproveClaim(m.d, 'u1', T as never)).toBeNull();
    expect(m.audits).toHaveLength(0);
  });
});

describe('autoApprovedIds', () => {
  it("oxirgi hal qilinish avtomatik bo'lsa belgi bor, keyin admin qarori kelsa yo'q", async () => {
    const prisma = { auditLog: { findMany: async () => [
      { entityId: 'a', action: AUTO_CLAIM_ACTION },
      { entityId: 'b', action: 'terminal.claim.decide' }, { entityId: 'b', action: AUTO_CLAIM_ACTION },
    ] } } as never;
    expect([...(await autoApprovedIds(prisma, ['a', 'b']))]).toEqual(['a']);
    expect((await autoApprovedIds(prisma, [])).size).toBe(0);
  });
});
