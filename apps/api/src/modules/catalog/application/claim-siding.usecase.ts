import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CATALOG_REPOSITORY, SidingClaimedError, type CatalogRepository, type ClaimEvidence } from '../domain/ports';
import { TerminalAccess } from './terminal-access';

/** Reestrdagi shahobchani tashkilot «meniki» deydi → PENDING; operator tasdiqlaydi (admin navbati S7), shundan keyin egasi nomi ochiq. */
@Injectable()
export class ClaimSidingUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository, private readonly access: TerminalAccess) {}

  async execute(userId: string, sidingId: string, orgId: string, evidence: ClaimEvidence) {
    await this.access.assertSidingClaimant(userId, orgId);
    if (!(await this.repo.findSidingById(sidingId))) throw new NotFoundException({ code: 'SIDING_NOT_FOUND' });
    try {
      return await this.repo.claimSiding(sidingId, orgId, new Date(), evidence);
    } catch (e) {
      if (e instanceof SidingClaimedError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }
}
