// E'lon, kompaniya va shahobcha yo'l javob shakllari (apps/api listings/mappers.ts va companies.controller.ts bilan bir xil).
import type { Condition, DealKind, KycStatus, ListingKind, ListingStatus, OrgKind, PriceUnit } from '@yuksaroy/domain';
import type { TerminalCard } from './types';

/** Egasi: tashkilot (KYC) yoki yakka haydovchi (telefon OTP orqali tasdiqlangan). */
export type ListingOwner =
  | { type: 'org'; name: string; slug: string | null; kyc: KycStatus }
  | { type: 'person'; name: string; phoneVerified: boolean };

export interface ListingCard {
  id: string; slug: string; kind: ListingKind; deal: DealKind | null; title: string; regionCode: string;
  year: number | null; condition: Condition | null; model: string | null; qty: number; wagonType: string | null; capacityT: number | null;
  truckType: string | null; tonnage: number | null; fleetSize: number | null; serviceRegions: string[]; routes: { from: string; to: string }[];
  priceTiyin: number | null; priceUnit: PriceUnit | null; photo: string | null; lat: number | null; lng: number | null; distanceKm: number | null;
  owner: ListingOwner;
  /** Eski taxallus: faqat tashkilot egasi uchun, shaxsiy e'londa null. */
  org: { name: string; slug: string | null; kyc: KycStatus } | null;
  object: { type: 'terminal' | 'siding'; id: string; name: string; slug?: string } | null;
  premium: boolean; publishedAt: string | null;
  /** E'lon sahifasi necha marta ochilgan (brauzer mayoqlaridan, umrbod). */
  views: number;
  /** O'rtacha baho: 3 tadan kam baho bo'lsa null (ratingCount qoladi). */
  ratingAvg: number | null; ratingCount: number;
  /** Namuna qator: haqiqiy taklif emas, "Namuna" yorlig'i bilan chiziladi, telefon va chat berilmaydi. */
  isDemo: boolean;
}
export interface ListingDetail extends ListingCard {
  description: string | null; photos: string[];
  /** Raqam ochiq javobda yo'q; hasPhone tugma ko'rsatish uchun, raqam obunachiga GET /contacts orqali. */
  hasPhone: boolean; status: ListingStatus; createdAt: string;
  /**
   * O'lchangan javob signali: faqat tafsilot javobida bo'ladi, kartada yo'q.
   * Ixtiyoriy (`?`) ataylab: veb va API alohida konteynerda turadi va api qo'lda
   * eski obrazga tushirilsa javob tanasida `signal` bo'lmaydi. Ixtiyoriy bo'lgani
   * uchun TypeScript o'qiydigan joyda `?.` ni majburlaydi: qator jim tushadi,
   * sahifa esa yiqilmaydi.
   */
  signal?: { seen: 'today' | 'week' | 'away' | null; replied: { of: number; answered: number } | null };
}
export interface ListingSummary { cheapestTiyin: number | null; cheapestUnit: PriceUnit | null; onRequest: number; nearestKm: number | null }
export interface ListingPage { items: ListingCard[]; total: number; page: number; limit: number; summary: ListingSummary }

export interface CompanyCard {
  id: string; slug: string | null; name: string; kinds: OrgKind[]; kyc: KycStatus; regionCode: string | null;
  counts: { terminals: number; listings: number };
  isDemo: boolean;
}
export interface CompanyDetail extends CompanyCard {
  description: string | null; telegram: string | null; website: string | null; hasPhone: boolean;
  terminals: TerminalCard[]; listings: ListingCard[];
}

