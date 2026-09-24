import type { Attachment } from '../../../common/attachments';
import type { KycStatus, OrgKind, Role } from '@yuksaroy/domain';

/** /k/[slug] do'kon sozlamalari (Organization.storefront Json). Type alias: Prisma InputJsonValue ga mos. */
export type Storefront = {
  tagline?: string | null; about?: string | null; logoUrl?: string | null; coverUrl?: string | null;
  showListings?: boolean | null; showTerminals?: boolean | null; contactTelegram?: string | null; contactPhonePublic?: boolean | null;
};

export interface OrgRecord {
  id: string; kind: OrgKind; kinds: OrgKind[]; slug: string | null; name: string; stir: string | null; kycStatus: KycStatus;
  kycRequestedAt: Date | null; kycNote: string | null;
  /** Tasdiqlash hujjatlari: faqat moderatsiya navbati so'rovi tanlaydi, boshqa joyda bo'sh. */
  kycDocs?: Attachment[] | null;
  description: string | null; telegram: string | null; website: string | null;
  phone: string | null; address: string | null; regionCode: string | null;
  storefront: Storefront | null;
}
export interface MembershipRecord { orgId: string; userId: string; roles: Role[]; isOwner: boolean; org: OrgRecord }

export interface OrgWrite {
  kind: OrgKind; kinds: OrgKind[]; slug: string; name: string; stir: string | null; phone: string | null;
  description?: string | null; telegram?: string | null; website?: string | null; regionCode?: string | null; address?: string | null;
}
export type OrgPatch = Partial<Omit<OrgWrite, 'slug'> & { kycStatus: KycStatus; kycRequestedAt: Date | null; kycNote: string | null; kycDocs: Attachment[]; storefront: Storefront }>;

export interface OrganizationRepository {
  create(data: OrgWrite, ownerUserId: string, roles: Role[]): Promise<OrgRecord>;
  update(id: string, data: OrgPatch): Promise<OrgRecord>;
  findById(id: string): Promise<OrgRecord | null>;
  findByStir(stir: string): Promise<OrgRecord | null>;
  slugExists(slug: string): Promise<boolean>;
  listForUser(userId: string): Promise<MembershipRecord[]>;
  findMembership(userId: string, orgId: string): Promise<MembershipRecord | null>;
  addMemberByPhone(orgId: string, phone: string, roles: Role[]): Promise<{ userId: string }>;
  /** Admin navbati: KYC holati bo'yicha, eski so'rov birinchi. */
  listByKyc(kycStatus: KycStatus): Promise<OrgRecord[]>;
}
export const ORG_REPOSITORY = Symbol('OrganizationRepository');
