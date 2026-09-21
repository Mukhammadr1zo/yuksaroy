import { BadRequestException, Controller, Get, HttpException, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit.service';
import { DailyBucket } from '../../common/ip-bucket';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { SubscriberGuard } from './subscriber.guard';

const KINDS = ['listing', 'terminal', 'siding', 'org'] as const;
type Kind = (typeof KINDS)[number];

/**
 * Telefon raqamini ochish. Ilgari raqam ochiq sahifada turardi: e'londa hammaga,
 * reestrda kirgan foydalanuvchiga. Endi u obunachiga, bosilganda, kunlik chegara
 * bilan beriladi. Har ochilish auditga yoziladi: kim kimning raqamini olgani izi
 * qoladi, bazani ko'chirib olish esa chegaraga uriladi.
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get(':kind/:id')
  async reveal(@CurrentUserId() userId: string, @Param('kind') kind: string, @Param('id') id: string) {
    if (!(KINDS as readonly string[]).includes(kind)) throw new BadRequestException({ code: 'KIND', allowed: KINDS });
    const cfg = await this.config.get();
    const q = this.daily.take(userId, cfg.phoneRevealDaily);
    if (!q.ok) throw new HttpException({ code: 'RATE_LIMITED', used: q.used, limit: q.limit }, 429);
    const phone = await this.lookup(kind as Kind, id);
    if (phone === undefined) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.audit.log({ actorId: userId, action: 'contact.reveal', entity: kind, entityId: id });
    return { phone, quota: { used: q.used, limit: q.limit } };
  }

  /** undefined: obyekt yo'q; null: obyekt bor, raqami yo'q. */
  private async lookup(kind: Kind, id: string): Promise<string | null | undefined> {
    const byIdOrSlug = { OR: [{ id }, { slug: id }] };
    if (kind === 'listing') {
      const l = await this.prisma.listing.findFirst({ where: { ...byIdOrSlug, status: 'ACTIVE' }, select: { contactPhone: true } });
      return l ? l.contactPhone : undefined;
    }
    if (kind === 'org') {
      const o = await this.prisma.organization.findFirst({ where: byIdOrSlug, select: { phone: true } });
      return o ? o.phone : undefined;
    }
    // terminal va shahobcha bitta jadvalda: obyektning o'z raqami, bo'lmasa reestrdagi mas'ul shaxs raqami
    const t = await this.prisma.terminal.findFirst({ where: { ...byIdOrSlug, status: 'ACTIVE' }, select: { phone: true, contactPhone: true } });
    return t ? (t.phone ?? t.contactPhone) : undefined;
  }
}
