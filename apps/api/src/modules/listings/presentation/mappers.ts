// Javob shakllari: karta (ro'yxat), tafsilot (telefon faqat kirganlarga), egasi ko'rinishi (holat, ko'rishlar).
import { distanceKm } from '@yuksaroy/domain';
import type { GeoNear } from '../../catalog/domain/ports';
import { listingOwner, type ListingRecord } from '../domain/listing-query';

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Shahobcha yorlig'i: Taminotdan kelgan qatorda o'z nomi bor, eski reestr qatorida esa
 * faqat raqami. Ikkalasi ham bo'lmasa stansiya nomi qoladi.
 */
const sidingLabel = (s: NonNullable<ListingRecord['terminal']>) => {
  const station = s.station?.nameUz ?? s.stationNameRaw ?? s.name;
  if (s.name) return `${station} · ${s.name}`;
  return s.registryNo === null ? station : `${station} No ${s.registryNo}`;
};

export function listingCard(l: ListingRecord, near?: GeoNear, now = new Date()) {
  return {
    id: l.id, slug: l.slug, kind: l.kind, deal: l.deal, title: l.title, regionCode: l.regionCode,
    year: l.year, condition: l.condition, model: l.model, qty: l.qty, wagonType: l.wagonType, capacityT: l.capacityT,
    truckType: l.truckType, tonnage: l.tonnage, fleetSize: l.fleetSize, serviceRegions: l.serviceRegions, routes: l.routes,
    priceTiyin: l.priceTiyin, priceUnit: l.priceUnit, photo: l.photos[0] ?? null, lat: l.lat, lng: l.lng,
    distanceKm: near && l.lat != null && l.lng != null ? round1(distanceKm(near.lat, near.lng, l.lat, l.lng)) : null,
    owner: listingOwner(l),
    org: l.org ? { name: l.org.name, slug: l.org.slug, kyc: l.org.kycStatus } : null, // eski mijozlar uchun taxallus; shaxsiy e'londa null
    object: l.terminal && l.terminal.orgId !== null
      // Shahobcha ham terminal: turini kind ajratadi, shunda UI eski shakl bilan ishlayveradi
      ? l.terminal.kind === 'RAIL'
        ? { type: 'siding' as const, id: l.terminal.id, name: sidingLabel(l.terminal), slug: l.terminal.slug }
        : { type: 'terminal' as const, id: l.terminal.id, name: l.terminal.name, slug: l.terminal.slug }
      : null,
    premium: l.premiumUntil !== null && l.premiumUntil > now,
    publishedAt: l.publishedAt,
  };
}

/**
 * Ochiq tafsilot. Telefon raqamining o'zi bu yerda yo'q: u obunachiga, bosilganda,
 * GET /contacts/listing/:id orqali beriladi (kunlik chegara va audit bilan).
 * Ilgari raqam hammaga ochiq edi va narx sahifasidagi va'daga zid edi.
 * `hasPhone` tugmani ko'rsatish yoki ko'rsatmaslik uchun.
 */
export function listingDetail(l: ListingRecord) {
  return {
    ...listingCard(l), description: l.description, photos: l.photos, responseHours: l.responseHours,
    hasPhone: !!l.contactPhone?.trim(), status: l.status, createdAt: l.createdAt,
  };
}

/** Kabinet va admin: tafsilot + orgId, ko'rishlar, rad sababi, muddat. Egasi o'z raqamini ko'radi. */
export function ownerListing(l: ListingRecord) {
  // premiumUntil: admin ro'yxatida "qachongacha" ko'rinishi kerak, faqat ha/yo'q emas
  return { ...listingDetail(l), contactPhone: l.contactPhone, orgId: l.orgId, ownerUserId: l.ownerUserId, views: l.views, rejectReason: l.rejectReason, expiresAt: l.expiresAt, updatedAt: l.updatedAt, premiumUntil: l.premiumUntil };
}
