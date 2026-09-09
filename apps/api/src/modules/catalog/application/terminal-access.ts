import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ORG_REPOSITORY, type OrganizationRepository } from '../../organizations/domain/ports';

/** Katalogdagi yozish amallari uchun ruxsat: a'zolik + rol. Haqiqiy ruxsat shu yerda, middleware faqat cookie'ni tekshiradi. */
@Injectable()
export class TerminalAccess {
  constructor(@Inject(ORG_REPOSITORY) private readonly orgs: OrganizationRepository) {}

  /** TERMINAL tashkilotining egasi yoki TERMINAL_ADMIN roli. */
  async assertTerminalAdmin(userId: string, orgId: string) {
    const m = await this.orgs.findMembership(userId, orgId);
    // Ko'p turli tashkilot: kinds ichida TERMINAL bo'lsa yetarli (kind = kinds[0] bo'lgani uchun tekshiruv kinds bo'yicha)
    if (!m || !m.org.kinds.includes('TERMINAL') || !(m.isOwner || m.roles.includes('TERMINAL_ADMIN'))) {
      throw new ForbiddenException({ code: 'NOT_TERMINAL_ADMIN' });
    }
  }

  /** Shahobcha claim: tashkilot egasi yoki ASSET_OWNER roli (tashkilot turi cheklanmaydi, vetvevladelets har qanday korxona bo'lishi mumkin). */
  async assertSidingClaimant(userId: string, orgId: string) {
    const m = await this.orgs.findMembership(userId, orgId);
    if (!m || !(m.isOwner || m.roles.includes('ASSET_OWNER'))) throw new ForbiddenException({ code: 'NOT_ORG_OWNER' });
  }

  async orgIdsOf(userId: string) {
    return (await this.orgs.listForUser(userId)).map((m) => m.orgId);
  }
}
