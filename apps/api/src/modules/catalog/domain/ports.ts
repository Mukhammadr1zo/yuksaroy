// catalog: domen portlari. Framework va Prisma bu faylda yo'q.
import type { ClaimStatus, Rju, ServiceCode, TariffUnit, TerminalKind, TerminalStatus } from '@yuksaroy/domain';

export interface StationRecord {
  id: string; esrCode: string | null; nameUz: string; nameRu: string | null; rju: Rju;
  stationType: string | null; classRank: string | null; lat: number | null; lng: number | null;
}

export interface CargoTypeRecord {
  id: string; code: string; codeTo: string; name: string; nameUz: string | null; groupCode: string; groupName: string;
}

export interface TariffRecord {
  id: string; terminalId: string; serviceCode: ServiceCode; cargoGroupCode: string | null; version: number;
  validFrom: Date; validTo: Date | null; priceTiyin: number; unit: TariffUnit; minTiyin: number | null; note: string | null; createdAt: Date;
}

export interface TerminalServiceRecord { serviceCode: ServiceCode; isEnabled: boolean; leadTimeMin: number }

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** { mon: [["08:00","18:00"]], sat: [] }: bo'sh massiv = dam olish kuni. */
export type WeekHours = Partial<Record<WeekDay, [string, string][]>>;

/**
 * Shahobcha texnik pasporti (Taminot reestridan). Mas'ul shaxs telefoni bu yerda bor,
 * lekin ochiq javobga chiqmaydi: mapper uni faqat ro'yxatdan o'tgan foydalanuvchiga beradi.
 */
export interface SidingPassport {
  name: string | null; registryRef: string | null;
  trackCount: number | null; capacityWagons: number | null; occupiedWagons: number | null;
  deadEndDistanceM: number | null; junctionSwitch: string | null; brakeShoes: number | null;
  nogabarit: string | null; equipment: string | null;
  loadNorm: string | null; unloadNorm: string | null; loadFront: string | null; unloadFront: string | null;
  locoType: string | null; locoNote: string | null; processingHours: number | null;
  contractNo: string | null; contractStart: Date | null; contractEnd: Date | null; contractState: string | null;
  category: string | null; usageType: string | null; status: string | null; note: string | null;
  /** Mas'ul shaxs. Telefon ochiq javobda berilmaydi: faqat ro'yxatdan o'tgan foydalanuvchiga. */
  contactName: string | null; contactPhone: string | null;
}

export interface TerminalRecord {
  regionCode: string | null;
  /**
   * Temir yo'l pasporti: shahobcha ham terminal, reestr ma'lumoti shu yerda.
   * Avto terminalda null. Ichma-ich, chunki `name` va `status` terminalnikiga to'qnashadi.
   */
  rail: (SidingPassport & {
    registryNo: number | null; stationNameRaw: string | null; esrCode: string | null; rju: Rju | null;
    ownerNameRaw: string | null; lengthM: number | null; loadCapacity: number; unloadCapacity: number;
  }) | null;
  id: string; orgId: string | null; orgName: string | null; stationId: string | null; station: StationRecord | null;
  kind: TerminalKind; slug: string; name: string; description: string | null; address: string | null; phone: string | null;
  lat: number | null; lng: number | null; is24h: boolean; hours: WeekHours | null; passport: Record<string, unknown> | null;
  photos: string[]; status: TerminalStatus; claimedAt: Date | null; ratingAvg: number; ratingCount: number;
  /** Egasiz terminalga da'vo: PENDING -> admin hal qiladi; claimOrgId da'vogar tashkilot. */
  claimStatus: ClaimStatus; claimOrgId: string | null;
  services: TerminalServiceRecord[];
  /** Faqat amaldagi tariflar (validFrom <= now < validTo). */
  tariffs: TariffRecord[];
}

export interface TerminalWrite {
  orgId: string | null; stationId: string | null; kind: TerminalKind; slug: string; name: string;
  description?: string | null; address?: string | null; phone?: string | null; lat?: number | null; lng?: number | null;
  is24h?: boolean; hours?: WeekHours | null; passport?: Record<string, unknown> | null; photos?: string[];
  status?: TerminalStatus; claimedAt?: Date | null;
}

/** `near`: xaritadan yoki "yonimda" tugmasidan kelgan nuqta va radius (km). */
export interface GeoNear { lat: number; lng: number; radiusKm: number }

export interface TerminalFilter {
  stationEsr?: string; stationId?: string; rju?: Rju; kind?: TerminalKind; q?: string;
  /** Bir nechta kod berilsa hammasi yoqilgan bo'lishi shart (AND). */
  service?: ServiceCode | ServiceCode[];
  /** Bir nechta kod berilsa ulardan biri (IN). */
  region?: string | string[];
  near?: GeoNear;
  /** default ACTIVE; 'ANY': egasi/admin ro'yxati uchun */
  status?: TerminalStatus | 'ANY';
  orgIds?: string[];
  claimStatus?: ClaimStatus;
  /**
   * Terminalni faqat egasi qo'shadi: ochiq katalogda egasiz obyekt ko'rinmaydi.
   * true = faqat egali, false = faqat egasiz (admin reestri), undefined = hammasi.
   */
  owned?: boolean;
  /**
   * Ochiq katalog qamrovi: egasi bor obyektlar YOKI temir yo'l terminallari (shahobcha reestri).
   * Shahobchani egasi qo'shmaydi, u reestrdan keladi, shuning uchun `owned` bilan chiqarib
   * tashlanmasligi kerak. `owned` bilan birga ishlatilmaydi.
   */
  publicCatalog?: boolean;
  /**
   * Ochiq katalog sahifasi: saralash va bo'lish BAZADA bajariladi.
   * Reestr qo'shilgach katalogda 1700+ obyekt bor, hammasini xotiraga olib bo'lmaydi.
   * Faqat baza o'zi qila oladigan tartiblar; narx va masofa hisoblangan qiymat (pastga qarang).
   */
  sort?: 'default' | 'rating' | 'name';
  /** Aniq siljish va soni. Narx bo'yicha saralashda sahifa chegarasi sahifa raqamiga tushmaydi. */
  skip?: number;
  take?: number;
}

export interface SidingRecord extends SidingPassport {
  id: string; registryNo: number | null; stationId: string | null; regionCode: string | null;
  station: Pick<StationRecord, 'id' | 'esrCode' | 'nameUz' | 'rju'> | null;
  stationNameRaw: string; esrCode: string | null; rju: Rju | null;
  /** Terminal sahifasining manzili: shahobcha ham terminal. */
  slug: string;
  ownerNameRaw: string; ownerOrgId: string | null; ownerOrgName: string | null;
  claimStatus: ClaimStatus; claimedAt: Date | null; lengthM: number | null; unloadCapacity: number; loadCapacity: number;
  /** Egasi yuklagan rasmlar; reestrda rasm yo'q. */
  photos: string[];
  /** Reestrda koordinata yo'q: tutashgan joy nuqtasi, taqribiy. */
  lat: number | null; lng: number | null;
}

export interface SidingFilter {
  stationEsr?: string; stationId?: string; rju?: Rju; q?: string; ownerOrgIds?: string[]; region?: string; near?: GeoNear;
  /** Bitta holat yoki holatlar ro'yxati (masalan da'vo qilish mumkin bo'lganlar: NONE va REJECTED). */
  claimStatus?: ClaimStatus | ClaimStatus[];
  /**
   * Shahobcha reestri ochiq: egasiz yo'llar ham katalogda turadi (egasi topib da'vo qiladi).
   * true = faqat egali, false = faqat egasiz, undefined = hammasi (ochiq katalog shuni ishlatadi).
   */
  owned?: boolean;
}

export interface Page<T> { items: T[]; total: number; page: number; limit: number }

export interface PublishTariffInput {
  terminalId: string; serviceCode: ServiceCode; cargoGroupCode: string | null; priceTiyin: number; unit: TariffUnit;
  minTiyin: number | null; validFrom: Date; note: string | null; createdById: string | null;
}

export interface CatalogRepository {
  searchStations(q: string, rju: Rju | undefined, limit: number): Promise<StationRecord[]>;
  findStationByEsr(esrCode: string): Promise<StationRecord | null>;
  findStationById(id: string): Promise<StationRecord | null>;
  searchCargoTypes(q: string, limit: number): Promise<CargoTypeRecord[]>;
  findCargoTypeByCode(code: string): Promise<CargoTypeRecord | null>;

  listTerminals(f: TerminalFilter, now: Date): Promise<TerminalRecord[]>;
  /** Filtrga tushgan obyektlarning haqiqiy soni (sahifadagi emas). */
  countTerminals(f: TerminalFilter): Promise<number>;
  /** Bugungi (Toshkent kuni) ochiq slotlardagi bo'sh joylar yig'indisi, terminal id bo'yicha. Yo'q id = 0. */
  freeTodayByTerminal(terminalIds: string[], now: Date): Promise<Record<string, number>>;
  findTerminalBySlug(slug: string, now: Date): Promise<TerminalRecord | null>;
  findTerminalById(id: string, now: Date): Promise<TerminalRecord | null>;
  slugExists(slug: string): Promise<boolean>;
  createTerminal(data: TerminalWrite, now: Date): Promise<TerminalRecord>;
  updateTerminal(id: string, data: Partial<TerminalWrite>, now: Date): Promise<TerminalRecord>;
  replaceServices(terminalId: string, services: TerminalServiceRecord[]): Promise<void>;
  listTariffs(terminalId: string, history: boolean, now: Date): Promise<TariffRecord[]>;
  /** Tranzaksiya: oldingi versiya validTo = validFrom, yangi versiya +1. Kesishsa TariffOverlapError. */
  publishTariff(t: PublishTariffInput): Promise<TariffRecord>;
  /** orgId bo'sh va da'vo PENDING bo'lmasa PENDING ga o'tkazadi; aks holda TerminalClaimedError. */
  claimTerminal(id: string, orgId: string): Promise<TerminalRecord>;
  /** Faqat PENDING hal qilinadi: tasdiqlansa orgId = claimOrgId, claimedAt = now; aks holda null. */
  decideTerminalClaim(id: string, approve: boolean, now: Date): Promise<TerminalRecord | null>;

  listSidings(f: SidingFilter, page: number, limit: number): Promise<Page<SidingRecord>>;
  /** `publicOnly`: ochiq yo'l uchun faqat ACTIVE. */
  findSidingById(id: string, publicOnly?: boolean): Promise<SidingRecord | null>;
  /** claimStatus NONE/REJECTED bo'lsa PENDING ga o'tkazadi; aks holda SidingClaimedError. */
  claimSiding(id: string, orgId: string, now: Date): Promise<SidingRecord>;
  /** Faqat PENDING hal qilinadi (APPROVED yoki REJECTED); aks holda null. Rad etilganda egasi saqlanadi, ochiq sahifada ko'rinmaydi. */
  decideSidingClaim(id: string, approve: boolean): Promise<SidingRecord | null>;
  /**
   * Egasi tahrir qiladi (hozircha faqat rasmlar): reestr ma'lumotiga tegilmaydi.
   * Shart qatorida orgId va APPROVED bor, ya'ni begona yoki hali tasdiqlanmagan
   * da'vogar hech narsa o'zgartira olmaydi. Mos kelmasa null.
   */
  updateSidingByOwner(id: string, orgIds: string[], data: { photos?: string[] }): Promise<SidingRecord | null>;

  /** Xarita uchun obyektlar: terminal nuqtalari va stansiya bo'yicha to'plangan shahobcha yo'llar. */
  mapObjects(): Promise<{
    terminals: { id: string; slug: string; name: string; kind: string; lat: number | null; lng: number | null }[];
    sidings: { id: string; name: string; lat: number; lng: number; count: number; regionCode: string | null }[];
  }>;
  /** Landing va ROI raqamlari: faol obyektlar, ochiq kompaniyalar, bugungi bo'sh slotlar yig'indisi. */
  publicStats(): Promise<{ terminals: number; sidings: number; stations: number; listings: number; companies: number; freeSlotsToday: number }>;
  /** Xarita uchun rasmiy ro'yxatdagi, koordinatasi bor stansiyalar (nomi uch tilda). */
  listedStations(): Promise<{
    id: string; esrCode: string | null; nameUz: string; nameRu: string | null; nameEn: string | null;
    rju: Rju; lat: number; lng: number; sidings: number;
  }[]>;
}

export const CATALOG_REPOSITORY = Symbol('CatalogRepository');

export class TariffOverlapError extends Error { constructor() { super('TARIFF_OVERLAP'); } }
export class TariffValidFromError extends Error { constructor() { super('TARIFF_VALID_FROM_BEFORE_CURRENT'); } }
export class SidingClaimedError extends Error { constructor() { super('SIDING_ALREADY_CLAIMED'); } }
export class TerminalClaimedError extends Error { constructor() { super('TERMINAL_CLAIMED'); } }
