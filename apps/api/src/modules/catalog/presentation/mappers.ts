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

/**
 * Kartadagi temir yo'l qatori: butun pasport emas, qaror uchun kerakli to'rt raqam.
 * Shahobcha reestrdan keladi va uning tarifi yo'q, shuning uchun karta narx o'rniga shuni ko'rsatadi.
 */
function railCard(t: TerminalRecord) {
  if (!t.rail) return null;
  const r = t.rail;
  return {
    registryNo: r.registryNo, lengthM: r.lengthM, trackCount: r.trackCount, capacityWagons: r.capacityWagons,
    loadCapacity: r.loadCapacity, unloadCapacity: r.unloadCapacity,
    // Reestrdagi egasi (tashkilot nomi): Taminotda ham ochiq turadi, telefondan farqli
    ownerNameRaw: r.ownerNameRaw,
    // Mas'ul shaxs ismi ochiq, raqami yo'q: raqam faqat kirgan foydalanuvchiga (publicTerminal)
    contactName: r.contactName, hasPhone: !!r.contactPhone?.trim(),
  };
}

export function publicTerminalCard(t: TerminalRecord, freeToday = 0, near?: GeoNear) {
  return {
    id: t.id, slug: t.slug, name: t.name, kind: t.kind, status: t.status,
    station: t.station ? { esrCode: t.station.esrCode, nameUz: t.station.nameUz, rju: t.station.rju } : null,
    // Reestr shahobchasida stationId bo'lmasligi mumkin: xom nom baribir ko'rsatiladi
    stationNameRaw: t.rail?.stationNameRaw ?? null,
    rail: railCard(t),
    regionCode: t.regionCode,
    address: t.address, lat: t.lat, lng: t.lng, is24h: t.is24h, hours: t.hours, photos: t.photos,
    // Halol reyting: o'rtacha faqat REVIEW.minToShow bahodan keyin, aks holda null (soni qoladi)
    ratingAvg: ratingDisplay({ avg: t.ratingAvg, count: t.ratingCount }).avg, ratingCount: t.ratingCount,
    claimed: t.claimedAt !== null, orgName: t.orgName, claimStatus: t.claimStatus, isDemo: t.isDemo,
    services: t.services.filter((s) => s.isEnabled).map((s) => s.serviceCode),
    fromPriceTiyin: fromPriceTiyin(t),
    tariffs: cardTariffs(t),
    freeToday,
    distanceKm: near && t.lat != null && t.lng != null ? round1(distanceKm(near.lat, near.lng, t.lat, t.lng)) : null,
  };
}

/**
 * Telefon raqamining o'zi ochiq javobda yo'q: u obunachiga, bosilganda,
 * GET /contacts/terminal/:id orqali beriladi. Ilgari terminalning o'z raqami hammaga,
 * reestrdagi mas'ul shaxs raqami esa kirgan foydalanuvchiga ochiq edi.
 * `hasPhone`: obyektning o'z raqami yoki reestrdagi raqam bormi (tugma uchun).
 */
export function publicTerminal(t: TerminalRecord, freeToday = 0) {
  const r = t.rail;
  return {
    ...publicTerminalCard(t, freeToday),
    description: t.description, hasPhone: !!t.phone?.trim() || !!r?.contactPhone?.trim(), passport: t.passport,
    station: t.station,
    serviceDetails: t.services.filter((s) => s.isEnabled).map((s) => ({ serviceCode: s.serviceCode, leadTimeMin: s.leadTimeMin })),
    tariffs: t.tariffs.map(publicTariff),
    // To'liq temir yo'l pasporti (Taminot reestri): faqat RAIL terminalda
    rail: r === null ? null : {
      ...railCard(t)!,
      stationNameRaw: r.stationNameRaw, esrCode: r.esrCode, rju: r.rju, registryRef: r.registryRef,
      occupiedWagons: r.occupiedWagons, deadEndDistanceM: r.deadEndDistanceM, junctionSwitch: r.junctionSwitch,
      brakeShoes: r.brakeShoes, nogabarit: r.nogabarit, equipment: r.equipment,
      loadNorm: r.loadNorm, unloadNorm: r.unloadNorm, loadFront: r.loadFront, unloadFront: r.unloadFront,
      locoType: r.locoType, locoNote: r.locoNote, processingHours: r.processingHours,
      contractNo: r.contractNo, contractStart: r.contractStart, contractEnd: r.contractEnd, contractState: r.contractState,
      category: r.category, usageType: r.usageType, operStatus: r.status, note: r.note,
    },
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

/**
 * ownerNameRaw hech qachon chiqmaydi; tasdiqlangan claim bo'lsa tashkilot nomi.
 * Mas'ul shaxs telefoni javobda yo'q: u obunachiga GET /contacts/siding/:id orqali
 * beriladi. Bu reestrdan kelgan shaxsiy raqam, egasi uni o'zi e'lon qilmagan.
 */
export function publicSiding(s: SidingRecord) {
  return {
    id: s.id, slug: s.slug, registryNo: s.registryNo, station: s.station, stationNameRaw: s.stationNameRaw, esrCode: s.esrCode, rju: s.rju,
    regionCode: s.regionCode, lat: s.lat, lng: s.lng,
    lengthM: s.lengthM, unloadCapacity: s.unloadCapacity, loadCapacity: s.loadCapacity,
    // Rasm faqat tasdiqlangan egada ko'rinadi: da'vo hal bo'lmaguncha uni hech kim ko'rmaydi
    photos: s.claimStatus === 'APPROVED' ? s.photos : [],
    claimStatus: s.claimStatus, owner: s.claimStatus === 'APPROVED' ? s.ownerOrgName : null,
    // Texnik pasport (Taminot reestri). Mas'ul shaxs ismi ochiq, telefoni obuna ortida.
    name: s.name, registryRef: s.registryRef, trackCount: s.trackCount,
    capacityWagons: s.capacityWagons, occupiedWagons: s.occupiedWagons,
    deadEndDistanceM: s.deadEndDistanceM, junctionSwitch: s.junctionSwitch, brakeShoes: s.brakeShoes,
    nogabarit: s.nogabarit, equipment: s.equipment,
    loadNorm: s.loadNorm, unloadNorm: s.unloadNorm, loadFront: s.loadFront, unloadFront: s.unloadFront,
    locoType: s.locoType, locoNote: s.locoNote, processingHours: s.processingHours,
    contractNo: s.contractNo, contractStart: s.contractStart, contractEnd: s.contractEnd,
    contractState: s.contractState, category: s.category, usageType: s.usageType, status: s.status,
    contactName: s.contactName,
    /** Raqam bor, lekin ko'rish uchun obuna kerak: UI shu bilan tugma ko'rsatadi. */
    hasPhone: !!s.contactPhone?.trim(),
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
