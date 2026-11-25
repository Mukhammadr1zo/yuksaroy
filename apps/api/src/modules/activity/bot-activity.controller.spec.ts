// Bot -> API: botdagi amal bog'langan foydalanuvchiga yoki chat mehmoniga yoziladi.
import { describe, expect, it, vi } from 'vitest';
import { BotActivityController } from './bot-activity.controller';

const make = (link: { userId: string } | null) => {
  const activity = { record: vi.fn() };
  const prisma: any = { telegramLink: { findUnique: vi.fn(async () => link) } };
  return { c: new BotActivityController(prisma, activity as any), activity, prisma };
};

describe('BotActivityController', () => {
  it("bog'langan foydalanuvchi: actorId, kanal bot, mehmon yo'q", async () => {
    const { c, activity, prisma } = make({ userId: 'u1' });
    await expect(c.bot({ chatId: '555', action: 'bot.help' })).resolves.toEqual({ ok: true });
    expect(prisma.telegramLink.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { chatId: 555n } }));
    expect(activity.record).toHaveBeenCalledWith({ action: 'bot.help', actorId: 'u1', meta: { text: undefined, start: undefined }, channel: 'bot', guest: undefined });
  });
  it("bog'lanmagan: chat kaliti va @username belgisi", async () => {
    const { c, activity } = make(null);
    await c.bot({ chatId: '777', action: 'bot.start', username: 'trans_uz', start: 'login' });
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: null, guest: { key: 't:777', label: '@trans_uz' }, meta: { text: undefined, start: 'login' } }));
  });
  it("username yo'q: ism belgi bo'ladi; baza xatosi 200 ni buzmaydi", async () => {
    const { c, activity, prisma } = make(null);
    prisma.telegramLink.findUnique.mockRejectedValueOnce(new Error('db'));
    await expect(c.bot({ chatId: '8', action: 'bot.search', firstName: 'Aziz', text: 'vagon' })).resolves.toEqual({ ok: true });
    expect(activity.record.mock.calls[0][0].guest.label).toBe('Aziz');
  });
});
