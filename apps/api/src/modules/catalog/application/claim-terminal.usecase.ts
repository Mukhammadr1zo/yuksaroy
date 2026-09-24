import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { CreateOrgUseCase } from '../../organizations/application/create-org.usecase';
import { CATALOG_REPOSITORY, TerminalClaimedError, type CatalogRepository, type ClaimEvidence, type TerminalRecord } from '../domain/ports';
import { TerminalAccess } from './terminal-access';

/** Katalogdagi egasiz obyektni tashkilot "meniki" deydi -> PENDING; operator tasdiqlaydi, shundan keyin egasi nomi ochiq. */
@Injectable()
export class ClaimTerminalUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
    private readonly access: TerminalAccess,
    private readonly createOrg: CreateOrgUseCase,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ikki xil qoida, chunki obyekt katalogga ikki xil yo'l bilan tushgan.
   *
   * Temir yo'l qatori (kind RAIL) katalogga egasidan OLDIN tushadi va uning egasi
   * har qanday korxona bo'lishi mumkin: zavod, ombor, tashuvchi. Shuning uchun u
   * yerda tashkilot turi so'ralmaydi, tashkilot berilmasa mosi olinadi, u ham
   * bo'lmasa ochiladi. Qolgan terminalni esa faqat TERMINAL turidagi tashkilot
   * ocha olgan, ya'ni egasiz qolgan qatorni ham shunday tashkilot qaytarib oladi.
   *
   * Tashkilot ENG OXIRIDA ochiladi: yuqoridagi tekshiruvlardan biri rad etsa bo'sh
   * tashkilot qolib ketmasin.
   *
   * Poyga: bitta obyektga bir vaqtda ikki da'vo kelsa biriga bo'sh tashkilot qolib
   * ketadi. Yo'lning o'zi xavfsiz, shart UPDATE ning ichida.
   */
  async execute(
    userId: string,
    terminalId: string,
    orgId: string | undefined,
    evidence: ClaimEvidence,
  ): Promise<{ terminal: TerminalRecord; orgId: string }> {
    const t = await this.repo.findTerminalById(terminalId, new Date());
    if (!t) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    let org = orgId?.trim() || null;
    if (t.kind === 'RAIL') {
      if (org) await this.access.assertClaimant(userId, org);
      else org = await this.access.firstClaimantOrgId(userId);
      if (!org) org = await this.newOrg(userId);
    } else {
      // Bu yo'lda obyekt katalogda o'zi ochilgan, shuning uchun tashkilot majburiy
      if (!org) throw new BadRequestException({ code: 'ORG_REQUIRED' });
      await this.access.assertTerminalAdmin(userId, org);
    }
    try {
      return { terminal: await this.repo.claimTerminal(terminalId, org, evidence), orgId: org };
    } catch (e) {
      if (e instanceof TerminalClaimedError) throw new ConflictException({ code: e.message });
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
