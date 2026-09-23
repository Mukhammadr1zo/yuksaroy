import { BadRequestException, Controller, Get, HttpException, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit.service';
import { DailyBucket } from '../../common/ip-bucket';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { visibleCompany } from '../catalog/infrastructure/prisma-catalog.repository';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { SubscriptionService } from './subscription.service';

const KINDS = ['listing', 'terminal', 'org', 'service', 'request', 'offer'] as const;
type Kind = (typeof KINDS)[number];

/** Topilgan raqam va u obuna ortidami. */
type Found = { phone: string | null; free: boolean };

/** Bo'sh satr ham "raqam yo'q": forma tozalanganda '' saqlanib qoladi. */
const some = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Telefon raqamini ochish. Ilgari raqam ochiq sahifada turardi: e'londa hammaga,
 * reestrda kirgan foydalanuvchiga. Endi u obunachiga, bosilganda, kunlik chegara
 * bilan beriladi. Har ochilish auditga yoziladi: kim kimning raqamini olgani izi
 * qoladi, bazani ko'chirib olish esa chegaraga uriladi.
 *
 * Chegara faqat haqiqatan raqam berilganda va bir obyekt uchun kuniga bir marta
 * sanaladi: sahifani yangilab qayta bosish yoki raqamsiz obyekt kvotani yemaydi.
 *
 * Ko'rinish qoidasi ochiq katalog bilan bir xil: katalogda 404 bo'lgan obyektning
 * raqami bu yerdan ham olinmaydi.
 *
 * `id` slug ham bo'lishi mumkin: ochiq sahifalar slug bilan ishlaydi.
 */
@ApiTags('contacts')
@ApiCookieAuth('ys_access')
@Controller('contacts')
@UseGuards(JwtGuard)
export class ContactsController {
  // ponytail: bitta jarayon uchun; replica bo'lsa Redis
  private readonly daily = new DailyBucket();
  /** Bugun shu odam shu obyektni ochganmi: limit 1, ikkinchi take rad etiladi = allaqachon ochilgan */
  private readonly seen = new DailyBucket();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly audit: AuditService,
    private readonly subs: SubscriptionService,
  ) {}

  @Get(':kind/:id')
  async reveal(@CurrentUserId() userId: string, @Param('kind') kind: string, @Param('id') id: string) {
    if (!(KINDS as readonly string[]).includes(kind)) throw new BadRequestException({ code: 'KIND', allowed: KINDS });
    const found = await this.lookup(kind as Kind, id, userId);
    if (found === undefined) throw new NotFoundException({ code: 'NOT_FOUND' });
    const { phone, free } = found;
    /*
     * Obuna qorovuli sinf darajasidan shu yerga ko'chdi.
     *
     * Bitim tuzilgandan keyin, ya'ni yuk egasi ijrochini tanlaganda, ikki taraf
     * bir-birining raqamini obunasiz oladi. Sabab: o'sha lahzada to'lov devori
     * qo'yilsa ikkalasi ham bitimni platformadan tashqariga olib chiqadi, chunki
     * ular allaqachon bir-birini tanlab bo'lgan. Obuna esa oldingi bosqichda,
     * raqamni QIDIRISH paytida (katalog, e'lon, ochiq so'rov) o'z kuchida qoladi.
     *
     * Bu qoidani teskari qilish uchun `free` ni hisoblaydigan ikki joyni
     * false ga o'zgartirish yetadi.
     */
    if (!free && !(await this.subs.isActive(userId))) throw new HttpException({ code: 'SUBSCRIPTION_REQUIRED' }, 402);
    const cfg = await this.config.get();
    let quota = { used: 0, limit: cfg.phoneRevealDaily };
    if (phone !== null) {
      const first = this.seen.take(`${userId}:${kind}:${id}`, 1).ok;
      const q = first ? this.daily.take(userId, cfg.phoneRevealDaily) : { ok: true, used: 0, limit: cfg.phoneRevealDaily };
      if (!q.ok) throw new HttpException({ code: 'RATE_LIMITED', used: q.used, limit: q.limit }, 429);
      quota = { used: q.used, limit: q.limit };
      if (first) await this.audit.log({ actorId: userId, action: 'contact.reveal', entity: kind, entityId: id });
    }
    return { phone, quota };
  }

  /** undefined: obyekt yo'q yoki katalogda ko'rinmaydi; phone null: obyekt bor, raqami yo'q. */
  private async lookup(kind: Kind, id: string, userId: string): Promise<Found | undefined> {
    const byIdOrSlug = { OR: [{ id }, { slug: id }] };
    const now = new Date();
    // Namuna qatorlar (isDemo) hech qachon raqam bermaydi: ular haqiqiy taklif emas
    if (kind === 'listing') {
      const l = await this.prisma.listing.findFirst({ where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, select: { contactPhone: true, isDemo: true } });
      return l ? { phone: l.isDemo ? null : some(l.contactPhone), free: false } : undefined;
    }
    if (kind === 'org') {
      // Katalogdagi kompaniya sahifasi bilan bir xil shart: ko'rinmagan tashkilot raqami ham berilmaydi
      const o = await this.prisma.organization.findFirst({ where: { AND: [byIdOrSlug, visibleCompany(now)] }, select: { phone: true, isDemo: true } });
      return o ? { phone: o.isDemo ? null : some(o.phone), free: false } : undefined;
    }
    if (kind === 'service') {
      const sp = await this.prisma.serviceProfile.findFirst({ where: { id, status: 'ACTIVE' }, select: { contactPhone: true, isDemo: true } });
      return sp ? { phone: sp.isDemo ? null : some(sp.contactPhone), free: false } : undefined;
    }
    if (kind === 'request') {
      /*
       * Ochiq so'rovning raqami har obunachiga ochiq: taklif berish uchun kerak.
       * Tanlangandan keyin esa u faqat TANLANGAN ijrochiniki bo'ladi.
       *
       * Ilgari shart faqat holatni tekshirardi, ya'ni tanlanmagan ijrochi ham
       * tanlangan so'rovning raqamini olaverardi va yuk egasiga bo'lak odamlar
       * qo'ng'iroq qilaverardi.
       */
      const r = await this.prisma.marketRequest.findFirst({
        where: {
          AND: [
            { OR: [{ id }, { no: id }] },
            { OR: [{ status: 'OPEN' }, { status: 'AWARDED', offers: { some: { status: 'AWARDED', providerUserId: userId } } }] },
          ],
        },
        select: { contactPhone: true, isDemo: true, status: true },
      });
      if (!r) return undefined;
      // Tanlangan so'rov: bitim tuzilgan, raqam obunasiz beriladi
      return { phone: r.isDemo ? null : some(r.contactPhone), free: r.status === 'AWARDED' };
    }
    if (kind === 'offer') {
      /*
       * Tanlangan taklif egasining raqami, faqat so'rov egasiga. Halqa shu yerda
       * yopiladi: ilgari yuk egasi g'olibni tanlagach unga bog'lanadigan yo'l yo'q edi.
       *
       * Ikki o'qish: MarketOffer da providerUserId uchun relation yo'q.
       */
      const o = await this.prisma.marketOffer.findFirst({
        where: { id, status: 'AWARDED', request: { createdById: userId } },
        select: { providerUserId: true, providerOrgId: true, request: { select: { isDemo: true } } },
      });
      if (!o) return undefined;
      if (o.request.isDemo) return { phone: null, free: true };
      const [org, u] = await Promise.all([
        o.providerOrgId ? this.prisma.organization.findUnique({ where: { id: o.providerOrgId }, select: { phone: true } }) : null,
        this.prisma.user.findUnique({ where: { id: o.providerUserId }, select: { phone: true } }),
      ]);
      return { phone: some(org?.phone) ?? some(u?.phone), free: true };
    }
    // Terminal va shahobcha bitta jadvalda. Ochiq sahifa sharti: ACTIVE va (egasi bor yoki reestr shahobchasi).
    // Raqam: obyektning o'z raqami, bo'lmasa reestrdagi mas'ul shaxs raqami.
    const t = await this.prisma.terminal.findFirst({ where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { OR: [{ orgId: { not: null } }, { kind: 'RAIL' }] }] }, select: { phone: true, contactPhone: true, isDemo: true } });
    return t ? { phone: t.isDemo ? null : (some(t.phone) ?? some(t.contactPhone)), free: false } : undefined;
  }
}
