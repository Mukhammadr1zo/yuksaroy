import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../../catalog/domain/ports';
import { ORG_REPOSITORY, type OrganizationRepository } from '../../organizations/domain/ports';
import { CreateOrgUseCase } from '../../organizations/application/create-org.usecase';
import { PlatformAdmin } from '../../organizations/application/platform-admin';
import { PrismaService } from '../../../common/prisma.service';

/** Buyurtmani kim ko'radi va kim o'zgartiradi: mijoz (o'z tashkiloti) va terminal (o'z obyekti). */
@Injectable()
export class OrderAccess {
  constructor(
    @Inject(ORG_REPOSITORY) private readonly orgs: OrganizationRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    private readonly createOrg: CreateOrgUseCase,
    private readonly prisma: PrismaService,
    private readonly admin: PlatformAdmin,
  ) {}

  /**
   * Buyurtma uchun tashkilot: berilgan bo'lsa tekshiriladi, bo'lmasa mavjudi olinadi,
   * u ham bo'lmasa foydalanuvchi nomi bilan yuk egasi tashkiloti ochiladi (STIR keyin, hujjat kerak bo'lganda).
   */
  /** Bor tashkilot: yo'q bo'lsa null. Yangisi createShipperOrg bilan, faqat hamma tekshiruvdan keyin ochiladi. */
  async existingShipperOrg(userId: string, orgId?: string | null): Promise<string | null> {
    if (orgId) { await this.assertShipper(userId, orgId); return orgId; }
    const mine = await this.shipperOrgIds(userId);
    return mine.length ? mine[0]! : null;
  }

  /** Birinchi buyurtmada avtomatik yuk egasi tashkiloti (STIR keyin, hujjat kerak bo'lganda so'raladi). */
  async createShipperOrg(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
    const name = u?.fullName?.trim() || (u?.phone ? `Yuk egasi ${u.phone.slice(-4)}` : 'Yuk egasi');
    const org = await this.createOrg.execute(userId, { kinds: ['SHIPPER'], name, roles: ['CLIENT'] });
    return org.id;
  }

  /** Buyurtma bera oladigan tashkilotlar: yuk egasi yoki ekspeditor. */
  async shipperOrgIds(userId: string): Promise<string[]> {
    const ms = await this.orgs.listForUser(userId);
    return ms.filter((m) => m.isOwner || m.roles.includes('CLIENT') || m.roles.includes('FORWARDER')).map((m) => m.orgId);
  }

  async assertShipper(userId: string, orgId: string) {
    const m = await this.orgs.findMembership(userId, orgId);
    if (!m || !(m.isOwner || m.roles.includes('CLIENT') || m.roles.includes('FORWARDER'))) throw new ForbiddenException({ code: 'NOT_SHIPPER' });
    return m;
  }

  /** Foydalanuvchi boshqaradigan terminallar (TERMINAL tashkilotlari orqali). */
  async terminalIds(userId: string): Promise<string[]> {
    const ms = await this.orgs.listForUser(userId);
    const orgIds = ms.filter((m) => m.org.kinds.includes('TERMINAL') && (m.isOwner || m.roles.includes('TERMINAL_ADMIN') || m.roles.includes('TERMINAL_OPERATOR'))).map((m) => m.orgId);
    if (!orgIds.length) return [];
    const terminals = await this.catalog.listTerminals({ orgIds, status: 'ANY' }, new Date());
    return terminals.map((t) => t.id);
  }

  async assertTerminalOf(userId: string, terminalId: string) {
    const ids = await this.terminalIds(userId);
    if (!ids.includes(terminalId)) throw new ForbiddenException({ code: 'NOT_TERMINAL_STAFF' });
  }

  /**
   * Platforma admini: bitta manba, PlatformAdmin. Ilgari bu yerda o'z tekshiruvi bor edi va u
   * PLATFORM_ADMIN_PHONES ro'yxatini bilmasdi: telefon orqali admin bo'lgan odam hamma joyda
   * admin edi, faqat buyurtma va hisob-faktura yo'llarida emas.
   */
  isAdmin(userId: string): Promise<boolean> {
    return this.admin.isPlatformAdmin(userId);
  }
}
