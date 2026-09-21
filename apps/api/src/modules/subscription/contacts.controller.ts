import { BadRequestException, Controller, Get, HttpException, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit.service';
import { DailyBucket } from '../../common/ip-bucket';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { visibleCompany } from '../catalog/infrastructure/prisma-catalog.repository';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { SubscriberGuard } from './subscriber.guard';

const KINDS = ['listing', 'terminal', 'org'] as const;
type Kind = (typeof KINDS)[number];

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
@UseGuards(JwtGuard, SubscriberGuard)
export class ContactsController {
  // ponytail: bitta jarayon uchun; replica bo'lsa Redis
  private readonly daily = new DailyBucket();
  /** Bugun shu odam shu obyektni ochganmi: limit 1, ikkinchi take rad etiladi = allaqachon ochilgan */
  private readonly seen = new DailyBucket();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get(':kind/:id')
  async reveal(@CurrentUserId() userId: string, @Param('kind') kind: string, @Param('id') id: string) {
    if (!(KINDS as readonly string[]).includes(kind)) throw new BadRequestException({ code: 'KIND', allowed: KINDS });
    const phone = await this.lookup(kind as Kind, id);
    if (phone === undefined) throw new NotFoundException({ code: 'NOT_FOUND' });
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

  /** undefined: obyekt yo'q yoki katalogda ko'rinmaydi; null: obyekt bor, raqami yo'q. */
  private async lookup(kind: Kind, id: string): Promise<string | null | undefined> {
    const byIdOrSlug = { OR: [{ id }, { slug: id }] };
    const now = new Date();
    if (kind === 'listing') {
      const l = await this.prisma.listing.findFirst({ where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, select: { contactPhone: true } });
      return l ? some(l.contactPhone) : undefined;
    }
    if (kind === 'org') {
      // Katalogdagi kompaniya sahifasi bilan bir xil shart: ko'rinmagan tashkilot raqami ham berilmaydi
      const o = await this.prisma.organization.findFirst({ where: { AND: [byIdOrSlug, visibleCompany(now)] }, select: { phone: true } });
      return o ? some(o.phone) : undefined;
    }
    // Terminal va shahobcha bitta jadvalda. Ochiq sahifa sharti: ACTIVE va (egasi bor yoki reestr shahobchasi).
    // Raqam: obyektning o'z raqami, bo'lmasa reestrdagi mas'ul shaxs raqami.
    const t = await this.prisma.terminal.findFirst({ where: { AND: [byIdOrSlug, { status: 'ACTIVE' }, { OR: [{ orgId: { not: null } }, { kind: 'RAIL' }] }] }, select: { phone: true, contactPhone: true } });
    return t ? (some(t.phone) ?? some(t.contactPhone)) : undefined;
  }
}
