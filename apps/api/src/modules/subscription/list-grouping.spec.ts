import { describe, expect, it } from 'vitest';
import { SubscriptionService, groupByOrg } from './subscription.service';

/**
 * Jamoa bitta o'tkazma qiladi, operator uni navbatdagi bir necha qatorga taqsimlaydi.
 * Guruhlash kaliti tashkilot id si: nom unikal emas, bir xil nomli ikki boshqa
 * tashkilot qo'shilib ketsa operator pulni begona qatorga yozib qo'yardi.
 */
type Row = { no: string; orgId: string | null };
const rows = (...xs: [string, string | null][]): Row[] => xs.map(([no, orgId]) => ({ no, orgId }));

describe('bir tashkilotning buyurtmalari yonma-yon turadi', () => {
  it("sochilib yotgan qatorlar guruhga yig'iladi, guruh eng eskisining o'rnida qoladi", () => {
    const out = groupByOrg(rows(['a', 'org-1'], ['b', 'org-2'], ['c', 'org-1']));
    expect(out.map((r) => r.no)).toEqual(['a', 'c', 'b']);
  });

  it('guruh ichida eski birinchi tartibi saqlanadi', () => {
    const out = groupByOrg(rows(['a', 'org-1'], ['b', 'org-1'], ['c', 'org-1']));
    expect(out.map((r) => r.no)).toEqual(['a', 'b', 'c']);
  });

  it('tashkilotsiz qatorlar bir-biri bilan guruhlanmaydi va joyida qoladi', () => {
    const out = groupByOrg(rows(['a', null], ['b', 'org-1'], ['c', null], ['d', 'org-1']));
    expect(out.map((r) => r.no)).toEqual(['a', 'b', 'd', 'c']);
  });

  it("bo'sh ro'yxat bo'sh qaytadi", () => {
    expect(groupByOrg([])).toEqual([]);
  });
});

describe('admin navbati tashkilotni qaytaradi', () => {
  it("a'zolik id si va nomi qaytadi, user ichida memberships qolmaydi", async () => {
    const prisma = {
      subscription: {
        findMany: async () => [
          { id: 's1', no: 'PAY-1', userId: 'u1', months: 1, amountTiyin: 99000n, status: 'PENDING', provider: 'manual', startsAt: null, endsAt: null, paidAt: null, createdAt: new Date(1), user: { fullName: 'Ali', phone: '+998901112233', email: null, memberships: [{ orgId: 'org-1', org: { name: 'Asaka Yuk' } }] } },
          { id: 's2', no: 'PAY-2', userId: 'u2', months: 3, amountTiyin: 297000n, status: 'PENDING', provider: 'manual', startsAt: null, endsAt: null, paidAt: null, createdAt: new Date(2), user: { fullName: 'Vali', phone: null, email: 'v@x.uz', memberships: [] } },
        ],
      },
    } as never;
    const svc = new SubscriptionService(prisma, {} as never, {} as never, {} as never);
    const out = await svc.list('PENDING');
    expect(out[0]!.orgId).toBe('org-1');
    expect(out[0]!.orgName).toBe('Asaka Yuk');
    expect(out[1]!.orgName).toBeNull();
    expect('memberships' in out[0]!.user).toBe(false);
    expect(out[0]!.amountTiyin).toBe(99000); // BigInt -> Number saqlanadi
  });
});
