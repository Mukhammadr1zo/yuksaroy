// Xizmatlar markazi (/v1/services/profiles) va bozor (/v1/market) javob shakllari.
import type { MarketBoard, MarketOfferStatus, MarketStatus, RegionCode, ServiceType, TruckType } from '@yuksaroy/domain';

export interface ServiceProfileCard {
  id: string; userId: string; orgId: string | null; serviceType: ServiceType; title: string; description: string; regions: RegionCode[];
  experienceYears: number | null; priceNote: string | null; hasPhone: boolean; status: 'ACTIVE' | 'HIDDEN'; isDemo: boolean; createdAt: string; updatedAt: string;
  owner: string | null; ownerOrg: { name: string; slug: string | null; kyc: string } | null;
  /** Faqat egasiga (GET mine) */
  contactPhone?: string | null;
}

export interface MarketOffer {
  id: string; requestId: string; providerUserId: string; providerOrgId: string | null; priceTiyin: number | null; message: string | null;
  status: MarketOfferStatus; createdAt: string;
  providerOrg?: { id: string; name: string; slug: string | null; kyc: string } | null; providerName?: string | null;
}

export interface MarketRequest {
  id: string; no: string; board: MarketBoard; serviceType: ServiceType | null; regionCode: RegionCode | null;
  fromRegion: RegionCode | null; toRegion: RegionCode | null; fromText: string | null; toText: string | null;
  cargoName: string | null; weightT: number | null; loadDate: string | null; truckType: TruckType | null;
  title: string; description: string; hasPhone: boolean; createdById: string; orgId: string | null;
  status: MarketStatus; awardedOfferId: string | null; isDemo: boolean; createdAt: string; updatedAt: string; offersCount: number;
  /** Faqat egasiga */
  contactPhone?: string | null; statusUrl?: string; offers?: MarketOffer[];
  /** Taklif bergan odamga o'z taklifi */
  myOffer?: MarketOffer | null;
}

export type Paged<T> = { items: T[]; total: number; page: number; limit: number };

/** GET /market/status/:token: narxsiz va telefonsiz ochiq holat. */
export interface MarketStatusPublic {
  no: string; board: MarketBoard; title: string; status: MarketStatus; serviceType: ServiceType | null; regionCode: RegionCode | null;
  fromRegion: RegionCode | null; toRegion: RegionCode | null; cargoName: string | null; weightT: number | null; loadDate: string | null;
  awarded: boolean; awardedProvider: { name: string; slug: string | null } | null; offers: number; isDemo: boolean; createdAt: string;
  timeline: { at: string; event: string }[];
}

/** 400 VALIDATION javobi: maydon -> xato kodi (market.err.*). */
export type FieldErrors = Record<string, string>;
