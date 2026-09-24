import { describe, expect, it } from 'vitest';
import { NOTIFY_KINDS, notifyBoth, notifyParts, notifyText } from './telegram';
import type { PrismaService } from './prisma.service';
import type { NotificationsService } from '../modules/notifications/notifications.service';

/** Shablonlarning shakli notifyParts uchun shart: birinchi qator sarlavha, oxirgisi havola. */
describe('shablon shakli', () => {
  it('har bir turda birinchi qator qalin sarlavha, oxirgi qatorda havola', () => {
    const vars = { no: 'YS-1', title: 't', terminal: 't', shipper: 's', minutes: 30, reason: 'r', object: 'o', from: 'f', message: 'm', where: 'w', what: 'x', queue: 'q', list: 'l', rating: '5/5', text: 'x', url: 'https://x/y' };
    for (const kind of NOTIFY_KINDS) {
      for (const l of ['uz', 'ru', 'en']) {
        const lines = notifyText(kind, l, vars).split('\n');
        expect(lines[0], `${kind}/${l} sarlavhasi`).toContain('<b>');
        expect(lines[lines.length - 1], `${kind}/${l} havolasi`).toContain('https://x/y');
      }
    }
  });
});

describe('notifyParts', () => {
  const vars = { no: 'YS-1', terminal: 'Sergeli', shipper: 'Alfa', minutes: 30, url: 'https://x/y' };

  it('sarlavhada teg qolmaydi, tanada havola yo\'q, qatorlar nuqta bilan qo\'shiladi', () => {
    const p = notifyParts('orderNew', 'ru', vars);
    expect(p.title).not.toContain('<b>');
    expect(p.title).toContain('YS-1');
    expect(p.body).not.toContain('https://');
    expect(p.body).toBe('Sergeli · Клиент: Alfa · Срок подтверждения: 30 мин');
  });

  it('noma\'lum til uz ga tushadi', () => {
    expect(notifyParts('orderNew', 'de', vars)).toEqual(notifyParts('orderNew', 'uz', vars));
  });

  it('qo\'ng\'iroq matni tozalanmaydi, Telegram matni tozalanadi', () => {
    const v = { title: 'a & b', from: '', message: 'm', url: 'https://x' };
    expect(notifyParts('inquiry', 'uz', v).body).toContain('a & b');
    expect(notifyText('inquiry', 'uz', v)).toContain('a &amp; b');
  });

  it('oraliq qator bo\'lmasa tana bo\'sh', () => {
    expect(notifyParts('claimApproved', 'uz', { object: '', url: 'https://x' }).body).toBe(null);
  });
});

/** Soxta bog'lanishlar: baza ham, Telegram ham chaqirilmaydi (telegramLink bo'sh). */
function fakes(locales: Record<string, string>) {
  const pushed: { ids: readonly string[]; title: string; body: string | null }[] = [];
  const prisma = {
    user: { findMany: async (a: { where: { id: { in: string[] } } }) => a.where.id.in.map((id) => ({ id, locale: locales[id] ?? 'uz' })) },
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  const notifications = {
    recipients: async (w: { userIds?: (string | null | undefined)[] }) => (w.userIds ?? []).filter((x): x is string => !!x),
    push: async (ids: readonly string[], n: { title: string; body?: string | null }) => { pushed.push({ ids, title: n.title, body: n.body ?? null }); },
  } as unknown as NotificationsService;
  return { prisma, notifications, pushed };
}

describe('notifyBoth', () => {
  const base = { kind: 'marketAward' as const, inApp: 'market' as const, href: '/cargo/YS-1', vars: { no: 'YS-1', title: 'Sement' } };

  it('har til uchun alohida yozuv', async () => {
    const f = fakes({ a: 'uz', b: 'ru', c: 'uz' });
    await notifyBoth(f.prisma, f.notifications, { ...base, target: { userIds: ['a', 'b', 'c'] } });
    expect(f.pushed.length).toBe(2);
    expect(f.pushed.find((p) => p.ids.length === 2)?.ids).toEqual(['a', 'c']);
    expect(f.pushed.some((p) => p.title.includes('Ваше предложение'))).toBe(true);
  });

  it('card berilsa bitta yozuv va matn aynan shundan', async () => {
    const f = fakes({ a: 'ru' });
    await notifyBoth(f.prisma, f.notifications, { ...base, target: { userIds: ['a'] }, card: { title: 'YS-1 Sement', body: 'Toshkent' } });
    expect(f.pushed).toEqual([{ ids: ['a'], title: 'YS-1 Sement', body: 'Toshkent' }]);
  });

  it('amalni boshlagan odam ro\'yxatdan chiqadi va takrorlanish yo\'q', async () => {
    const f = fakes({ a: 'uz', b: 'uz' });
    await notifyBoth(f.prisma, f.notifications, { ...base, target: { userIds: ['a', 'b', 'a'], exceptUserId: 'b' } });
    expect(f.pushed.length).toBe(1);
    expect(f.pushed[0].ids).toEqual(['a']);
  });

  it('oluvchi bo\'lmasa hech narsa yozilmaydi', async () => {
    const f = fakes({});
    await notifyBoth(f.prisma, f.notifications, { ...base, target: { userIds: [null, undefined] } });
    expect(f.pushed.length).toBe(0);
  });

  it('yozuv xatosi xabarni to\'xtatmaydi', async () => {
    const f = fakes({ a: 'uz' });
    const broken = { ...f.notifications, push: async () => { throw new Error('baza'); } } as unknown as NotificationsService;
    await expect(notifyBoth(f.prisma, broken, { ...base, target: { userIds: ['a'] } })).resolves.toBeUndefined();
  });
});
