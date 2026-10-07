// E'lon sahifasidagi formadan kelgan keyingi savol ham suhbatni qayta ochadi. Soxta prisma, baza yo'q.
//
// Egasi qarori (2026-10-07). Telegram ilovasi e'longa hamma xabarni shu yo'ldan yuboradi
// (POST /listings/:id/inquiries), suhbat oynasi esa ChatService.send dan: ikkalasi bitta qoidaga
// (chat/inquiry-status.ts) tayanadi.
import { describe, expect, it } from 'vitest';
import { ListingsUseCase } from './application/listings.usecase';

function setup(existing: boolean) {
  const writes: { where: unknown; data: { status: string } }[] = [];
  const created = new Date('2026-10-07T10:00:00Z');
  const prisma = {
    inquiry: {
      findFirst: async () => (existing ? { id: 'i1' } : null),
      updateMany: async (a: { where: unknown; data: { status: string } }) => { writes.push(a); return { count: 1 }; },
    },
    inquiryMessage: { create: async () => ({ id: 'm1', createdAt: created }) },
    // Xabarnoma javobni kutmaydi va xatosi yutiladi: bu yerda baza yo'qligi ahamiyatsiz
    user: { findUnique: async () => null },
  };
  const repo = {
    findById: async () => ({ id: 'l1', status: 'ACTIVE', isDemo: false, orgId: 'o1', ownerUserId: null, title: "Vagon ijarasi" }),
    createInquiry: async () => ({ id: 'i2' }),
  };
  const uc = new ListingsUseCase(repo as never, {} as never, prisma as never, {} as never, {} as never, {} as never);
  return { uc, writes, created };
}

describe("e'lon formasidan keyingi savol", () => {
  it('javob olgan suhbatga yozilsa OPEN ga qaytadi, eng yangi xabar sharti bilan', async () => {
    const { uc, writes, created } = setup(true);
    await uc.inquire('mijoz', 'l1', 'Narx hali amaldami?', null);
    expect(writes).toEqual([{ where: { id: 'i1', OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: created } }] }, data: { lastMessageAt: created, status: 'OPEN' } }]);
  });

  it('birinchi murojaat ham OPEN bilan yoziladi', async () => {
    const { uc, writes } = setup(false);
    await uc.inquire('mijoz', 'l1', 'Salom', null);
    expect(writes.map((w) => w.data.status)).toEqual(['OPEN']);
  });
});
