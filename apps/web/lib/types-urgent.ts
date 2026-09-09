// Shoshilinch so'rovlar (/v1/urgent) va do'kon (Organization.storefront) javob shakllari. lib/types.ts ga tegilmaydi.
import type { RegionCode, UrgentKind, UrgentOfferStatus, UrgentStatus } from '@yuksaroy/domain';
import type { CompanyDetail } from './types-listing';

export interface UrgentOffer {
  id: string; requestId: string; providerOrgId: string | null; providerUserId: string;
  priceTiyin: number | null; etaMinutes: number | null; message: string | null; status: UrgentOfferStatus; createdAt: string;
  /** Ijrochi nomi: API qaysi maydonda bersa ham o'qiladi (offerName). */
  providerName?: string | null; providerOrgName?: string | null; providerOrg?: { name: string } | null;
}
export interface UrgentRequest {
  id: string; no: string; kind: UrgentKind; regionCode: RegionCode; lat: number | null; lng: number | null;
  stationName: string | null; wagonCount: number | null; description: string; contactPhone: string;
  createdById: string; orgId: string | null; status: UrgentStatus; awardedOfferId: string | null; statusToken?: string | null; statusUrl?: string | null;
  createdAt: string; updatedAt: string;
  offers?: UrgentOffer[]; offersCount?: number; myOffer?: UrgentOffer | null;
}
/** GET /urgent/status/:token: narxsiz va telefonsiz ochiq holat. */
export interface UrgentStatusPublic {
  no: string; kind: UrgentKind; regionCode: RegionCode; status: UrgentStatus; stationName?: string | null; wagonCount?: number | null; offers?: number;
  /** API tashkilot obyektini beradi; eski shakl (satr) ham o'qiladi. */
  awardedProvider?: string | { name: string; slug?: string | null } | null;
  timeline: { at: string; event?: string; type?: string; status?: string }[];
}
export const offerName = (o: UrgentOffer): string | null => o.providerName ?? o.providerOrgName ?? o.providerOrg?.name ?? null;
/** Ro'yxat javobi massiv yoki { items } bo'lishi mumkin. */
export const asList = <T>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { items?: T[] } | null)?.items ?? []));

export type Storefront = {
  tagline?: string | null; about?: string | null; logoUrl?: string | null; coverUrl?: string | null;
  showListings?: boolean | null; showTerminals?: boolean | null; contactTelegram?: string | null; contactPhonePublic?: boolean | null;
};
export type CompanyStorefront = CompanyDetail & { storefront: Storefront | null };
