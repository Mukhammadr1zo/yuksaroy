// Xabar ko'rinishi: 3.2-bo'limdagi namunalar, sir chiqmasligi, uzunlik chegarasi, tegsiz kesish.
import { describe, expect, it } from 'vitest';
import { s } from './text';
import { CATALOG } from './catalog';
import type { ActivityEvent } from './activity.types';
import { describeGeo, maskPhone, renderLine, renderSummary, renderWindow, type RenderInput } from './format';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const T0 = Date.parse('2026-11-25T14:02:11Z'); // Toshkentda 19:02:11
const ev = (o: Partial<ActivityEvent> & { action: string }): ActivityEvent => ({ at: T0, category: CATALOG[o.action]?.cat ?? 'action', channel: 'web', ip: '84.54.12.3', ua: ANDROID, ...o });
const actor = { id: 'u1', fullName: 'Alisher Karimov', phone: '+998901234567', createdAt: new Date('2026-10-03T08:00:00Z'), orgs: ["Temir Yo'l Servis"] };
const win = (events: ActivityEvent[], extra: Partial<RenderInput> = {}): string => renderWindow({ events, total: events.length, actor, actorId: 'u1', ...extra });

describe('namunalar (3.2)', () => {
  it('kirish: sarlavha, shaxs, kanal, joy, satr, havolalar; vaqt Toshkentda', () => {
    const t = win([ev({ action: 'auth.login', actorId: 'u1', meta: { via: 'otp' } })], { geo: { country: 'UZ', region: 'UZ-SA', city: 'Samarkand' } });
    const lines = t.split('\n');
    expect(lines[0]).toBe('👤 <b>Alisher Karimov</b>');
    expect(lines[1]).toBe("+998901234567 · Temir Yo'l Servis · ro'yxatdan o'tgan 03.10.2026");
    expect(lines[2]).toBe('🌐 Sayt · Android 14, Chrome 131, telefon');
    expect(lines[3]).toBe("📍 Samarkand, Samarqand viloyati, O'zbekiston · IP 84.54.12.3");
    expect(t).toContain('19:02:11 🔐 Kirdi: Telegram kodi bilan');
    expect(t).toMatch(/<a href="[^"]*\/admin\/users\/u1">Profil<\/a> · <a href="[^"]*\/admin\/audit\?actor=u1">Barcha amallari<\/a>$/);
  });

  it("ro'yxatdan o'tish (Mini App): telefon yo'q, @username, kanal miniapp", () => {
    const t = renderWindow({
      events: [ev({ action: 'auth.telegram_webapp', category: 'register', channel: 'miniapp', actorId: 'u2', meta: { isNew: true } })],
      total: 1, actorId: 'u2', actor: { id: 'u2', createdAt: new Date('2026-11-25T08:00:00Z'), username: 'aziz_cargo' },
    });
    expect(t).toContain('<b>Ismsiz foydalanuvchi</b>');
    expect(t).toContain("telefon yo'q · ro'yxatdan o'tgan 25.11.2026 · @aziz_cargo");
    expect(t).toContain('📱 Telegram Mini App · Android 14');
    expect(t).toContain("🆕 Ro'yxatdan o'tdi (Telegram Mini App): telefon hali bog'lanmagan");
  });

  it("mehmon, kira olmadi: ZZ da 'joylashuv aniqlanmadi', profil havolasi yo'q", () => {
    const t = renderWindow({
      events: [ev({ action: 'auth.failed', actorId: null, meta: { via: 'password', reason: 'BAD_CREDENTIALS' } })],
      total: 1, guestLabel: '+99890•••4567', geo: { country: 'ZZ', region: '' },
    });
    expect(t.split('\n')[0]).toBe('👀 <b>Mehmon (+99890•••4567)</b>');
    expect(t).toContain('📍 joylashuv aniqlanmadi · IP 84.54.12.3');
    expect(t).toContain("⚠️ Kira olmadi: parol bilan, parol noto'g'ri yoki raqam topilmadi");
    expect(t).not.toContain('Profil');
    expect(t).not.toContain('ZZ');
  });

  it("birlashgan oyna: '4 ta amal', tashrif va nom havolasi", () => {
    const names: Record<string, string> = { 'Listing:l1': 'Kran 25 t' };
    const t = win(
      [
        ev({ action: 'auth.login', actorId: 'u1', meta: { via: 'otp' } }),
        ev({ action: 'visit', category: 'visit', actorId: 'u1', at: T0 + 8000, meta: { path: '/wagon' } }),
        ev({ action: 'wagon.search', actorId: 'u1', at: T0 + 19000, entityId: '52345678', meta: { found: true } }),
        ev({ action: 'contact.reveal', actorId: 'u1', at: T0 + 54000, entity: 'listing', entityId: 'l1' }),
      ],
      { name: (type, id) => names[`${type}:${String(id)}`] },
    );
    expect(t.split('\n')[0]).toBe('👤 <b>Alisher Karimov</b> · 4 ta amal');
    expect(t).toContain('19:02:19 👁 Sahifani ochdi: /wagon');
    expect(t).toContain('🔎 Vagon qidirdi: №52345678, topildi');
    expect(t).toMatch(/📞 Raqamni ochdi: e'lon "Kran 25 t" · <a href="[^"]*\/admin\/listings\/l1">ochish<\/a>/);
  });

  it("mehmon tashrifi: 'Tashriflar' havolasi, qayerdan", () => {
    const t = renderWindow({
      events: [ev({ action: 'visit', category: 'visit', actorId: null, meta: { path: '/terminals/chuqursoy', referrer: 'google.com' } })],
      total: 1, geo: { country: 'UZ', region: 'UZ-TK', city: 'Tashkent' },
    });
    expect(t).toContain('👁 Sahifani ochdi: /terminals/chuqursoy, qayerdan: google.com');
    expect(t).toMatch(/Tashriflar<\/a>$/);
  });

  it("admin amali: 🛡 belgi, to'lov summasi, payRef yo'q", () => {
    const t = win(
      [ev({ action: 'subscription.confirm', actorId: 'u1', entityId: 's1', meta: { userId: 'c1', months: 3, expectedTiyin: 45000000, receivedTiyin: 45000000, payRef: 'KARTA-SIR-9999' } })],
      { staff: true, name: (type, id) => (type === 'User' && id === 'c1' ? 'Dilshod Aliev' : undefined) },
    );
    expect(t.startsWith('🛡 <b>Alisher Karimov</b>')).toBe(true);
    expect(t).toContain('💰 Obuna to\'lovini tasdiqladi: "Dilshod Aliev", 3 oy, kutilgan 450 000 so\'m, olingan 450 000 so\'m');
    expect(t).not.toContain('KARTA-SIR');
  });

  it("bot mehmoni: IP va qurilma yo'q", () => {
    const t = renderWindow({ events: [ev({ action: 'bot.start', channel: 'bot', actorId: null, ip: undefined, ua: undefined, meta: { start: 'login' } })], total: 1, guestLabel: '@trans_uz' });
    expect(t).toBe("🤖 <b>Mehmon (@trans_uz)</b>\n🤖 Telegram bot\n\n19:02:11 🤖 Botni ishga tushirdi: saytdan kirish uchun keldi");
  });

  it("tizim oynasi: kanal qatorlari yo'q", () => {
    const t = renderWindow({ events: [ev({ action: 'terminal.claim.auto', actorId: null, entityId: 't1' })], total: 1, system: true, name: () => 'Chuqursoy terminali' });
    expect(t.startsWith('⚙️ <b>Tizim</b>\n\n')).toBe(true);
    expect(t).toContain('✅ Da\'vo o\'zi tasdiqlandi (raqam reestrga mos): "Chuqursoy terminali"');
  });

  it("bot hodisasi birinchi, keyin sayt: qurilma va joylashuv qatorlari bor", () => {
    const t = renderWindow({
      events: [ev({ action: 'auth.telegram.link', channel: 'bot', actorId: 'u1', ip: undefined, ua: undefined, meta: { isNew: true } }), ev({ action: 'auth.login', actorId: 'u1', meta: { via: 'otp' } })],
      total: 2, actorId: 'u1', actor: { id: 'u1', fullName: 'Ali', phone: '+998901234567' }, geo: { country: 'UZ', region: 'TK', regionName: 'Tashkent', city: 'Toshkent' } as any,
    });
    expect(t).toContain('🌐 Sayt');
    expect(t).toContain('📍');
    expect(t).toContain('IP 84.54.12.3');
  });

  it("emoji kesim chegarasida: yolg'iz surrogat qolmaydi", () => {
    const title = 'a'.repeat(58) + '🚚🚚';
    const t = renderWindow({ events: [ev({ action: 'help.ask', actorId: 'u1', meta: { q: title } })], total: 1, actorId: 'u1', actor: { id: 'u1', fullName: 'b'.repeat(79) + '🚚' } });
    expect(t).not.toMatch(/[�-�](?![�-�])/);
    expect(s(title)).not.toMatch(/[�-�](?![�-�])/);
  });

  it('xulosa xabari', () => {
    const t = renderSummary({ login: 5, action: 30, visit: 2 });
    expect(t).toContain('yana 37 ta hodisa');
    expect(t).toContain('kirish 5, amal 30, tashrif 2');
  });
});

describe("sir chiqmaydi (oq ro'yxat)", () => {
  const secrets = ['Secr3t!', 'KARTA-SIR', 'MIJOZ-XABARI', 'IZOH-MATNI', 'refreshhash', '1234-5678-9012'];
  const cases: ActivityEvent[] = [
    ev({ action: 'auth.password.set', actorId: 'u1', meta: { password: 'Secr3t!', token: 'refreshhash' } }),
    ev({ action: 'auth.password.reset', actorId: 'u1', meta: { code: 'refreshhash' } }),
    ev({ action: 'admin.note.delete', actorId: 'u1', entity: 'User', meta: { text: 'IZOH-MATNI' } }),
    ev({ action: 'admin.note.create', actorId: 'u1', entity: 'Order', meta: { text: 'IZOH-MATNI' } }),
    ev({ action: 'admin.contact.delete', actorId: 'u1', meta: { message: 'MIJOZ-XABARI', name: 'MIJOZ-XABARI' } }),
    ev({ action: 'contact.create', actorId: null, meta: { topic: 'narx', message: 'MIJOZ-XABARI' } }),
    ev({ action: 'chat.message', actorId: 'u1', meta: { len: 12, text: 'MIJOZ-XABARI' } }),
    ev({ action: 'subscription.confirm', actorId: 'u1', meta: { payRef: 'KARTA-SIR', months: 1 } }),
    ev({ action: 'auth.delete', actorId: 'u1', meta: { transferred: ['org-a', 'org-b'], orphaned: ['org-c'], report: 'MIJOZ-XABARI' } }),
    ev({ action: 'admin.settings.update', actorId: 'u1', meta: { changed: { payDetails: { from: '1234-5678-9012', to: 'KARTA-SIR' }, commissionPct: { from: 0, to: 300 } } } }),
    ev({ action: 'auth.failed', actorId: null, meta: { via: 'password', reason: 'BAD_CREDENTIALS', password: 'Secr3t!', code: '1234-5678-9012' } }),
    ev({ action: 'some.unknown.action', actorId: 'u1', meta: { password: 'Secr3t!', text: 'MIJOZ-XABARI' } }),
  ];
  it("hech bir matnda sir yo'q", () => {
    for (const e of cases) {
      const t = win([e]);
      for (const sec of secrets) expect(t, `${e.action} -> ${sec}`).not.toContain(sec);
    }
  });
  it('sozlama: son eski -> yangi, matn faqat kalit', () => {
    const t = renderLine(cases[9], 'web');
    expect(t).toContain('payDetails');
    expect(t).toContain('commissionPct: 0 -> 300');
  });
  it('auth.delete faqat ikki son', () => {
    expect(renderLine(cases[8], 'web')).toContain('1 ta tashkilot egasiz qoldi');
    expect(renderLine(cases[8], 'web')).toContain('2 ta tashkilot topshirildi');
  });
  it("noma'lum amal: faqat nomi", () => {
    expect(renderLine(cases[11], 'web')).toBe('19:02:11 • some.unknown.action');
  });
});

describe('chegaralar', () => {
  it("300 hodisa: <= 3500, oxirgi qator 'yana N ta amal', teglar yopiq", () => {
    const events = Array.from({ length: 300 }, (_, i) => ev({ action: 'contact.reveal', actorId: 'u1', at: T0 + i * 1000, entity: 'listing', entityId: `l${i}` }));
    const t = renderWindow({ events: events.slice(0, 200), total: 300, actor, actorId: 'u1', name: () => 'Juda uzun nom '.repeat(8) });
    expect(t.length).toBeLessThanOrEqual(3500);
    const parts = t.split('\n\n');
    expect(parts[1].split('\n').at(-1)).toMatch(/^… va yana \d+ ta amal/);
    expect((t.match(/<a /g) ?? []).length).toBe((t.match(/<\/a>/g) ?? []).length);
    expect((t.match(/<b>/g) ?? []).length).toBe((t.match(/<\/b>/g) ?? []).length);
    expect(parts[0].split('\n')[0]).toContain('300 ta amal');
  });
  it('foydalanuvchi matnidagi HTML belgilanadi', () => {
    const t = renderWindow({ events: [ev({ action: 'help.ask', actorId: null, meta: { q: '<script>x</script> & "y"' } })], total: 1 });
    expect(t).not.toContain('<script>');
    expect(t).toContain('&lt;script&gt;');
  });
  it("har bir katalog yozuvi bo'sh meta bilan yiqilmaydi", () => {
    for (const action of Object.keys(CATALOG)) {
      expect(() => renderLine(ev({ action, actorId: 'u1' }), 'web'), action).not.toThrow();
      expect(() => renderLine(ev({ action, actorId: 'u1', meta: { x: 1 }, entity: 'listing', entityId: 'a', count: 5 }), 'web', () => 'N'), action).not.toThrow();
    }
  });
  it("kanali sarlavhadan farq qilgan satrga so'z qo'shiladi", () => {
    expect(renderLine(ev({ action: 'bot.help', channel: 'bot' }), 'web')).toContain('(bot)');
    expect(renderLine(ev({ action: 'bot.help', channel: 'bot' }), 'bot')).not.toContain('(bot)');
  });
  it("count > 1: 'N ta'", () => {
    expect(renderLine(ev({ action: 'admin.terminal.bulkHide', count: 37 }), 'web')).toContain('37 ta');
  });
});

describe('yordamchilar', () => {
  it('maskPhone', () => expect(maskPhone('+998901234567')).toBe('+99890•••4567'));
  it("describeGeo: O'zbekiston va noma'lum", () => {
    expect(describeGeo({ country: 'UZ', region: 'UZ-TK', city: 'Tashkent' })).toBe("Tashkent, Toshkent shahri, O'zbekiston");
    expect(describeGeo({ country: 'DE', region: '', city: 'Berlin', regionName: 'Berlin' })).toMatch(/^Berlin, /);
    expect(describeGeo({ country: 'ZZ', region: '' })).toBe('joylashuv aniqlanmadi');
    expect(describeGeo(null)).toBe('joylashuv aniqlanmadi');
  });
});
