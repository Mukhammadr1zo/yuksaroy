import { describe, expect, it } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClaimSidingUseCase } from './claim-siding.usecase';
import { SidingClaimedError } from '../domain/ports';
import type { PrismaService } from '../../../common/prisma.service';

/**
 * Bir qadamli da'vo: o'z obyektini topgan odam tashkilot ochib o'tirmasin.
 * Bu yerdagi qoida ikkita: begona tashkilot nomidan da'vo ketmasin va
 * tekshiruv rad etsa bo'sh tashkilot qolib ketmasin.
 */
const EV = { note: 'guvohnoma bizda', files: [] };

function make(o: { memberships?: { orgId: string; isOwner: boolean; roles: string[] }[]; found?: boolean; claimThrows?: boolean }) {
  const created: unknown[][] = [];
  const claimed: string[] = [];
  const orgs = {
    listForUser: async () => o.memberships ?? [],
    findMembership: async (_u: string, orgId: string) => (o.memberships ?? []).find((m) => m.orgId === orgId) ?? null,
  } as never;
  const access = new (class {
    async assertSidingClaimant(userId: string, orgId: string) {
      const m = (o.memberships ?? []).find((x) => x.orgId === orgId);
      if (!m || !(m.isOwner || m.roles.includes('ASSET_OWNER'))) throw new ForbiddenException({ code: 'NOT_ORG_OWNER' });
    }
    async firstClaimantOrgId() {
      return (o.memberships ?? []).find((m) => m.isOwner || m.roles.includes('ASSET_OWNER'))?.orgId ?? null;
    }
  })() as never;
  const repo = {
    findSidingById: async () => (o.found === false ? null : { id: 's1' }),
    claimSiding: async (id: string, orgId: string) => {
      if (o.claimThrows) throw new SidingClaimedError();
      claimed.push(orgId);
      return { id, name: 'Yo\'l' };
    },
  } as never;
  const createOrg = { execute: async (...a: unknown[]) => { created.push(a); return { id: 'new-org' }; } } as never;
  const prisma = { user: { findUnique: async () => ({ fullName: 'Ahmad Karimov', phone: '+998901234567' }) } } as unknown as PrismaService;
  void orgs;
  return { uc: new ClaimSidingUseCase(repo, access, createOrg, prisma), created, claimed };
}

describe('bir qadamli da\'vo', () => {
  it('tashkiloti yo\'q odamga tashkilot ochiladi va da\'vo shundan ketadi', async () => {
    const f = make({});
    const r = await f.uc.execute('u1', 's1', undefined, EV);
    expect(f.created).toHaveLength(1);
    expect(f.created[0][1]).toMatchObject({ kinds: ['ASSET_OWNER'], roles: ['ASSET_OWNER'], name: 'Ahmad Karimov' });
    expect(f.claimed).toEqual(['new-org']);
    expect(r.orgId).toBe('new-org');
  });

  it('mos tashkiloti bor odamga yangisi ochilmaydi', async () => {
    const f = make({ memberships: [{ orgId: 'o1', isOwner: true, roles: [] }] });
    const r = await f.uc.execute('u1', 's1', undefined, EV);
    expect(f.created).toHaveLength(0);
    expect(r.orgId).toBe('o1');
  });

  it('oddiy a\'zolik yetarli emas: o\'sha tashkilot nomidan da\'vo ketmaydi', async () => {
    const f = make({ memberships: [{ orgId: 'o1', isOwner: false, roles: ['CLIENT'] }] });
    const r = await f.uc.execute('u1', 's1', undefined, EV);
    expect(r.orgId).toBe('new-org');
    expect(f.claimed).toEqual(['new-org']);
  });

  it('begona tashkilot berilsa rad etiladi va tashkilot ochilmaydi', async () => {
    const f = make({ memberships: [] });
    await expect(f.uc.execute('u1', 's1', 'begona', EV)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.created).toHaveLength(0);
  });

  it('obyekt topilmasa bo\'sh tashkilot qolib ketmaydi', async () => {
    const f = make({ found: false });
    await expect(f.uc.execute('u1', 's1', undefined, EV)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.created).toHaveLength(0);
  });

  it('allaqachon da\'vo qilingan bo\'lsa qaytariladi', async () => {
    const f = make({ memberships: [{ orgId: 'o1', isOwner: true, roles: [] }], claimThrows: true });
    await expect(f.uc.execute('u1', 's1', 'o1', EV)).rejects.toBeInstanceOf(ConflictException);
  });
});
