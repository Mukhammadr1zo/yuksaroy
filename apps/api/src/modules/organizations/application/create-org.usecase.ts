import { ConflictException, Inject, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { orgSlug, type OrgKind, type Role } from '@yuksaroy/domain';
import { ORG_REPOSITORY, type OrgPatch, type OrganizationRepository } from '../domain/ports';
import { filterRoles, rolesForKinds } from '../domain/rules';

export interface CreateOrgInput {
  kind?: OrgKind; kinds?: OrgKind[]; name: string; stir?: string; phone?: string; roles?: Role[];
  description?: string; telegram?: string; website?: string; regionCode?: string;
}
export type UpdateOrgInput = Partial<Pick<CreateOrgInput, 'name' | 'kinds' | 'description' | 'telegram' | 'website' | 'phone' | 'stir' | 'regionCode'>> & { address?: string };

@Injectable()
export class CreateOrgUseCase {
  constructor(@Inject(ORG_REPOSITORY) private readonly orgs: OrganizationRepository) {}

  async execute(ownerUserId: string, input: CreateOrgInput) {
    // Eski mijozlar `kind` yuboradi, yangilari `kinds`; PLATFORM turini o'zi ochib bo'lmaydi
    const kinds = this.kinds(input.kinds?.length ? input.kinds : input.kind ? [input.kind] : []);
    const stir = await this.stir(input.stir);
    const roles = filterRoles(input.roles, kinds);
    if (!roles.length) throw new BadRequestException({ code: 'ROLES_NOT_ALLOWED', allowed: rolesForKinds(kinds) });
    const name = input.name.trim();
    const base = {
      kind: kinds[0]!, kinds, name, stir, phone: input.phone ?? null,
      description: input.description ?? null, telegram: input.telegram ?? null, website: input.website ?? null, regionCode: input.regionCode ?? null,
    };
    // Bir xil nomli ikki tashkilot bir vaqtda ochilsa uniqueSlug ikkalasiga bir xil slug beradi:
    // Prisma P2002 da bir marta tasodifiy qo'shimcha bilan qayta uriniladi
    try {
      return await this.orgs.create({ ...base, slug: await this.uniqueSlug(name) }, ownerUserId, roles);
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const suffix = Math.random().toString(36).slice(2, 6);
      return this.orgs.create({ ...base, slug: `${orgSlug(name)}-${suffix}` }, ownerUserId, roles);
    }
  }

  /** Egasi tahrirlaydi; slug o'zgarmaydi (havolalar buzilmasin). */
  async update(userId: string, orgId: string, input: UpdateOrgInput) {
    const m = await this.orgs.findMembership(userId, orgId);
    if (!m?.isOwner) throw new ForbiddenException({ code: 'NOT_OWNER' });
    const patch: OrgPatch = { ...input, name: input.name?.trim() };
    if (input.kinds) { patch.kinds = this.kinds(input.kinds); patch.kind = patch.kinds[0]; }
    if (input.stir !== undefined) {
      const stir = await this.stir(input.stir, orgId);
      patch.stir = stir;
      // STIR o'zgarsa tasdiq qaytadan: VERIFIED holat eski raqamga tegishli edi
      if (stir !== m.org.stir && m.org.kycStatus === 'VERIFIED') patch.kycStatus = 'NONE';
    }
    return this.orgs.update(orgId, patch);
  }

  private kinds(kinds: OrgKind[]): OrgKind[] {
    const uniq = [...new Set(kinds)];
    if (!uniq.length) throw new BadRequestException({ code: 'KIND_REQUIRED' });
    if (uniq.includes('PLATFORM')) throw new BadRequestException({ code: 'KIND_NOT_ALLOWED' });
    return uniq;
  }

  private async stir(raw: string | undefined, selfId?: string): Promise<string | null> {
    const stir = raw?.replace(/\D/g, '') || null;
    if (!stir) return null;
    if (stir.length !== 9) throw new BadRequestException({ code: 'INVALID_STIR' });
    const other = await this.orgs.findByStir(stir);
    if (other && other.id !== selfId) throw new ConflictException({ code: 'STIR_TAKEN' });
    return stir;
  }

  private async uniqueSlug(name: string) {
    const base = orgSlug(name);
    let slug = base;
    for (let i = 2; await this.orgs.slugExists(slug); i++) slug = `${base}-${i}`;
    return slug;
  }
}
