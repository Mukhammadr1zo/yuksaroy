// Javob shakllari: karta (ro'yxat), tafsilot (telefon faqat kirganlarga), egasi ko'rinishi (holat, ko'rishlar).
import { distanceKm } from '@yuksaroy/domain';
import type { GeoNear } from '../../catalog/domain/ports';
import { listingOwner, type ListingRecord } from '../domain/listing-query';

const round1 = (x: number) => Math.round(x * 10) / 10;

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
      ? { type: 'terminal' as const, id: l.terminal.id, name: l.terminal.name, slug: l.terminal.slug }
      : l.siding ? { type: 'siding' as const, id: l.siding.id, name: `${l.siding.station?.nameUz ?? l.siding.stationNameRaw} No ${l.siding.registryNo}` } : null,
    premium: l.premiumUntil !== null && l.premiumUntil > now,
    publishedAt: l.publishedAt,
  };
}

/**
 * E'lon ommaviy tijorat taklifi: telefon hammaga ochiq (egasi aynan qo'ng'iroqni kutadi).
 * Platforma orqali so'rov yuborish esa kirishni talab qiladi.
 */
export function listingDetail(l: ListingRecord) {
  return {
    ...listingCard(l), description: l.description, photos: l.photos, responseHours: l.responseHours,
    contactPhone: l.contactPhone, status: l.status, createdAt: l.createdAt,
  };
}

/** Kabinet va admin: tafsilot + orgId, ko'rishlar, rad sababi, muddat. */
export function ownerListing(l: ListingRecord) {
  return { ...listingDetail(l), orgId: l.orgId, ownerUserId: l.ownerUserId, views: l.views, rejectReason: l.rejectReason, expiresAt: l.expiresAt, updatedAt: l.updatedAt };
}
