// Kabinet uchun API javob shakllari (listings ownerListing, orgs OrgRecord, inquiries, sidings/mine). lib/types.ts ga tegilmaydi.
import type { ClaimStatus, Condition, DealKind, KycStatus, ListingKind, ListingStatus, OrgKind, PriceUnit, RegionCode, Role, Rju, ServiceCode, TerminalKind, TerminalStatus } from '@yuksaroy/domain';

import type { Passport, Station, Tariff, WeekHours } from './types';
import type { ListingOwner } from './types-listing';
import type { Storefront } from './types-urgent';

export type { Me } from './types-auth';

export interface OrgRecord {
  id: string; kind: OrgKind; kinds: OrgKind[]; slug: string | null; name: string; stir: string | null; kycStatus: KycStatus;
  kycRequestedAt: string | null; kycNote: string | null;
  /** Tasdiqqa yuborilgan hujjatlar: faqat moderatsiya navbati javobida bo'ladi. */
  kycDocs?: ClaimFile[] | null;
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
  /** Premium muddati (admin ro'yxati uchun); premium bayrog'i shundan hisoblanadi. */
  premiumUntil?: string | null;
  /** Eski nom, shaxsiy e'londa null. */
  org: { name: string; slug: string | null; kyc: KycStatus } | null;
  object: { type: 'terminal' | 'siding'; id: string; name: string; slug?: string } | null;
  premium: boolean; publishedAt: string | null; description: string | null; contactPhone: string | null;
  status: ListingStatus; createdAt: string; orgId: string | null; ownerUserId: string | null; views: number; isDemo: boolean; rejectReason: string | null; expiresAt: string | null; updatedAt: string;
  warnings?: { field: string; code: string }[];
}

/** Yozishma mavzusi: e'lon yoki terminal. `sub` e'londa turi, terminalda TerminalKind. */
export interface InquirySubject { kind: 'listing' | 'terminal'; id: string; slug: string; title: string; sub: string | null }

export interface Inquiry {
  id: string; subject: InquirySubject | null;
  fromOrgName: string | null; message: string; status: string; createdAt: string;
  lastMessageAt: string | null; unread: number;
}

/** GET /sidings/mine (repo yozuvi, xaritalanmagan). */
export interface MySiding {
  /** Ochiq sahifasining manzili: shahobcha ham terminal. */
  slug: string;
  id: string; registryNo: number | null; regionCode: string | null; station: { id: string; esrCode: string | null; nameUz: string; rju: Rju } | null;
  /** Shahobchaning o'z nomi (reestrdan); eski qatorlarda bo'lmasligi mumkin. */
  name?: string | null;
  stationNameRaw: string; ownerNameRaw: string; ownerOrgId: string | null; ownerOrgName: string | null;
  claimStatus: ClaimStatus; claimedAt: string | null; lengthM: number | null; unloadCapacity: number; loadCapacity: number;
  photos: string[];
}

/** GET /terminals/mine: repo yozuvi (TerminalRecord, sanalar ISO satr) + bugungi bo'sh slotlar. Tariflar faqat amaldagi. */
/** Yuklangan fayl: POST /uploads javobi. */
export type ClaimFile = { url: string; name: string; size: number; mime: string };

export interface MyTerminal {
  id: string; name: string; slug: string; status: TerminalStatus; kind: TerminalKind; orgId: string | null; orgName: string | null;
  /** Reestrdan kelgan shahobchada stansiya bog'lanmagan bo'lishi mumkin. */
  regionCode: string | null; stationId: string | null; station: Station | null;
  /**
   * Temir yo'l pasporti (kind RAIL da). Bu xaritalanmagan repo yozuvi, ya'ni egasining
   * o'z obyekti: mas'ul shaxs raqami ham shu yerda (ochiq katalogdan farqli).
   */
  rail?: { stationNameRaw: string | null; registryNo: number | null; lengthM: number | null; ownerNameRaw: string | null; contactName: string | null; contactPhone: string | null } | null; description: string | null; address: string | null; phone: string | null;
  lat: number | null; lng: number | null; is24h: boolean; hours: WeekHours | null; passport: Passport | null; photos: string[];
  claimedAt: string | null; claimStatus: ClaimStatus; claimOrgId: string | null;
  /** Da'vo dalili: faqat egasi va admin javobida bo'ladi, ochiq katalogda yo'q. */
  claimEvidence?: { note: string; files: ClaimFile[] } | null;
  services: { serviceCode: ServiceCode; isEnabled: boolean; leadTimeMin: number }[]; tariffs: Tariff[]; freeToday?: number;
}
/** GET /admin/terminals: da'vogar tashkilot nomi bilan. */
export type AdminTerminal = MyTerminal & { claimOrgName: string | null };

/** E'lon sahifasi: temir yo'l /equipment, avto /carriers. */
export const listingHref = (l: { kind: ListingKind; slug: string }) => `/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}`;
