// E'lon domeni: yozuv shakli va sof yordamchilar (slug, koridor, qaror qatori). Framework va Prisma yo'q.
import { LISTING_OWNER_LABELS, REGIONS, corridorRegions, distanceKm, type Condition, type DealKind, type KycStatus, type ListingKind, type ListingStatus, type PriceUnit, type RegionCode } from '@yuksaroy/domain';

export interface Route { from: RegionCode; to: RegionCode }

export interface ListingRecord {
  id: string; slug: string; orgId: string | null; ownerUserId: string | null; createdById: string; kind: ListingKind; deal: DealKind | null; status: ListingStatus;
  title: string; description: string | null; regionCode: string; terminalId: string | null;
  lat: number | null; lng: number | null; priceTiyin: number | null; priceUnit: PriceUnit | null; photos: string[];
  year: number | null; condition: Condition | null; model: string | null; qty: number; wagonType: string | null; capacityT: number | null;
  truckType: string | null; tonnage: number | null; fleetSize: number | null; serviceRegions: string[]; routes: Route[];
  contactPhone: string | null; responseHours: number | null;
  premiumUntil: Date | null; publishedAt: Date | null; expiresAt: Date | null; rejectReason: string | null; views: number;
  createdAt: Date; updatedAt: Date;
  org: { name: string; slug: string | null; kycStatus: KycStatus } | null;
  ownerUser: { fullName: string | null; phone: string | null } | null; // yakka haydovchi (orgId null)
  /** Bog'langan obyekt. Shahobcha ham shu yerda: u temir yo'l terminali (kind RAIL). */
  terminal: {
    id: string; name: string; slug: string; orgId: string | null;
    kind?: string; registryNo?: number | null; stationNameRaw?: string | null; station?: { nameUz: string } | null;
  } | null;
}

/** Ochiq egasi bloki: tashkilot (KYC) yoki yakka shaxs (telefon OTP orqali biriktirilgan = tasdiqlangan). */
export function listingOwner(l: Pick<ListingRecord, 'org' | 'ownerUser'>) {
  if (l.org) return { type: 'org' as const, name: l.org.name, slug: l.org.slug, kyc: l.org.kycStatus };
  return { type: 'person' as const, name: l.ownerUser?.fullName || LISTING_OWNER_LABELS.uz.person, phoneVerified: l.ownerUser?.phone != null };
}

/** `A>B` -> koridor viloyatlari (BFS yo'li). Noto'g'ri kod = filtr yo'q. */
export function parseCorridor(v: string | undefined): RegionCode[] | undefined {
  const [from, to] = (v ?? '').split('>').map((s) => s.trim()) as RegionCode[];
  if (!from || !to || from === to || !REGIONS.includes(from) || !REGIONS.includes(to)) return undefined;
  return corridorRegions(from, to);
}

/** Koridor mosligi: yo'nalishning ikkala uchi koridorda, yoki xizmat hududi / bazaviy viloyat koridor bilan kesishadi. */
export function corridorMatch(l: Pick<ListingRecord, 'regionCode' | 'serviceRegions' | 'routes'>, corridor: readonly string[]): boolean {
  if (l.routes.some((r) => corridor.includes(r.from) && corridor.includes(r.to))) return true;
  if (l.serviceRegions.some((r) => corridor.includes(r))) return true;
  return corridor.includes(l.regionCode);
}

/** base, base-2, base-3 ... band bo'lmagani topilguncha. */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Ro'yxat ustidagi qaror qatori: eng arzon (eng ko'p uchraydigan birlikda), narxsizlar soni, eng yaqini.
 * ponytail: birliklar aralash bo'lsa ko'pchilik birligi olinadi; birlikni tenglashtirish kerak bo'lsa keyin
 */
export function summarizeListings(all: Pick<ListingRecord, 'priceTiyin' | 'priceUnit' | 'lat' | 'lng'>[], near?: { lat: number; lng: number }) {
  const priced = all.filter((l): l is typeof l & { priceTiyin: number; priceUnit: PriceUnit } => l.priceTiyin != null && l.priceUnit != null);
  const count = new Map<PriceUnit, number>();
  for (const l of priced) count.set(l.priceUnit, (count.get(l.priceUnit) ?? 0) + 1);
  const unit = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const cheapest = unit ? Math.min(...priced.filter((l) => l.priceUnit === unit).map((l) => l.priceTiyin)) : null;
  const dists = near ? all.filter((l) => l.lat != null && l.lng != null).map((l) => distanceKm(near.lat, near.lng, l.lat!, l.lng!)) : [];
  return {
    cheapestTiyin: cheapest, cheapestUnit: unit,
    onRequest: all.length - priced.length,
    nearestKm: dists.length ? round1(Math.min(...dists)) : null,
  };
}
