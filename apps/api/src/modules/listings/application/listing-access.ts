import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ListingKind, OrgKind, Role } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';

const RAIL: readonly Role[] & readonly OrgKind[] = ['ASSET_OWNER', 'LOCO_SERVICE'];
const ROAD: readonly Role[] & readonly OrgKind[] = ['CARRIER'];

/** E'lon yozish ruxsati: a'zolik + (egasi | mos rol | tashkilot turi mos). Middleware faqat cookie'ni tekshiradi, haqiqiy ruxsat shu yerda. */
@Injectable()
export class ListingAccess {
  constructor(private readonly prisma: PrismaService) {}

  membership(userId: string, orgId: string) {
    return this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { isOwner: true, roles: true, org: { select: { kind: true, kinds: true, kycStatus: true } } },
    });
  }

  /** Temir yo'l texnikasi: ASSET_OWNER/LOCO_SERVICE; avto: CARRIER. Egasi hamma turni bera oladi. */
  async assertLister(userId: string, orgId: string, kind: ListingKind) {
    const m = await this.membership(userId, orgId);
    const allowed: readonly string[] = kind === 'TRUCK' ? ROAD : RAIL;
    const orgKinds: string[] = m ? [m.org.kind, ...m.org.kinds] : [];
    if (!m || !(m.isOwner || m.roles.some((r) => allowed.includes(r)) || orgKinds.some((k) => allowed.includes(k)))) {
      throw new ForbiddenException({ code: 'NOT_LISTER', kind });
    }
    return m;
  }

  async orgIdsOf(userId: string) {
    return (await this.prisma.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
  }
}
