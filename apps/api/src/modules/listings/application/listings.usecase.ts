import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LISTING, REGION_CENTERS, SEARCH_LABELS, TransitionError, assertListingTransition, canExtendListing, slugify, storePhone, validateListing, type ListingActor, type ListingInput, type ListingStatus, type RegionCode } from '@yuksaroy/domain';
import { uniqueSlug, type ListingRecord } from '../domain/listing-query';
import { NotificationsService } from '../../notifications/notifications.service';
import { AdminNotify } from '../../organizations/application/admin-notify';
import { SubscriptionService } from '../../subscription/subscription.service';
import { PrismaService } from '../../../common/prisma.service';
import { notifyBoth } from '../../../common/telegram';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { ListingAccess } from './listing-access';
import { watchers } from '../../watch/watchers';
import { filesOrThrow } from '../../../common/attachments';
import { markInquiryMessage } from '../../chat/inquiry-status';

/** Saqlangan yozuvdan domen kiritmasi (PATCH da birlashtirish va qayta tekshirish uchun). */
export function inputOf(l: ListingRecord): ListingInput {
  return {
    kind: l.kind, ownerType: l.orgId ? 'org' : 'person', deal: l.deal, title: l.title, description: l.description, regionCode: l.regionCode as RegionCode,
    terminalId: l.terminalId, priceTiyin: l.priceTiyin, priceUnit: l.priceUnit, photos: l.photos,
    year: l.year, condition: l.condition, model: l.model, qty: l.qty, wagonType: l.wagonType, capacityT: l.capacityT,
    truckType: l.truckType, tonnage: l.tonnage, fleetSize: l.fleetSize, serviceRegions: l.serviceRegions as RegionCode[], routes: l.routes,
    contactPhone: l.contactPhone,
  };
}

const expiry = (now: Date) => new Date(now.getTime() + LISTING.expireDays * 86_400_000);

/**
 * Yakka odam tekshiruvsiz nechta e'lonni bir vaqtda faol ushlab turishi mumkin.
 * Haydovchida odatda bitta mashina bo'ladi; uchtadan ko'pi bu bitta odam emas, ya'ni
 * keyingisi odamning ko'zidan o'tsin.
 */
const PERSON_ACTIVE_MAX = 3;

@Injectable()
export class ListingsUseCase {
  constructor(
    private readonly repo: PrismaListingRepository,
    private readonly access: ListingAccess,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly subs: SubscriptionService,
    private readonly adminNotify: AdminNotify,
  ) {}

  /** orgId bo'lsa tashkilot nomidan (ruxsat tekshiriladi), bo'lmasa shaxsan (faqat TRUCK; validateListing ORG_REQUIRED). */
  async create(userId: string, orgId: string | null, input: ListingInput) {
    if (orgId) await this.access.assertLister(userId, orgId, input.kind);
    input = { ...input, ownerType: orgId ? 'org' : 'person' };
    const warnings = this.check(input);
    const point = await this.point(input);
    const slug = await uniqueSlug(slugify(input.title) || 'elon', (s) => this.repo.slugExists(s));
    return { listing: await this.repo.create({ ...input, contactPhone: storePhone(input.contactPhone), ...point, slug, orgId, ownerUserId: orgId ? null : userId, createdById: userId }), warnings };
  }

  /** Qisman yangilash: saqlangan + kelgan maydonlar birgalikda to'liq tekshiriladi. Holat o'zgarmaydi. */
  async update(userId: string, id: string, patch: Partial<ListingInput>) {
    const l = await this.owned(userId, id);
    const input: ListingInput = { ...inputOf(l), ...patch, ownerType: l.orgId ? 'org' : 'person' };
    if (input.kind !== l.kind && l.orgId) await this.access.assertLister(userId, l.orgId, input.kind);
    const warnings = this.check(input);
    const point = await this.point(input);
    // check() dan keyin: raqam yaroqli ekani u yerda tasdiqlangan, bu yerda faqat shakli
    return { listing: await this.repo.update(id, { ...input, contactPhone: storePhone(input.contactPhone), ...point }), warnings };
  }

  /**
   * Egasi yuboradi: tasdiqlangan tashkilot yoki telefoni tasdiqlangan yakka haydovchi
   * darhol ACTIVE (SYSTEM), qolganlari PENDING_REVIEW.
   *
   * Faol e'lon oxirgi 7 kunida shu yerda uzaytiriladi (canExtendListing, 2026-10-07 egasi
   * qarori): tekshiruvsiz, qayta yuborilgandek. Alohida endpoint qilinmadi: listing.publish
   * audit qatori uzaytirishni ham sanasin, eslatma (12-qadam) ko'rsatkichi shunga qaraydi.
   * Oynadan tashqarida faol e'lon avvalgidek o'tish xatosini oladi.
   */
  async publish(userId: string, id: string) {
    const l = await this.owned(userId, id);
    const now = new Date();
    if (canExtendListing(l.status, l.expiresAt, now)) return this.activate(l, userId, now);
    this.transition(l, 'PENDING_REVIEW', 'OWNER');
    if (!(await this.instant(l, userId, now))) {
      const out = await this.save(l, { status: 'PENDING_REVIEW', rejectReason: null });
      void this.adminNotify.queued('listingsPendingReview', l.title, l.id, userId).catch(() => {});
      return out;
    }
    return this.activate(l, userId, now);
  }

  /**
   * E'lon faol bo'ladigan YAGONA joy: egasi yuborganda ham, admin tasdiqlaganda ham,
   * faol e'lon uzaytirilganda ham shu yerdan o'tadi.
   *
   * Nega bitta joyga yig'ildi: holat yozuvi va obunaga ko'tarish ikki nusxa edi va
   * yangi hodisa (kuzatuv xabari) faqat bittasiga qo'shilib qolishi mumkin edi.
   */
  private async activate(l: ListingRecord, ownerUserId: string, now: Date) {
    // Arxivdan muddati ichida qaytgan e'lon o'z sanasi va joyi bilan qaytadi. Aks holda
    // arxivlab qayta yuborish istalgan kuni yangi 90 kun va katalog boshini berardi, ya'ni
    // uzaytirishning oxirgi 7 kun qoidasi (2026-10-07) chetlab o'tilardi
    const resume = l.status === 'ARCHIVED' && !!l.expiresAt && l.expiresAt > now;
    // Eslatma belgisi eski muddatniki: qolib ketsa yangi muddat tugashida egasi eslatma olmasdi.
    // publishedAt katalog tartibi: uzaytirilgan e'lon ham qayta yuborilgandek boshga chiqadi
    const out = await this.save(l, resume
      ? { status: 'ACTIVE', rejectReason: null }
      : { status: 'ACTIVE', publishedAt: now, expiresAt: expiry(now), expiryRemindedAt: null, rejectReason: null });
    // Obuna e'lonni ham ko'taradi: alohida Premium sotib olish yo'q
    await this.subs.raiseListing(ownerUserId, l.id);
    // Kuzatuvchilar xabarini kutmaymiz: e'lon chiqishi xabar yo'liga bog'liq emas.
    // Uzaytirilgan yoki arxivdan qaytgan e'lon kuzatuvchi uchun yangi emas: xabar esa
    // kuzatuvning kunlik yagona xabarini band qilib, chindan yangi e'lonni to'sib qo'yardi
    if (l.status !== 'ACTIVE' && !resume) void this.notifyWatchers(l, now).catch(() => {});
    return out;
  }

  /** Holat yozuvi. Qator o'qilgandan beri o'zgargan bo'lsa (repo sharti) 409: sahifani yangilash kerak. */
  private async save(l: ListingRecord, d: Parameters<PrismaListingRepository['setStatus']>[1]) {
    try { return await this.repo.setStatus(l, d); } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException({ code: 'TRANSITION_NOT_ALLOWED', from: l.status, to: d.status });
      throw e;
    }
  }

  /**
   * Kutayotgan odamlarga: e'lon endi katalogda.
   *
   * Namuna e'lon va egasining o'zi chetda qoladi - qoida matchWatches ichida, shu
   * yerda takrorlanmaydi. Egalar ro'yxati tashkilot a'zolarigacha yoyiladi, aks holda
   * bitta tashkilotning ikkinchi xodimi o'z e'loni haqida xabar olardi.
   */
  private async notifyWatchers(l: ListingRecord, now: Date) {
    const owners = await this.notifications.recipients({ orgIds: [l.orgId], userIds: [l.ownerUserId, l.createdById] });
    const userIds = await watchers(this.prisma, {
      kind: 'LISTING',
      isDemo: l.isDemo,
      skipUserIds: owners,
      // Hudud ro'yxat: avtotashuvchi o'z viloyatidan tashqarida ham ishlaydi va
      // katalog filtri ham aynan shu ikki maydonga qaraydi
      values: { listingKind: l.kind, regionCode: [l.regionCode, ...l.serviceRegions], truckType: l.truckType, deal: l.deal },
    }, now);
    if (!userIds.length) return;
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds },
      kind: 'watchListingNew',
      inApp: 'listing',
      href: l.kind === 'TRUCK' ? `/carriers/${l.slug}` : `/equipment/${l.slug}`,
      // card berilmaydi: qo'ng'iroq matni ham shablondan, har kimning tilida chiqsin
      vars: (lg) => ({ title: l.title.slice(0, 200), where: SEARCH_LABELS[lg].region[l.regionCode as RegionCode] ?? l.regionCode }),
    });
  }

  /**
   * Tekshiruvsiz darhol faol bo'ladimi.
   *
   * Tashkilot: tasdiqdan o'tgan bo'lsa (eski qoida o'zgarmaydi).
   * Yakka haydovchi: telefoni kod bilan tasdiqlangan (telefon User qatoriga faqat shu yo'l
   * bilan tushadi) va shu paytda uchtadan ko'p faol e'loni yo'q. Ro'yxatdan o'tish oqimi
   * haydovchini aynan shaxsiy e'lon berishga yuboradi, lekin e'loni tekshiruvni kutib
   * turardi va u o'sha kuni bozorda ko'rinmasdi.
   *
   * Admin sabab yozgan e'lon bu yo'ldan o'tmaydi. Faqat REJECTED ni tekshirish yetmaydi:
   * decide() faol e'lonni tortib olganda ARCHIVED yozadi va sababni o'sha qatorga qo'yadi,
   * ARCHIVED dan qayta yuborish esa egasiga ochiq. Sabab bor ekan, ikkinchi qarash kerak.
   *
   * Namuna e'lonlar uchun alohida shart yo'q: ular bazaga to'g'ridan-to'g'ri ACTIVE holida
   * ekiladi va egasi hisobi faol emas, ya'ni bu yo'lga umuman kira olmaydi.
   */
  private async instant(l: ListingRecord, userId: string, now: Date): Promise<boolean> {
    if (l.status === 'REJECTED' || l.rejectReason) return false;
    if (l.orgId) return (await this.access.membership(userId, l.orgId))?.org.kycStatus === 'VERIFIED';
    if (l.kind !== 'TRUCK' || !l.ownerUserId || !l.ownerUser?.phone) return false;
    // Muddati o'tgan qatorlar sanalmaydi: kunlik sikl ularni EXPIRED ga suradi,
    // oradagi bir necha soatni esa shu shart yopadi
    const active = await this.prisma.listing.count({
      where: { ownerUserId: l.ownerUserId, status: 'ACTIVE', id: { not: l.id }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    return active < PERSON_ACTIVE_MAX;
  }

  async archive(userId: string, id: string) {
    const l = await this.owned(userId, id);
    this.transition(l, 'ARCHIVED', 'OWNER');
    return this.save(l, { status: 'ARCHIVED', rejectReason: null });
  }

  async remove(userId: string, id: string) {
    const l = await this.owned(userId, id);
    if (l.status !== 'DRAFT') throw new ConflictException({ code: 'NOT_DRAFT', status: l.status });
    await this.repo.remove(id);
    return l;
  }

  /** Admin qarori; platforma admin tekshiruvi controller'da. */
  async decide(id: string, approve: boolean, reason: string | null) {
    const l = await this.repo.findById(id);
    if (!l) throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    // Rad etish maqsadi holatga qarab boshqacha: navbatdagi e'lon REJECTED bo'ladi, allaqachon
    // chiqib turgan e'lonni admin qaytarib olsa ARCHIVED (REJECTED ga o'tish qoidada yo'q edi va 500 berardi).
    const to: ListingStatus = approve ? 'ACTIVE' : l.status === 'ACTIVE' ? 'ARCHIVED' : 'REJECTED';
    this.transition(l, to, 'ADMIN');
    const now = new Date();
    // Namuna e'lon egasi faol hisob emas: unga yozilgan xabarni hech kim o'qimaydi
    const who = l.isDemo ? null : { orgIds: [l.orgId], userIds: [l.ownerUserId ?? l.createdById] };
    if (!approve) {
      const out = await this.save(l, { status: to, rejectReason: reason });
      if (who) void this.notify(who, 'listingRejected', { title: l.title, reason: reason ?? '' });
      return out;
    }
    // Tekshiruvdan o'tgan e'lon egasi obunachi bo'lsa darhol yuqoriga chiqadi
    const out = await this.activate(l, l.ownerUserId ?? l.createdById, now);
    if (who) void this.notify(who, 'listingApproved', { title: l.title });
    return out;
  }

  async inquire(userId: string, listingId: string, message: string, orgId: string | null, rawAttachments?: unknown) {
    const l = await this.repo.findById(listingId);
    if (!l || l.status !== 'ACTIVE') throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    // Namuna e'lon haqiqiy taklif emas: unga yozilgan xabar hech kimga bormaydi, shuning uchun qabul qilinmaydi
    if (l.isDemo) throw new ForbiddenException({ code: 'DEMO_TARGET' });
    if (orgId && !(await this.access.membership(userId, orgId))) throw new ForbiddenException({ code: 'NOT_ORG_MEMBER' });
    const text = message.trim();
    // Bitta e'longa bitta yozishma: takroriy murojaat eskisiga qo'shiladi. Ilgari har
    // safar yangi tred ochilardi va egasining ro'yxati bir odamdan kelgan o'nlab
    // yozishma bilan to'lib ketardi, suhbat esa bo'linib qolardi.
    const open = await this.prisma.inquiry.findFirst({
      where: { listingId, fromUserId: userId, toOrgId: l.orgId, toUserId: l.ownerUserId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    // Ilovalar birinchi xabarga ham ilashadi: narx so'rayotgan odam hujjatni o'sha zahoti yuboradi
    const files = filesOrThrow(rawAttachments);
    if (open) {
      const msg = await this.prisma.inquiryMessage.create({ data: { inquiryId: open.id, fromUserId: userId, text, attachments: files as unknown as object, readBy: [userId] } });
      // Yozuvchi bu yerda doim mijoz (qidiruv fromUserId bo'yicha): javob olgan suhbat qayta ochiladi
      await markInquiryMessage(this.prisma, open.id, msg.createdAt, false);
      void this.notifyOwner(l, userId, orgId, text, open.id).catch(() => {});
      return open;
    }
    // Qabul qiluvchi shu yerda qotiriladi: e'lon keyin boshqa tashkilotga o'tsa ham
    // eski yozishma yangi egaga ochilmaydi.
    const inquiry = await this.repo.createInquiry({ listingId, fromOrgId: orgId, fromUserId: userId, message: text, toOrgId: l.orgId, toUserId: l.ownerUserId });
    // So'rovning o'zi yozishmaning birinchi xabari: keyin ikki tomon shu tredda gaplashadi
    const first = await this.prisma.inquiryMessage.create({ data: { inquiryId: inquiry.id, fromUserId: userId, text, attachments: files as unknown as object, readBy: [userId] } });
    await markInquiryMessage(this.prisma, inquiry.id, first.createdAt, false);
    void this.notifyOwner(l, userId, orgId, text, inquiry.id).catch(() => {}); // javobni kutmaydi
    return inquiry;
  }

  /** Admin qarori egasiga: kabinetdagi qo'ng'iroq va Telegram. Xato qarorni to'xtatmaydi. */
  private notify(target: { orgIds: (string | null)[]; userIds: (string | null)[] }, kind: 'listingApproved' | 'listingRejected', vars: Record<string, string>) {
    void notifyBoth(this.prisma, this.notifications, { target, kind, inApp: 'listing', href: '/dashboard/listings', vars }).catch(() => {});
  }

  /** E'lon egasiga (tashkilot a'zolari yoki shaxsiy egasi) Telegram xabari; bog'lanmagan bo'lsa hech narsa. */
  private async notifyOwner(l: ListingRecord, fromUserId: string, fromOrgId: string | null, message: string, inquiryId: string) {
    const from = fromOrgId
      ? ((await this.prisma.organization.findUnique({ where: { id: fromOrgId }, select: { name: true } }))?.name ?? '')
      : await this.prisma.user.findUnique({ where: { id: fromUserId }, select: { fullName: true, phone: true } }).then((u) => u?.fullName || u?.phone || '');
    await notifyBoth(this.prisma, this.notifications, {
      target: { orgIds: [l.orgId], userIds: [l.ownerUserId], exceptUserId: fromUserId },
      kind: 'inquiry',
      inApp: 'inquiry',
      href: `/dashboard/inquiries/${inquiryId}`,
      vars: { title: l.title, from, message: message.slice(0, 500) },
      card: { title: l.title, body: message.slice(0, 200) },
    });
  }

  /** E'lon mavjud va: tashkilotniki bo'lsa foydalanuvchi shu tashkilotda e'lon bera oladi; shaxsiy bo'lsa faqat egasi. */
  async owned(userId: string, id: string) {
    const l = await this.repo.findById(id);
    if (!l) throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    if (l.orgId) await this.access.assertLister(userId, l.orgId, l.kind);
    else if (l.ownerUserId !== userId) throw new ForbiddenException({ code: 'NOT_LISTER', kind: l.kind });
    return l;
  }

  private check(input: ListingInput) {
    const r = validateListing(input);
    if (r.errors.length) throw new BadRequestException({ code: 'LISTING_INVALID', errors: r.errors, warnings: r.warnings });
    return r.warnings;
  }

  /** Nuqta: bog'langan obyekt, bo'lmasa viloyat markazi. Obyekt topilmasa 400. */
  private async point(input: ListingInput): Promise<{ lat: number | null; lng: number | null }> {
    if (input.terminalId) {
      const p = await this.repo.objectPoint(input.terminalId);
      if (!p) throw new BadRequestException({ code: 'OBJECT_NOT_FOUND', field: 'terminalId' });
      if (p.lat != null && p.lng != null) return p;
    }
    return REGION_CENTERS[input.regionCode];
  }

  private transition(l: ListingRecord, to: ListingStatus, actor: ListingActor) {
    try { assertListingTransition(l.status, to, actor); } catch (e) {
      if (e instanceof TransitionError) throw new ConflictException({ code: e.message, from: l.status, to });
      throw e;
    }
  }
}
