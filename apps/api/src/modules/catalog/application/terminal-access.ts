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

  /** Da'vo: tashkilot egasi yoki ASSET_OWNER roli. Tashkilot turi cheklanmaydi: yo'l egasi har qanday korxona bo'lishi mumkin. */
  async assertClaimant(userId: string, orgId: string) {
    const m = await this.orgs.findMembership(userId, orgId);
    if (!m || !(m.isOwner || m.roles.includes('ASSET_OWNER'))) throw new ForbiddenException({ code: 'NOT_ORG_OWNER' });
  }

  /**
   * O'z obyektiga yozish: tashkilot turi ahamiyatsiz, qator allaqachon shu tashkilotniki
   * (uni yo turi tekshirilgan create bergan, yo admin tasdiqlagan da'vo). Aks holda
   * da'vosi tasdiqlangan ASSET_OWNER yoki CARRIER korxona o'z yo'liga na narx, na
   * rasm qo'ya olardi. Tur faqat yangi terminal ochish yo'lida talab qilinadi.
   */
  async assertObjectAdmin(userId: string, orgId: string) {
    const m = await this.orgs.findMembership(userId, orgId);
    if (!m || !(m.isOwner || m.roles.includes('TERMINAL_ADMIN') || m.roles.includes('ASSET_OWNER'))) {
      throw new ForbiddenException({ code: 'NOT_TERMINAL_ADMIN' });
    }
  }

  /**
   * Da'vo kimning nomidan ketadi: oddiy a'zolik yetarli emas, egasi yoki ASSET_OWNER kerak.
   * orgIdsOf ishlatilmaydi, chunki u hamma a'zolikni beradi va begona korxona nomidan
   * da'vo qilishga yo'l ochardi.
   */
  async firstClaimantOrgId(userId: string): Promise<string | null> {
    const ms = await this.orgs.listForUser(userId);
    return ms.find((m) => m.isOwner || m.roles.includes('ASSET_OWNER'))?.orgId ?? null;
  }

  async orgIdsOf(userId: string) {
    return (await this.orgs.listForUser(userId)).map((m) => m.orgId);
  }
}
