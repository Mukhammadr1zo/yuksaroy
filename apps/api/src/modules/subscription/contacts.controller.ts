import { BadRequestException, Controller, Get, HttpException, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { uzLocalDate, uzLocalToUtc } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { REVEAL_ACTIONS } from '../../common/reveal-actions';
import { PrismaService } from '../../common/prisma.service';
import { ImpressionsService } from '../impressions/impressions.service';
import { visibleCompany } from '../catalog/infrastructure/prisma-catalog.repository';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { canSearch, serialize } from '../wagon/wagon.rules';
import { planLimit, SubscriptionService } from './subscription.service';

const KINDS = ['listing', 'terminal', 'org', 'service', 'request', 'offer'] as const;
type Kind = (typeof KINDS)[number];

/**
 * Topilgan raqam va u obuna ortidami.
 *
 * `id` topilgan obyektning haqiqiy id si: chaqiruvchi slug yoki buyurtma raqamini
 * yuborishi mumkin, sanoq esa bitta belgiga o'tirishi kerak.
 */
type Found = { id: string; phone: string | null; free: boolean };

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
 * Ochilgani serverda sanaladi: audit qatori bilan 'contact' mayog'i bitta shart
 * ostida yoziladi, ya'ni ikki son hech qachon bir-biriga zid ketmaydi.
 *
 * Sanoq auditdan o'qiladi, xotiradan emas: jarayon qayta ishga tushsa ham kunlik
 * chegara joyida qoladi.
 *
 * `id` slug ham bo'lishi mumkin: ochiq sahifalar slug bilan ishlaydi.
 */
@ApiTags('contacts')
@ApiCookieAuth('ys_access')
@Controller('contacts')
@UseGuards(JwtGuard)
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly audit: AuditService,
    private readonly subs: SubscriptionService,
    private readonly impressions: ImpressionsService,
  ) {}

  @Get(':kind/:id')
  async reveal(@CurrentUserId() userId: string, @Param('kind') kind: string, @Param('id') id: string) {
    if (!(KINDS as readonly string[]).includes(kind)) throw new BadRequestException({ code: 'KIND', allowed: KINDS });
    const found = await this.lookup(kind as Kind, id, userId);
    if (found === undefined) throw new NotFoundException({ code: 'NOT_FOUND' });
    // Bitta odam navbat bilan: sanoq o'qilishi va audit qatori orasiga uning ikkinchi
    // oynasidagi so'rovi kirmasin, aks holda bepul oyna chegaradan oshib ketardi.
    // Kalit nomlangan: vagon qidiruvi ham shu funksiyani BARE userId bilan chaqiradi,
    // nomsiz kalit raqamni upstream so'rovi ortida kuttirardi.
    return serialize(`reveal:${userId}`, () => this.give(userId, kind as Kind, found));
  }

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
  private async give(userId: string, kind: Kind, found: Found) {
    const { phone, free } = found;
    const cfg = await this.config.get();
    // Qator o'zi kerak, "bormi" degan javob emas: kunlik chegara tarifning o'z sonidan olinadi
    const act = await this.subs.active(userId, 'PHONE');
    const daily = planLimit(act?.limits, 'phoneRevealDaily', cfg.phoneRevealDaily);
    if (!free) {
      const subscriber = act !== null;
      /*
       * Bepul oyna: obunasiz odamga umrbod birinchi N ta raqam. Qoida vagon
       * qidiruvinikidan (canSearch): obunachi cheksiz, qolganiga N ta.
       *
       * N = 0 (sukut) bo'lsa sanoq umuman O'QILMAYDI: qo'shimcha so'rov yo'q va
       * shart bugungi shart bilan aynan bir xil bo'lib qoladi.
       */
      const freeUsed = !subscriber && cfg.phoneRevealFree > 0 ? await this.freeUsed(userId) : 0;
      // Devor javobida narx, kunlik chegara va bepul oyna ham bor: odam nima
      // ochilishini, qancha turishini va nimasi bepulligini shu yerdan biladi.
      if (!canSearch(subscriber, freeUsed, cfg.phoneRevealFree)) {
        throw new HttpException({ code: 'SUBSCRIPTION_REQUIRED', priceSom: cfg.subscriptionMonthSom, dailyLimit: daily, freeTotal: cfg.phoneRevealFree }, 402);
      }
    }
    if (phone === null) return { phone };
    const today = await this.todayReveals(userId, daily);
    // Dedup topilgan obyekt id si bo'yicha: bir odam bitta terminalni slug bilan ham,
    // id bilan ham ochsa bu BITTA ochilish
    const first = !today.some((r) => r.entity === kind && r.entityId === found.id);
    if (first) {
      if (today.length >= daily) throw new HttpException({ code: 'RATE_LIMITED', used: today.length, limit: daily }, 429);
      /*
       * Bu qator KVOTANING O'ZI: yozilmasa raqam ham berilmaydi. Xom Prisma xatosi
       * global filtrda 400/404 ga aylanib "raqam yo'q" bo'lib ko'rinardi, shuning
       * uchun o'z kodimizga o'raymiz, odam qayta urinadi.
       *
       * Bitim raqami alohida nom bilan: u qidiruvda ochilgan raqam emas va bepul
       * oynani yemaydi (kunlik chegaraga esa bugungidek sanaladi).
       */
      try {
        await this.audit.log({ actorId: userId, action: free ? 'contact.deal' : 'contact.reveal', entity: kind, entityId: found.id }, true);
      } catch {
        throw new HttpException({ code: 'RETRY' }, 503);
      }
      // Sanoq serverda: bu yerda raqam haqiqatan berilgani aniq. Mayoq xatosi
      // ochilishni yiqitmasin, u kvota emas.
      if (kind === 'listing' || kind === 'terminal' || kind === 'org') {
        await this.impressions.record([{ kind, targetId: found.id, surface: 'contact' }]).catch(() => {});
      }
    }
    return { phone };
  }

  /**
   * Bugun ochilgan obyektlar, TOSHKENT kuni bo'yicha. Xotira chelagi emas, audit:
   * jarayon qayta ishga tushsa ham sanoq nolga qaytmaydi.
   *
   * Bitta so'rovdan ikki javob: nechta ochilgan (uzunlik) va shu obyekt allaqachon
   * ochilganmi (ro'yxatda bormi).
   * ponytail: take chegaradan sal ortiq. 100 pol: egasi chegarani kun o'rtasida
   * tushirsa ham ertalab ochilgan obyekt ro'yxatda qolsin, aks holda to'lagan odam
   * o'zi ochgan raqamni qayta ko'ra olmasdi.
   */
  private todayReveals(userId: string, limit: number) {
    const dayStart = uzLocalToUtc(uzLocalDate(new Date()), '00:00');
    return this.prisma.auditLog.findMany({
      where: { actorId: userId, action: { in: [...REVEAL_ACTIONS] }, createdAt: { gte: dayStart } },
      select: { entity: true, entityId: true },
      orderBy: { createdAt: 'desc' },
      take: Math.max(limit, 100) + 1,
    });
  }

  /** Umrbod nechta raqam ochgan (bitim raqamlari sanalmaydi): bepul oyna shu songa qaraydi. */
  private freeUsed(userId: string) {
    return this.prisma.auditLog.count({ where: { actorId: userId, action: 'contact.reveal' } });
  }

  /** undefined: obyekt yo'q yoki katalogda ko'rinmaydi; phone null: obyekt bor, raqami yo'q. */
  private async lookup(kind: Kind, id: string, userId: string): Promise<Found | undefined> {
    const byIdOrSlug = { OR: [{ id }, { slug: id }] };
    const now = new Date();
    // Namuna qatorlar (isDemo) hech qachon raqam bermaydi: ular haqiqiy taklif emas
    if (kind === 'listing') {
      const l = await this.prisma.listing.findFirst({ where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, select: { id: true, contactPhone: true, isDemo: true } });
      return l ? { id: l.id, phone: l.isDemo ? null : some(l.contactPhone), free: false } : undefined;
    }
    if (kind === 'org') {
      // Katalogdagi kompaniya sahifasi bilan bir xil shart: ko'rinmagan tashkilot raqami ham berilmaydi
      const o = await this.prisma.organization.findFirst({ where: { AND: [byIdOrSlug, visibleCompany(now)] }, select: { id: true, phone: true, isDemo: true } });
      return o ? { id: o.id, phone: o.isDemo ? null : some(o.phone), free: false } : undefined;
    }
    if (kind === 'service') {
      const sp = await this.prisma.serviceProfile.findFirst({ where: { id, status: 'ACTIVE' }, select: { id: true, contactPhone: true, isDemo: true } });
      return sp ? { id: sp.id, phone: sp.isDemo ? null : some(sp.contactPhone), free: false } : undefined;
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
            // Tanlangandan keyin raqam faqat g'olibniki. DONE ham shu yerda:
            // ish bajarilgan deb belgilangani raqamni yopish sababi emas
            { OR: [{ status: 'OPEN' }, { status: { in: ['AWARDED', 'DONE'] }, offers: { some: { status: 'AWARDED', providerUserId: userId } } }] },
          ],
        },
        select: { id: true, contactPhone: true, isDemo: true, status: true },
      });
      if (!r) return undefined;
      // Tanlangan yoki bajarilgan so'rov: bitim tuzilgan, raqam obunasiz beriladi
      return { id: r.id, phone: r.isDemo ? null : some(r.contactPhone), free: r.status !== 'OPEN' };
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
        select: { id: true, providerUserId: true, providerOrgId: true, request: { select: { isDemo: true } } },
      });
      if (!o) return undefined;
      if (o.request.isDemo) return { id: o.id, phone: null, free: true };
      const [org, u] = await Promise.all([
        o.providerOrgId ? this.prisma.organization.findUnique({ where: { id: o.providerOrgId }, select: { phone: true } }) : null,
        this.prisma.user.findUnique({ where: { id: o.providerUserId }, select: { phone: true } }),
      ]);
      return { id: o.id, phone: some(org?.phone) ?? some(u?.phone), free: true };
    }
    // Terminal va shahobcha bitta jadvalda. Ochiq sahifa sharti: ACTIVE va (egasi bor yoki reestr shahobchasi).
    // Raqam: obyektning o'z raqami, bo'lmasa reestrdagi mas'ul shaxs raqami.
    const t = await this.prisma.terminal.findFirst({ where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { OR: [{ orgId: { not: null } }, { kind: 'RAIL' }] }] }, select: { id: true, phone: true, contactPhone: true, isDemo: true } });
    return t ? { id: t.id, phone: t.isDemo ? null : (some(t.phone) ?? some(t.contactPhone)), free: false } : undefined;
  }
}
