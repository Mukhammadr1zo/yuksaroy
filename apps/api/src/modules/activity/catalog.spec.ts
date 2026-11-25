// Katalog to'liqligi: koddagi har bir audit amali va qo'shimcha nomlar uchun yozuv bor.
// Yangi audit.log amali qo'shilsa va bu ro'yxatga/katalogga tushmasa, xabarda "• amal" bo'lib chiqadi.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';

// Bugungi koddagi `action: '...'` (audit.log) + dinamik nomlar (market.*, contact.deal, upload.create)
const IN_CODE = [
  'admin.ad.create', 'admin.ad.delete', 'admin.ad.media', 'admin.ad.update', 'admin.contact.delete', 'admin.contact.handled', 'admin.demo.remove', 'admin.demo.seed',
  'admin.export', 'admin.listingReview.delete', 'admin.market.hide', 'admin.note.create', 'admin.note.delete', 'admin.order.status', 'admin.org.delete',
  'admin.org.member.add', 'admin.org.member.remove', 'admin.org.member.update', 'admin.org.update', 'admin.plan.create', 'admin.plan.delete', 'admin.plan.update',
  'admin.report.decide', 'admin.review.delete', 'admin.service.profile.hide', 'admin.settings.update', 'admin.station.create', 'admin.station.delete',
  'admin.station.update', 'admin.subscription.remind', 'admin.task.assign', 'admin.task.done', 'admin.team.remove', 'admin.team.setLevel',
  'admin.terminal.bulkActivate', 'admin.terminal.bulkDelete', 'admin.terminal.bulkHide', 'admin.terminal.create', 'admin.terminal.delete', 'admin.terminal.update',
  'admin.urgent.close', 'admin.user.block', 'admin.user.delete', 'admin.user.unblock', 'auth.delete', 'auth.login', 'auth.password.reset', 'auth.password.set',
  'auth.phone.change', 'auth.telegram_webapp', 'contact.create', 'contact.deal', 'contact.reveal', 'inquiry.create', 'inquiry.noReply', 'invoice.paid', 'listing.archive',
  'listing.create', 'listing.decide', 'listing.delete', 'listing.publish', 'listing.update', 'market.award', 'market.cancelled', 'market.closed', 'market.done',
  'market.offer', 'market.relist', 'market.request.create', 'order.cancel', 'order.clientClose', 'order.complete', 'order.confirm', 'order.create', 'order.reject',
  'order.terminalCancel', 'org.create', 'org.kyc.decide', 'org.kyc.request', 'org.member.add', 'org.storefront.update', 'org.update', 'premium.cancel', 'premium.confirm',
  'report.create', 'review.create', 'review.reply', 'service.profile.create', 'service.profile.hide', 'service.profile.update', 'slots.capacity', 'subscription.cancel',
  'subscription.cancel.self', 'subscription.confirm', 'subscription.create', 'subscription.revoke', 'tariff.publish', 'terminal.claim', 'terminal.claim.auto',
  'terminal.claim.decide', 'terminal.create', 'terminal.firstPublish', 'terminal.services', 'terminal.update', 'upload.create', 'urgent.award', 'urgent.close',
  'urgent.create', 'urgent.offer', 'wagon.search',
];
// Boshqa yo'llar yozadigan nomlar: faqat-yozuv, yangi audit, tashrif, bot
const EXTRA = [
  'auth.failed', 'auth.otp.request', 'auth.password.reset.request', 'auth.logout', 'auth.telegram.link', 'auth.profile.update', 'chat.message',
  'listing.review.create', 'listing.review.reply', 'order.event', 'slots.close', 'watch.create', 'watch.delete', 'contact.paywall', 'help.ask',
  'visit', 'bot.start', 'bot.help', 'bot.app', 'bot.search',
];
// Katalogda yo'q ataylab: to'g'ridan-to'g'ri prisma yozuvi (audit hooki ko'rmaydi)
const NOT_HOOKED = ['request.fanout', 'admin.digest'];

describe('katalog', () => {
  it("koddagi har bir amal katalogda bor", () => {
    const missing = [...IN_CODE, ...EXTRA].filter((a) => !CATALOG[a]);
    expect(missing).toEqual([]);
  });
  it("to'g'ridan-to'g'ri yozilganlar katalogga kirmaydi", () => {
    for (const a of NOT_HOOKED) expect(CATALOG[a]).toBeUndefined();
  });
  it('toifalar: kirish, mehmon xatosi, admin, tashrif, tizim, amal', () => {
    expect(CATALOG['auth.login'].cat).toBe('login');
    expect(CATALOG['auth.failed'].cat).toBe('loginFailed');
    expect(CATALOG['visit'].cat).toBe('visit');
    expect(CATALOG['terminal.claim.auto'].cat).toBe('action');
    expect(CATALOG['subscription.confirm'].cat).toBe('admin');
    expect(CATALOG['listing.decide'].cat).toBe('admin');
    expect(CATALOG['listing.create'].cat).toBe('action');
    expect(CATALOG['wagon.search'].cat).toBe('action');
    expect(CATALOG['bot.start'].channel).toBe('bot');
    expect(CATALOG['auth.telegram_webapp'].channel).toBe('miniapp');
    for (const [k, c] of Object.entries(CATALOG)) if (k.startsWith('admin.')) expect(c.cat, k).toBe('admin');
  });
});
