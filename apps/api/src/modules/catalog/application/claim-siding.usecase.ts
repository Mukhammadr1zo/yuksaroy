import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { CreateOrgUseCase } from '../../organizations/application/create-org.usecase';
import { CATALOG_REPOSITORY, SidingClaimedError, type CatalogRepository, type ClaimEvidence, type SidingRecord } from '../domain/ports';
import { TerminalAccess } from './terminal-access';

/** Reestrdagi temir yo'l terminalini tashkilot "meniki" deydi -> PENDING; operator tasdiqlaydi, shundan keyin egasi nomi ochiq. */
@Injectable()
export class ClaimSidingUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
    private readonly access: TerminalAccess,
    private readonly createOrg: CreateOrgUseCase,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Tashkilot ixtiyoriy: o'z obyektini topgan odam uni bir bosishda da'vo qilsin.
   *
   * Berilgan bo'lsa ruxsat tekshiriladi; berilmasa odamning mos tashkiloti olinadi
   * (oddiy a'zolik yetarli emas), u ham bo'lmasa yangisi ochiladi. Tashkilot ENG
   * OXIRIDA ochiladi: yuqoridagi tekshiruvlardan biri rad etsa bo'sh tashkilot
   * qolib ketmasin.
   *
   * Poyga: bitta yo'lga bir vaqtda ikki da'vo kelsa biriga bo'sh tashkilot qolib
   * ketadi. Yo'lning o'zi xavfsiz, shart UPDATE ning ichida.
   */
  async execute(userId: string, sidingId: string, orgId: string | undefined, evidence: ClaimEvidence): Promise<{ siding: SidingRecord; orgId: string }> {
    let org = orgId?.trim() || null;
    if (org) await this.access.assertSidingClaimant(userId, org);
    else org = await this.access.firstClaimantOrgId(userId);
    if (!(await this.repo.findSidingById(sidingId))) throw new NotFoundException({ code: 'SIDING_NOT_FOUND' });
    if (!org) org = await this.newOrg(userId);
    try {
      return { siding: await this.repo.claimSiding(sidingId, org, new Date(), evidence), orgId: org };
    } catch (e) {
      if (e instanceof SidingClaimedError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }

  /**
   * O'z obyektini topgan odamning birinchi tashkiloti: turi ASSET_OWNER, chunki hali
   * hech narsa tasdiqlanmagan. STIR keyin, hujjat so'ralganda kiritiladi; nomini odam
   * kabinetda o'zgartiradi.
   */
  private async newOrg(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
    const name = u?.fullName?.trim() || (u?.phone ? `Korxona ${u.phone.slice(-4)}` : 'Korxona');
    return (await this.createOrg.execute(userId, { kinds: ['ASSET_OWNER'], name, roles: ['ASSET_OWNER'] })).id;
  }
}
