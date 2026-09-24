import { Body, Controller, HttpCode, HttpException, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import { REPORT, REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { AdminNotify } from '../organizations/application/admin-notify';

class ReportDto {
  @IsIn(REPORT_TARGETS) kind!: ReportTarget;
  /** Obyekt id si; e'lon va terminalda slug, so'rov va buyurtmada raqam ham bo'ladi. */
  @IsString() @Length(1, 100) id!: string;
  @IsIn(REPORT_REASONS) reason!: ReportReason;
  @IsString() @Length(REPORT.textMin, REPORT.textMax) text!: string;
}

// Har shikoyat adminlarga xabar yuboradi: chelak foydalanuvchi bo'yicha
const bucket = new IpBucket(REPORT.perHour, 3_600_000);

/**
 * Shikoyat: e'lon, terminal, xizmat sahifasi, bozor so'rovi yoki buyurtma ustidan.
 *
 * Murojaat formasi bilan bir xil yo'l: qator saqlanadi va adminlarga xabar ketadi.
 * Farqi shundaki, shikoyat aniq obyektga tegishli va kirgan odamdan keladi, shuning
 * uchun "bir odam bir obyektga bir marta" qoidasi bazadagi noyoblik kaliti bilan
 * ushlanadi. Takrorlanish global Prisma filtridan 409 DUPLICATE bo'lib qaytadi,
 * ya'ni bu yerda oldindan tekshiruv YO'Q: u baribir ikki barobar yuborishni to'xtata
 * olmasdi va bitta ortiqcha so'rov qo'shardi.
 *
 * Xabar AdminNotify orqali, xom fetch bilan emas: AdminNotify panel qo'ng'irog'ini
 * ham yuboradi va matnni oluvchining tilida beradi.
 */
@ApiTags('reports')
@ApiCookieAuth('ys_access')
@Controller('reports')
@UseGuards(JwtGuard)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminNotify: AdminNotify,
  ) {}

  @Post() @HttpCode(200)
  async create(@CurrentUserId() userId: string, @Body() dto: ReportDto) {
    if (!bucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    const t = await this.target(dto.kind, dto.id.trim(), userId);
    if (!t) throw new NotFoundException({ code: 'TARGET_NOT_FOUND' });
    const r = await this.prisma.report.create({
      data: {
        reporterId: userId, targetKind: dto.kind, targetId: t.id,
        targetTitle: t.title, targetHref: t.href, reason: dto.reason, text: dto.text.trim(),
      },
    });
    await this.audit.log({ actorId: userId, action: 'report.create', entity: 'Report', entityId: r.id, meta: { kind: dto.kind, targetId: t.id, reason: dto.reason } });
    /*
     * Javob kutilmaydi: xabar yiqilsa ham shikoyat saqlangan va navbatda ko'rinadi.
     *
     * Uchinchi parametr SHIKOYAT id si, obyekt id si emas: AdminNotify bitta obyekt
     * haqida 6 soat jim turadi, ya'ni obyekt id si berilsa bir e'longa kelgan ikkinchi
     * shikoyat umuman eshitilmasdi.
     */
    void this.adminNotify.queued('reportsNew', t.title, r.id, userId).catch(() => {});
    return { ok: true, id: r.id };
  }

  /**
   * Obyekt bormi, ko'rinadimi va namunami. Namuna qatorlar (isDemo) shikoyat qabul
   * qilmaydi: ular haqiqiy taklif emas va ularda tugma ham chizilmaydi.
   *
   * Ko'rinish sharti ochiq katalog bilan bir xil: katalogda 404 bo'lgan obyekt ustidan
   * shikoyat ham yozilmaydi.
   *
   * Qaytadi: haqiqiy id, nomi va sahifasi. Oxirgi ikkisi qatorga nusxalanadi.
   * ponytail: nom va havola nusxa, ya'ni slug o'zgarsa eski havola eskiradi;
   * kerak bo'lsa targetKind + targetId dan qayta hisoblanadi.
   */
  private async target(kind: ReportTarget, id: string, userId: string): Promise<{ id: string; title: string; href: string } | null> {
    const byIdOrSlug = { OR: [{ id }, { slug: id }] };
    const now = new Date();

    if (kind === 'listing') {
      const l = await this.prisma.listing.findFirst({
        where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { isDemo: false }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
        select: { id: true, title: true, slug: true, kind: true },
      });
      return l && { id: l.id, title: l.title, href: `/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}` };
    }

    if (kind === 'terminal') {
      // Shahobcha ham terminal: egasi tasdiqlanmagan obyekt ham shikoyat qabul qiladi,
      // chunki aynan unda noto'g'ri ma'lumot ko'p uchraydi.
      const t = await this.prisma.terminal.findFirst({
        where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { isDemo: false }, { OR: [{ orgId: { not: null } }, { kind: 'RAIL' }] }] },
        select: { id: true, name: true, slug: true },
      });
      return t && { id: t.id, title: t.name, href: `/terminals/${t.slug}` };
    }

    if (kind === 'service') {
      const s = await this.prisma.serviceProfile.findFirst({ where: { id, status: 'ACTIVE', isDemo: false }, select: { id: true, title: true } });
      return s && { id: s.id, title: s.title, href: `/services/${s.id}` };
    }

    if (kind === 'request') {
      // Yopilgan so'rov ham ochiladi (havola Telegramdan keladi), shuning uchun holat filtri yo'q
      const r = await this.prisma.marketRequest.findFirst({
        where: { AND: [{ OR: [{ id }, { no: id }] }, { isDemo: false }] },
        select: { id: true, no: true, title: true, board: true },
      });
      return r && { id: r.id, title: `${r.no} ${r.title}`, href: r.board === 'CARGO' ? `/cargo/${r.no}` : `/services/requests/${r.no}` };
    }

    /*
     * Buyurtma faqat o'z tomonlariga: begona odam boshqa birovning buyurtmasi ustidan
     * shikoyat yoza olmasligi kerak.
     *
     * DIQQAT, ataylab qilingan yon: bu shart buyurtma ekranidagi qorovuldan BO'SHROQ -
     * u yerda rol ham talab qilinadi, bu yerda tashkilotning istalgan a'zosi o'tadi.
     * Zararsiz, chunki javob faqat "yozildi" yoki 404 (hech qanday ma'lumot qaytmaydi),
     * nom va havola faqat admin ekranida ko'rinadi, tugmaning o'zi esa allaqachon
     * qorovul ortidagi sahifada chiziladi.
     */
    const o = await this.prisma.order.findFirst({
      where: {
        AND: [
          { OR: [{ id }, { no: id }] },
          { OR: [
            { createdById: userId },
            { shipperOrg: { members: { some: { userId } } } },
            { terminal: { org: { members: { some: { userId } } } } },
          ] },
        ],
      },
      select: { id: true, no: true },
    });
    // Buyurtmaning ommaviy sahifasi yo'q: admin uni o'z ekranidan topadi
    return o && { id: o.id, title: o.no, href: `/admin/orders?q=${o.no}` };
  }
}
