import { Injectable } from '@nestjs/common';
import type { KycStatus, Role } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import type { MembershipRecord, OrgPatch, OrgRecord, OrgWrite, OrganizationRepository } from '../domain/ports';

const orgSelect = {
  id: true, kind: true, kinds: true, slug: true, name: true, stir: true, kycStatus: true, kycRequestedAt: true, kycNote: true,
  description: true, telegram: true, website: true, phone: true, address: true, regionCode: true, storefront: true,
} as const;
const memberSelect = { orgId: true, userId: true, roles: true, isOwner: true, org: { select: orgSelect } } as const;

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: OrgWrite, ownerUserId: string, roles: Role[]): Promise<OrgRecord> {
    return this.prisma.organization.create({
      data: { ...data, members: { create: { userId: ownerUserId, roles, isOwner: true } } },
      select: orgSelect,
    }) as Promise<OrgRecord>;
  }
  update(id: string, data: OrgPatch) {
    return this.prisma.organization.update({ where: { id }, data, select: orgSelect }) as Promise<OrgRecord>;
  }
  findById(id: string) {
    return this.prisma.organization.findUnique({ where: { id }, select: orgSelect }) as Promise<OrgRecord | null>;
  }
  findByStir(stir: string) {
    return this.prisma.organization.findUnique({ where: { stir }, select: orgSelect }) as Promise<OrgRecord | null>;
  }
  async slugExists(slug: string) { return (await this.prisma.organization.count({ where: { slug } })) > 0; }
  listForUser(userId: string) {
    return this.prisma.membership.findMany({ where: { userId }, select: memberSelect }) as Promise<MembershipRecord[]>;
  }
  findMembership(userId: string, orgId: string) {
    return this.prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } }, select: memberSelect }) as Promise<MembershipRecord | null>;
  }
  async addMemberByPhone(orgId: string, phone: string, roles: Role[]) {
    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {}, select: { id: true } });
    await this.prisma.membership.upsert({ where: { userId_orgId: { userId: user.id, orgId } }, create: { userId: user.id, orgId, roles }, update: { roles } });
    return { userId: user.id };
  }
  listByKyc(kycStatus: KycStatus) {
    // kycDocs faqat shu yerda: qaror shu navbatda beriladi. orgSelect ga qo'shilsa hujjat
    // manzillari /orgs/mine orqali ochiq sahifadagi har bir kirgan odamga tushib ketardi.
    return this.prisma.organization.findMany({ where: { kycStatus }, select: { ...orgSelect, kycDocs: true }, orderBy: [{ kycRequestedAt: 'asc' }, { createdAt: 'asc' }], take: 200 }) as Promise<OrgRecord[]>;
  }
}
