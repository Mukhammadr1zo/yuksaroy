import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../../catalog/domain/ports';
import { ORG_REPOSITORY, type OrganizationRepository } from '../../organizations/domain/ports';

/** Buyurtmani kim ko'radi va kim o'zgartiradi: mijoz (o'z tashkiloti) va terminal (o'z obyekti). */
@Injectable()
export class OrderAccess {
  constructor(
    @Inject(ORG_REPOSITORY) private readonly orgs: OrganizationRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

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

  async isAdmin(userId: string): Promise<boolean> {
    const ms = await this.orgs.listForUser(userId);
    return ms.some((m) => m.roles.includes('PLATFORM_ADMIN') || m.roles.includes('PLATFORM_OPERATOR'));
  }
}
