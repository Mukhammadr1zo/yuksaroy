import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LISTING, REGION_CENTERS, TransitionError, assertListingTransition, slugify, validateListing, type ListingActor, type ListingInput, type ListingStatus, type RegionCode } from '@yuksaroy/domain';
import { uniqueSlug, type ListingRecord } from '../domain/listing-query';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../../common/prisma.service';
import { notifyTelegram, webUrl } from '../../../common/telegram';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { ListingAccess } from './listing-access';
import { FILE_URL } from '../../../common/file-url';
import { AttachmentError, parseAttachments, type Attachment } from '../../chat/domain/attachments';

/** Saqlangan yozuvdan domen kiritmasi (PATCH da birlashtirish va qayta tekshirish uchun). */
export function inputOf(l: ListingRecord): ListingInput {
  return {
    kind: l.kind, ownerType: l.orgId ? 'org' : 'person', deal: l.deal, title: l.title, description: l.description, regionCode: l.regionCode as RegionCode,
    terminalId: l.terminalId, priceTiyin: l.priceTiyin, priceUnit: l.priceUnit, photos: l.photos,
    year: l.year, condition: l.condition, model: l.model, qty: l.qty, wagonType: l.wagonType, capacityT: l.capacityT,
    truckType: l.truckType, tonnage: l.tonnage, fleetSize: l.fleetSize, serviceRegions: l.serviceRegions as RegionCode[], routes: l.routes,
    contactPhone: l.contactPhone, responseHours: l.responseHours,
  };
}

const expiry = (now: Date) => new Date(now.getTime() + LISTING.expireDays * 86_400_000);

@Injectable()
export class ListingsUseCase {
  constructor(
    private readonly repo: PrismaListingRepository,
    private readonly access: ListingAccess,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** orgId bo'lsa tashkilot nomidan (ruxsat tekshiriladi), bo'lmasa shaxsan (faqat TRUCK; validateListing ORG_REQUIRED). */
  async create(userId: string, orgId: string | null, input: ListingInput) {
    if (orgId) await this.access.assertLister(userId, orgId, input.kind);
    input = { ...input, ownerType: orgId ? 'org' : 'person' };
    const warnings = this.check(input);
    const point = await this.point(input);
    const slug = await uniqueSlug(slugify(input.title) || 'elon', (s) => this.repo.slugExists(s));
    return { listing: await this.repo.create({ ...input, ...point, slug, orgId, ownerUserId: orgId ? null : userId, createdById: userId }), warnings };
  }

  /** Qisman yangilash: saqlangan + kelgan maydonlar birgalikda to'liq tekshiriladi. Holat o'zgarmaydi. */
  async update(userId: string, id: string, patch: Partial<ListingInput>) {
    const l = await this.owned(userId, id);
    const input: ListingInput = { ...inputOf(l), ...patch, ownerType: l.orgId ? 'org' : 'person' };
    if (input.kind !== l.kind && l.orgId) await this.access.assertLister(userId, l.orgId, input.kind);
    const warnings = this.check(input);
    const point = await this.point(input);
    return { listing: await this.repo.update(id, { ...input, ...point }), warnings };
  }

  /** Egasi yuboradi: KYC VERIFIED bo'lsa darhol ACTIVE (SYSTEM), aks holda PENDING_REVIEW. Shaxsiy e'lon doim tekshiruvga. */
  async publish(userId: string, id: string) {
    const l = await this.owned(userId, id);
    const m = l.orgId ? await this.access.membership(userId, l.orgId) : null;
    this.transition(l, 'PENDING_REVIEW', 'OWNER');
    const now = new Date();
    if (m?.org.kycStatus !== 'VERIFIED') return this.repo.setStatus(id, { status: 'PENDING_REVIEW', rejectReason: null });
    return this.repo.setStatus(id, { status: 'ACTIVE', publishedAt: now, expiresAt: expiry(now), rejectReason: null });
  }

  async archive(userId: string, id: string) {
    const l = await this.owned(userId, id);
    this.transition(l, 'ARCHIVED', 'OWNER');
    return this.repo.setStatus(id, { status: 'ARCHIVED', rejectReason: null });
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
    return approve
      ? this.repo.setStatus(id, { status: 'ACTIVE', publishedAt: now, expiresAt: expiry(now), rejectReason: null })
      : this.repo.setStatus(id, { status: to, rejectReason: reason });
  }

  async inquire(userId: string, listingId: string, message: string, orgId: string | null, rawAttachments?: unknown) {
    const l = await this.repo.findById(listingId);
    if (!l || l.status !== 'ACTIVE') throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    // Namuna e'lon haqiqiy taklif emas: unga yozilgan xabar hech kimga bormaydi, shuning uchun qabul qilinmaydi
    if ((l as { isDemo?: boolean }).isDemo) throw new ForbiddenException({ code: 'DEMO_TARGET' });
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
    let files: Attachment[];
    try { files = parseAttachments(rawAttachments, FILE_URL); } catch (e) {
      if (e instanceof AttachmentError) throw new BadRequestException({ code: e.code });
      throw e;
    }
    if (open) {
      await this.prisma.inquiryMessage.create({ data: { inquiryId: open.id, fromUserId: userId, text, attachments: files as unknown as object, readBy: [userId] } });
      await this.prisma.inquiry.update({ where: { id: open.id }, data: { lastMessageAt: new Date() } });
      void this.notifyOwner(l, userId, orgId, text, open.id).catch(() => {});
      return open;
    }
    // Qabul qiluvchi shu yerda qotiriladi: e'lon keyin boshqa tashkilotga o'tsa ham
    // eski yozishma yangi egaga ochilmaydi.
    const inquiry = await this.repo.createInquiry({ listingId, fromOrgId: orgId, fromUserId: userId, message: text, toOrgId: l.orgId, toUserId: l.ownerUserId });
    // So'rovning o'zi yozishmaning birinchi xabari: keyin ikki tomon shu tredda gaplashadi
    await this.prisma.inquiryMessage.create({ data: { inquiryId: inquiry.id, fromUserId: userId, text, attachments: files as unknown as object, readBy: [userId] } });
    await this.prisma.inquiry.update({ where: { id: inquiry.id }, data: { lastMessageAt: new Date() } });
    void this.notifyOwner(l, userId, orgId, text, inquiry.id).catch(() => {}); // javobni kutmaydi
    return inquiry;
  }

  /** E'lon egasiga (tashkilot a'zolari yoki shaxsiy egasi) Telegram xabari; bog'lanmagan bo'lsa hech narsa. */
  private async notifyOwner(l: ListingRecord, fromUserId: string, fromOrgId: string | null, message: string, inquiryId: string) {
    const from = fromOrgId
      ? ((await this.prisma.organization.findUnique({ where: { id: fromOrgId }, select: { name: true } }))?.name ?? '')
      : await this.prisma.user.findUnique({ where: { id: fromUserId }, select: { fullName: true, phone: true } }).then((u) => u?.fullName || u?.phone || '');
    const to = (await this.notifications.recipients({ orgIds: [l.orgId], userIds: [l.ownerUserId] })).filter((id) => id !== fromUserId);
    await this.notifications.push(to, { kind: 'inquiry', title: l.title, body: message.slice(0, 200), href: `/dashboard/inquiries/${inquiryId}` });
    await notifyTelegram(this.prisma, { orgIds: [l.orgId], userIds: [l.ownerUserId], exceptUserId: fromUserId }, 'inquiry', {
      title: l.title, from, message: message.slice(0, 500), url: webUrl(`/dashboard/inquiries/${inquiryId}`),
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

  /** Nuqta: bog'langan terminal/shahobcha, bo'lmasa viloyat markazi. Obyekt topilmasa 400. */
  private async point(input: ListingInput): Promise<{ lat: number | null; lng: number | null }> {
    const link = input.terminalId ? (['terminal', input.terminalId] as const) : null;
    if (link) {
      const p = await this.repo.objectPoint(link[0], link[1]);
      if (!p) throw new BadRequestException({ code: 'OBJECT_NOT_FOUND', field: link[0] === 'terminal' ? 'terminalId' : 'sidingId' });
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
