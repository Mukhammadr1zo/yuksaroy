// Kabinet uchun API javob shakllari (listings ownerListing, orgs OrgRecord, inquiries, sidings/mine). lib/types.ts ga tegilmaydi.
import type { ClaimStatus, Condition, DealKind, KycStatus, ListingKind, ListingStatus, OrgKind, PriceUnit, RegionCode, Role, Rju, ServiceCode, TerminalKind, TerminalStatus } from '@yuksaroy/domain';

import type { Passport, Station, Tariff, WeekHours } from './types';
import type { ListingOwner } from './types-listing';
import type { Storefront } from './types-urgent';

export type { Me } from './types-auth';

export interface OrgRecord {
  id: string; kind: OrgKind; kinds: OrgKind[]; slug: string | null; name: string; stir: string | null; kycStatus: KycStatus;
  kycRequestedAt: string | null; kycNote: string | null;
  description: string | null; telegram: string | null; website: string | null;
  phone: string | null; address: string | null; regionCode: string | null;
  storefront?: Storefront | null;
}
export interface Membership { orgId: string; userId: string; roles: Role[]; isOwner: boolean; org: OrgRecord }

/** GET /listings/mine, POST/PATCH /listings, admin ro'yxati: tafsilot + egasi maydonlari. */
export interface OwnerListing {
  id: string; slug: string; kind: ListingKind; deal: DealKind | null; title: string; regionCode: RegionCode;
  year: number | null; condition: Condition | null; model: string | null; qty: number; wagonType: string | null; capacityT: number | null;
  truckType: string | null; tonnage: number | null; fleetSize: number | null; serviceRegions: RegionCode[]; routes: { from: RegionCode; to: RegionCode }[] | null;
  priceTiyin: number | null; priceUnit: PriceUnit | null; photo: string | null; photos: string[]; lat: number | null; lng: number | null;
  owner: ListingOwner;
  /** Eski nom, shaxsiy e'londa null. */
  org: { name: string; slug: string | null; kyc: KycStatus } | null;
  object: { type: 'terminal' | 'siding'; id: string; name: string; slug?: string } | null;
  premium: boolean; publishedAt: string | null; description: string | null; responseHours: number | null; contactPhone: string | null;
  status: ListingStatus; createdAt: string; orgId: string | null; ownerUserId: string | null; views: number; rejectReason: string | null; expiresAt: string | null; updatedAt: string;
  warnings?: { field: string; code: string }[];
}

export interface Inquiry {
  id: string; listingId: string; listing: { id: string; slug: string; title: string; kind: ListingKind };
  fromOrgId: string | null; fromOrgName: string | null; fromUserId: string; message: string; status: string; createdAt: string;
}

/** GET /sidings/mine va /admin/sidings (repo yozuvi, xaritalanmagan). */
export interface MySiding {
  id: string; registryNo: number; regionCode: string | null; station: { id: string; esrCode: string | null; nameUz: string; rju: Rju } | null;
  stationNameRaw: string; ownerNameRaw: string; ownerOrgId: string | null; ownerOrgName: string | null;
  claimStatus: ClaimStatus; claimedAt: string | null; lengthM: number | null; unloadCapacity: number; loadCapacity: number;
}

/** GET /terminals/mine: repo yozuvi (TerminalRecord, sanalar ISO satr) + bugungi bo'sh slotlar. Tariflar faqat amaldagi. */
export interface MyTerminal {
  id: string; name: string; slug: string; status: TerminalStatus; kind: TerminalKind; orgId: string | null; orgName: string | null;
  regionCode: string | null; stationId: string; station: Station; description: string | null; address: string | null; phone: string | null;
  lat: number | null; lng: number | null; is24h: boolean; hours: WeekHours | null; passport: Passport | null; photos: string[];
  claimedAt: string | null; claimStatus: ClaimStatus; claimOrgId: string | null;
  services: { serviceCode: ServiceCode; isEnabled: boolean; leadTimeMin: number }[]; tariffs: Tariff[]; freeToday?: number;
}
/** GET /admin/terminals: da'vogar tashkilot nomi bilan. */
export type AdminTerminal = MyTerminal & { claimOrgName: string | null };

/** E'lon sahifasi: temir yo'l /equipment, avto /carriers. */
export const listingHref = (l: { kind: ListingKind; slug: string }) => `/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}`;
