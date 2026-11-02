// Ismsiz odam yozsa bildirishnomada telefon emas "Mijoz" turadi (2026-11-02), uch tilda.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import { ListingsUseCase } from '../listings/application/listings.usecase';
import { ChatService } from './chat.service';

const PHONE = '+998901112233';
let chat = 780000;

/** Soxta baza: yozuvchining ismi bo'sh, telefoni bor (telefon so'ralmaydi ham: select faqat fullName). */
function fakes(locale: string, fullName: string | null) {
  const asked: unknown[] = [];
  const prisma = {
    user: { findUnique: async (a: { select: Record<string, boolean> }) => { asked.push(a.select); return { fullName, phone: PHONE }; } },
    telegramLink: { findMany: async () => [{ chatId: BigInt(++chat), user: { locale } }] },
  } as unknown as PrismaService;
  const notifications = { recipients: async () => ['u2'], push: async () => {} };
  const sent: { text: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200 }; }));
  return { prisma, notifications, sent, asked };
}

describe('ismsiz yozuvchi "Mijoz"', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([['uz', 'Mijoz'], ['ru', 'Клиент'], ['en', 'Client']])('terminalga yozishma (%s)', async (locale, word) => {
    const f = fakes(locale, null);
    const svc = new ChatService(f.prisma, f.notifications as never, {} as never);
    await (svc as unknown as { notifyNew: (...a: unknown[]) => Promise<void> }).notifyNew('u1', 'i1', { name: 'Terminal', orgId: 'o1' }, 'salom');
    expect(f.sent[0]!.text).toContain(word);
    expect(f.sent[0]!.text).not.toContain(PHONE);
    expect(f.asked).toEqual([{ fullName: true }]);
  });

  it("ismi bor odam o'z ismi bilan chiqadi", async () => {
    const f = fakes('uz', 'Ali Valiyev');
    const svc = new ChatService(f.prisma, f.notifications as never, {} as never);
    await (svc as unknown as { notifyNew: (...a: unknown[]) => Promise<void> }).notifyNew('u1', 'i1', { name: 'Terminal', orgId: 'o1' }, 'salom');
    expect(f.sent[0]!.text).toContain('Ali Valiyev');
  });

  it("e'lon egasiga ham shunday", async () => {
    const f = fakes('ru', null);
    const uc = Object.create(ListingsUseCase.prototype) as Record<string, unknown>;
    uc.prisma = f.prisma; uc.notifications = f.notifications;
    await (uc as unknown as { notifyOwner: (...a: unknown[]) => Promise<void> }).notifyOwner({ orgId: 'o1', ownerUserId: null, title: 'Kran' }, 'u1', null, 'narxi?', 'i1');
    expect(f.sent[0]!.text).toContain('Клиент');
    expect(f.sent[0]!.text).not.toContain(PHONE);
  });
});
