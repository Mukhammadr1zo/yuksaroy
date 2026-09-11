// Ommaviy (login'siz) javob shakllari. Egasi nomi va ichki maydonlar shu yerda yashiriladi.
import { distanceKm, ratingDisplay, type ServiceCode } from '@yuksaroy/domain';
import type { GeoNear, SidingRecord, TariffRecord, TerminalRecord } from '../domain/ports';

const round1 = (x: number) => Math.round(x * 10) / 10;

export function publicTariff(t: TariffRecord) {
  return { id: t.id, serviceCode: t.serviceCode, cargoGroupCode: t.cargoGroupCode, priceTiyin: t.priceTiyin, unit: t.unit, minTiyin: t.minTiyin, validFrom: t.validFrom, validTo: t.validTo, version: t.version, note: t.note };
}

/** Kartadagi «... so'mdan/t»: LOAD/UNLOAD tariflari ichida eng arzon tonna narxi (umumiy yuk guruhi). */
export function fromPriceTiyin(t: TerminalRecord): number | null {
  const per = t.tariffs.filter((x) => (x.serviceCode === 'LOAD' || x.serviceCode === 'UNLOAD') && x.unit === 'PER_TON' && x.cargoGroupCode === null);
  return per.length ? Math.min(...per.map((x) => x.priceTiyin)) : null;
}

/** Karta uchun umumiy (yuk guruhisiz) amaldagi tariflar, ko'pi bilan 6 ta. */
export function cardTariffs(t: TerminalRecord) {
  return t.tariffs.filter((x) => x.cargoGroupCode === null).slice(0, 6).map((x) => ({ serviceCode: x.serviceCode, priceTiyin: x.priceTiyin, unit: x.unit, minTiyin: x.minTiyin }));
}

export function publicTerminalCard(t: TerminalRecord, freeToday = 0, near?: GeoNear) {
  return {
    id: t.id, slug: t.slug, name: t.name, kind: t.kind, status: t.status,
    station: { esrCode: t.station.esrCode, nameUz: t.station.nameUz, rju: t.station.rju },
    regionCode: t.regionCode,
    address: t.address, lat: t.lat, lng: t.lng, is24h: t.is24h, hours: t.hours, photos: t.photos,
    // Halol reyting: o'rtacha faqat REVIEW.minToShow bahodan keyin, aks holda null (soni qoladi)
    ratingAvg: ratingDisplay({ avg: t.ratingAvg, count: t.ratingCount }).avg, ratingCount: t.ratingCount,
    claimed: t.claimedAt !== null, orgName: t.orgName, claimStatus: t.claimStatus,
    services: t.services.filter((s) => s.isEnabled).map((s) => s.serviceCode),
    fromPriceTiyin: fromPriceTiyin(t),
    tariffs: cardTariffs(t),
    freeToday,
    distanceKm: near && t.lat != null && t.lng != null ? round1(distanceKm(near.lat, near.lng, t.lat, t.lng)) : null,
  };
}

export function publicTerminal(t: TerminalRecord, freeToday = 0) {
  return {
    ...publicTerminalCard(t, freeToday),
    description: t.description, phone: t.phone, passport: t.passport,
    station: t.station,
    serviceDetails: t.services.filter((s) => s.isEnabled).map((s) => ({ serviceCode: s.serviceCode, leadTimeMin: s.leadTimeMin })),
    tariffs: t.tariffs.map(publicTariff),
  };
}

/**
 * Ro'yxat ustidagi qaror qatori: nechtasida bugun bo'sh slot bor, eng arzon tarif, eng yaqini.
 * Eng arzon: so'ralgan xizmatlar ichida (bo'lmasa LOAD/UNLOAD), umumiy yuk guruhi.
 * ponytail: birliklar aralash bo'lsa tonna narxi ustun, aks holda eng kichigi; birlikni tenglashtirish kerak bo'lsa keyin
 */
export function summarize(all: TerminalRecord[], free: Record<string, number>, near?: GeoNear, services: ServiceCode[] = []) {
  const pool = all.flatMap((t) => t.tariffs.filter((x) => x.cargoGroupCode === null && (services.length ? services.includes(x.serviceCode) : x.serviceCode === 'LOAD' || x.serviceCode === 'UNLOAD')));
  const perTon = pool.filter((x) => x.unit === 'PER_TON');
  const cheapest = (perTon.length ? perTon : pool).reduce<TariffRecord | null>((m, x) => (m === null || x.priceTiyin < m.priceTiyin ? x : m), null);
  const dists = near ? all.filter((t) => t.lat != null && t.lng != null).map((t) => distanceKm(near.lat, near.lng, t.lat!, t.lng!)) : [];
  return {
    freeToday: all.filter((t) => (free[t.id] ?? 0) > 0).length,
    // UI shu sonni ko'rib "reyting bo'yicha" variantini ko'rsatadi: 0 bo'lsa saralash yolg'on bo'lardi
    ratedCount: all.filter((t) => t.ratingCount > 0).length,
    cheapestTiyin: cheapest?.priceTiyin ?? null,
    cheapestUnit: cheapest?.unit ?? null,
    nearestKm: dists.length ? round1(Math.min(...dists)) : null,
  };
}

/** ownerNameRaw hech qachon chiqmaydi; tasdiqlangan claim bo'lsa tashkilot nomi. */
export function publicSiding(s: SidingRecord) {
  return {
    id: s.id, registryNo: s.registryNo, station: s.station, stationNameRaw: s.stationNameRaw, esrCode: s.esrCode, rju: s.rju,
    regionCode: s.regionCode, lat: s.lat, lng: s.lng,
    lengthM: s.lengthM, unloadCapacity: s.unloadCapacity, loadCapacity: s.loadCapacity,
    // Rasm faqat tasdiqlangan egada ko'rinadi: da'vo hal bo'lmaguncha uni hech kim ko'rmaydi
    photos: s.claimStatus === 'APPROVED' ? s.photos : [],
    claimStatus: s.claimStatus, owner: s.claimStatus === 'APPROVED' ? s.ownerOrgName : null,
  };
}

/**
 * Sukut tartib: egasi bor obyektlar oldinda, keyin (near berilgan bo'lsa) masofa, keyin nom.
 * Baho deyarli hech kimda yo'q, shuning uchun reyting sukut tartib emas.
 */
export const byDefault = (near?: GeoNear) => (a: TerminalRecord, b: TerminalRecord) =>
  Number(b.orgId !== null) - Number(a.orgId !== null)
  || (near && a.lat != null && a.lng != null && b.lat != null && b.lng != null ? distanceKm(near.lat, near.lng, a.lat, a.lng) - distanceKm(near.lat, near.lng, b.lat, b.lng) : 0)
  || a.name.localeCompare(b.name);
