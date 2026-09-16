/* eslint-disable no-console */
/**
 * Idempotent seed: PlatformConfig, stansiyalar, ETSNG, shahobchalar, pilot terminallar (Toshkent tuguni).
 *   pnpm --filter @yuksaroy/api db:seed
 * Manba JSON'lar: prisma/seed/data (build-data.ts bilan yasaladi). Qayta ishga tushirish xavfsiz - upsert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, type Prisma, type Rju, type ServiceCode, type TariffUnit, type TerminalKind } from '@prisma/client';
import { BOOKING, PLATFORM_DEFAULTS, slugify, uzLocalToUtc } from '@yuksaroy/domain';

const prisma = new PrismaClient();
const data = <T>(f: string) => JSON.parse(readFileSync(resolve(__dirname, 'data', f), 'utf8')) as T;
const key = (s: string) => s.toLowerCase().replace(/[\s\-'’ʻ`.,()/]/g, '').replace(/қ/g, 'к').replace(/ў/g, 'у').replace(/ғ/g, 'г').replace(/ҳ/g, 'х').replace(/ё/g, 'е');

type StationJson = { esrCode: string | null; nameUz: string; nameRu: string | null; rju: Rju; stationType: string | null; classRank: string | null; isTariff: boolean; lat: number | null; lng: number | null };
type SidingJson = { registryNo: number; rju: Rju | null; ownerNameRaw: string; esrCode: string | null; stationNameRaw: string; lengthM: number | null; unloadCapacity: number; loadCapacity: number };
type CargoJson = { code: string; codeTo: string; name: string; groupCode: string; groupName: string };

async function seedConfig() {
  for (const [k, v] of Object.entries(PLATFORM_DEFAULTS)) {
    await prisma.platformConfig.upsert({ where: { key: k }, create: { key: k, value: v as Prisma.InputJsonValue }, update: {} }); // admin qiymati saqlanadi
  }
  console.log('PlatformConfig: ok');
}

async function seedStations() {
  const rows = data<StationJson[]>('stations.json');
  const existing = await prisma.station.findMany({ select: { id: true, esrCode: true, nameRu: true, nameUz: true, rju: true } });
  const byEsr = new Map(existing.filter((s) => s.esrCode).map((s) => [s.esrCode!, s.id]));
  const byName = new Map(existing.map((s) => [`${s.rju}|${key(s.nameRu ?? s.nameUz)}`, s.id]));
  let created = 0, updated = 0;
  for (const r of rows) {
    const id = (r.esrCode && byEsr.get(r.esrCode)) || byName.get(`${r.rju}|${key(r.nameRu ?? r.nameUz)}`);
    if (id) { await prisma.station.update({ where: { id }, data: r }); updated++; }
    else { await prisma.station.create({ data: r }); created++; }
  }
  console.log(`Station: +${created} / ~${updated}`);
}

async function seedCargo() {
  const rows = data<CargoJson[]>('cargo-types.json');
  for (const r of rows) await prisma.cargoType.upsert({ where: { code: r.code }, create: r, update: r });
  console.log(`CargoType: ${rows.length}`);
}

/**
 * Shahobcha yo'llar endi Terminal jadvalida, kind = RAIL. Siding jadvali yo'q,
 * shuning uchun seed ham to'g'ridan-to'g'ri terminal yozadi (registryNo bo'yicha upsert).
 */
async function seedSidings() {
  const rows = data<SidingJson[]>('sidings.json');
  const stations = await prisma.station.findMany({ select: { id: true, esrCode: true } });
  const byEsr = new Map(stations.filter((s) => s.esrCode).map((s) => [s.esrCode!, s.id]));
  let linked = 0;
  for (const r of rows) {
    const stationId = (r.esrCode && byEsr.get(r.esrCode)) || null;
    if (stationId) linked++;
    const { ownerNameRaw, stationNameRaw } = r;
    const name = (r.name?.trim() || ownerNameRaw?.trim() || stationNameRaw || 'Shahobcha');
    // Egalik va da'vo maydonlariga tegilmaydi: ular platformada beriladi, reestrda emas
    const d = { ...r, name, stationId, kind: 'RAIL' as const };
    await prisma.terminal.upsert({
      where: { registryNo: r.registryNo },
      create: { ...d, slug: `shahobcha-${r.registryNo}`, status: 'ACTIVE' as const },
      update: d,
    });
  }
  console.log(`Shahobcha terminallari: ${rows.length} (stansiyaga bog'langan ${linked})`);
}

// Ochiq ma'lumotdan yig'ilgan terminal reestri: orgId yo'q, ya'ni ochiq katalogda ko'rinmaydi.
// Bu ro'yxat faqat egasiga murojaat qilish (da'vo havolasi) uchun; terminalni katalogga faqat egasi qo'shadi.
const H8_18 = { mon: [['08:00', '18:00']], tue: [['08:00', '18:00']], wed: [['08:00', '18:00']], thu: [['08:00', '18:00']], fri: [['08:00', '18:00']], sat: [['09:00', '14:00']], sun: [] };
const som = (n: number) => BigInt(n) * 100n;
type T = { serviceCode: ServiceCode; unit: TariffUnit; priceSom: number; minSom?: number };
const yardTariffs: T[] = [
  { serviceCode: 'LOAD', unit: 'PER_TON', priceSom: 18_500, minSom: 300_000 }, { serviceCode: 'UNLOAD', unit: 'PER_TON', priceSom: 17_000, minSom: 300_000 },
  { serviceCode: 'WEIGH', unit: 'PER_OPERATION', priceSom: 120_000 }, { serviceCode: 'STORAGE', unit: 'PER_DAY', priceSom: 350_000 },
];
const containerTariffs: T[] = [
  { serviceCode: 'LOAD', unit: 'PER_TON', priceSom: 21_000, minSom: 400_000 }, { serviceCode: 'UNLOAD', unit: 'PER_TON', priceSom: 19_500, minSom: 400_000 },
  { serviceCode: 'CONTAINER', unit: 'PER_OPERATION', priceSom: 450_000 }, { serviceCode: 'STORAGE', unit: 'PER_DAY', priceSom: 280_000 }, { serviceCode: 'WEIGH', unit: 'PER_OPERATION', priceSom: 150_000 },
];
const PILOT: Array<{ name: string; stationRu: string; kind: TerminalKind; is24h: boolean; address: string; description: string; services: ServiceCode[]; passport: Record<string, unknown>; tariffs: T[] }> = [
  { name: 'Toshkent-tovar yuk saroyi', stationRu: 'Ташкент-Товарный', kind: 'MULTI', is24h: true, address: "Toshkent sh., Yashnobod tumani, Temiryo'lchilar ko'chasi",
    description: "O'TY tizimidagi eng yirik yuk saroyi: ochiq maydon, yopiq ombor, bojxona ombori, avtotarozi, konteyner maydoni.",
    services: ['LOAD', 'UNLOAD', 'WEIGH', 'STORAGE', 'SVX', 'CONTAINER', 'SHUNTING'], passport: { tracks: 6, tracksLengthM: 3200, cranes: [{ type: 'ko\'prikli kran', capacityT: 32 }, { type: 'kozlovoy kran', capacityT: 20 }], warehouseM2: 8500, openAreaM2: 42000, hasSvx: true, hasScale: true, scaleT: 150 }, tariffs: yardTariffs },
  { name: "Chuqursoy konteyner terminali", stationRu: 'Чукурсай', kind: 'MULTI', is24h: true, address: "Toshkent sh., Olmazor tumani",
    description: "O'ztemiryo'lkonteyner tarkibidagi konteyner terminali: 20/40 ft konteynerlar, richstaker, bojxona posti yaqin.",
    services: ['LOAD', 'UNLOAD', 'CONTAINER', 'STORAGE', 'WEIGH', 'SVX'], passport: { tracks: 4, tracksLengthM: 2100, cranes: [{ type: 'richstaker', capacityT: 45 }, { type: 'kozlovoy kran', capacityT: 40 }], openAreaM2: 30000, containerSlots: 1200, hasSvx: true, hasScale: true }, tariffs: containerTariffs },
  { name: 'Sergeli yuk terminali', stationRu: 'Сергели', kind: 'MULTI', is24h: false, address: 'Toshkent sh., Sergeli tumani, Sanoat zonasi',
    description: "Sergeli sanoat zonasi uchun yuk saroyi: qurilish materiallari, metall, oziq-ovqat. Ish vaqti 8:00-18:00, shanba yarim kun.",
    services: ['LOAD', 'UNLOAD', 'WEIGH', 'STORAGE'], passport: { tracks: 3, tracksLengthM: 1400, cranes: [{ type: 'kozlovoy kran', capacityT: 16 }], warehouseM2: 3000, openAreaM2: 12000, hasSvx: false, hasScale: true, scaleT: 100 }, tariffs: yardTariffs.map((t) => ({ ...t, priceSom: Math.round(t.priceSom * 0.9) })) },
  { name: "To'ytepa konteyner maydoni", stationRu: 'Тойтепа', kind: 'MULTI', is24h: false, address: "Toshkent viloyati, O'rta Chirchiq tumani, To'ytepa",
    description: 'Toshkent viloyati janubi uchun konteyner maydoni; avtomobil yo\'li M-39 yonida.',
    services: ['LOAD', 'UNLOAD', 'CONTAINER', 'STORAGE'], passport: { tracks: 2, tracksLengthM: 900, cranes: [{ type: 'richstaker', capacityT: 45 }], openAreaM2: 15000, containerSlots: 500, hasSvx: false, hasScale: false }, tariffs: containerTariffs.map((t) => ({ ...t, priceSom: Math.round(t.priceSom * 0.85) })) },
  { name: 'Angren logistika markazi (quruq port)', stationRu: 'Ангрен', kind: 'MULTI', is24h: true, address: 'Toshkent viloyati, Angren sh., Angren-Pop yo\'nalishi',
    description: "Farg'ona vodiysi yo'nalishidagi quruq port: bojxona ombori, bojxona posti, konteyner va vagon-avto qayta yuklash, 24/7.",
    services: ['LOAD', 'UNLOAD', 'CONTAINER', 'STORAGE', 'SVX', 'WEIGH', 'LAST_MILE'], passport: { tracks: 8, tracksLengthM: 5600, cranes: [{ type: 'kozlovoy kran', capacityT: 41 }, { type: 'richstaker', capacityT: 45 }], warehouseM2: 12000, openAreaM2: 60000, hasSvx: true, hasScale: true, scaleT: 150, customsPost: true }, tariffs: containerTariffs },
  { name: 'Ohangaron yuk maydoni', stationRu: 'Ахангаран', kind: 'MULTI', is24h: false, address: 'Toshkent viloyati, Ohangaron sh.',
    description: 'Sement va qurilish materiallari uchun yuk maydoni; Ohangaron sement zavodi yonida.',
    services: ['LOAD', 'UNLOAD', 'WEIGH'], passport: { tracks: 2, tracksLengthM: 1100, cranes: [], openAreaM2: 9000, hasSvx: false, hasScale: true, scaleT: 80 }, tariffs: yardTariffs.filter((t) => t.serviceCode !== 'STORAGE').map((t) => ({ ...t, priceSom: Math.round(t.priceSom * 0.8) })) },
];

async function seedTerminals() {
  const stations = await prisma.station.findMany({ select: { id: true, nameRu: true, nameUz: true, lat: true, lng: true } });
  const byRu = new Map(stations.map((s) => [key(s.nameRu ?? s.nameUz), s]));
  const validFrom = new Date('2026-09-01T00:00:00+05:00');
  for (const p of PILOT) {
    const st = byRu.get(key(p.stationRu));
    if (!st) { console.log(`  ! stansiya topilmadi: ${p.stationRu} - ${p.name} o'tkazib yuborildi`); continue; }
    const slug = slugify(p.name);
    const base = { name: p.name, stationId: st.id, kind: p.kind, is24h: p.is24h, address: p.address, description: p.description, lat: st.lat, lng: st.lng,
      hours: p.is24h ? undefined : (H8_18 as Prisma.InputJsonValue), passport: p.passport as Prisma.InputJsonValue, status: 'ACTIVE' as const };
    const t = await prisma.terminal.upsert({ where: { slug }, create: { slug, ...base }, update: base });
    await prisma.terminalService.deleteMany({ where: { terminalId: t.id } });
    await prisma.terminalService.createMany({ data: p.services.map((serviceCode) => ({ terminalId: t.id, serviceCode, leadTimeMin: serviceCode === 'SHUNTING' ? 120 : 0 })) });
    if ((await prisma.tariff.count({ where: { terminalId: t.id } })) === 0) {
      await prisma.tariff.createMany({
        data: p.tariffs.map((x) => ({ terminalId: t.id, serviceCode: x.serviceCode, version: 1, validFrom, priceTiyin: som(x.priceSom), unit: x.unit,
          minTiyin: x.minSom ? som(x.minSom) : null, note: 'Taxminiy tarif, pasport egasi tomonidan tasdiqlanmagan' })),
      });
    }
  }
  console.log(`Terminal: ${PILOT.length} pilot`);
}

async function main() {
  await seedConfig();
  await seedStations();
  await seedCargo();
  await seedSidings();
  if (process.env.SEED_PILOT === '1') { await seedTerminals(); await seedSlots(); }
  else console.log("Pilot terminal va slotlar qo'shilmadi (SEED_PILOT=1 bilan qo'shiladi)");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

/** Pilot terminallar uchun slot kalendari: standart 6 oyna × 30 kun (BOOKING.horizonDays). */
async function seedSlots() {
  // Slot faqat egasi platformada bo'lgan terminalda: egasiz obyektda tasdiqlaydigan tomon yo'q
  const terminals = await prisma.terminal.findMany({ where: { status: 'ACTIVE', orgId: { not: null } }, select: { id: true, is24h: true } });
  const today = new Date();
  let created = 0;
  for (const t of terminals) {
    // 24/7 terminallarda sig'im kattaroq
    const windows = BOOKING.defaultWindows.map(([start, end], i) => ({ window: i + 1, start, end, capacity: t.is24h ? 4 : BOOKING.defaultCapacity }));
    for (let d = 0; d < BOOKING.horizonDays; d++) {
      const date = new Date(today.getTime() + d * 86_400_000).toISOString().slice(0, 10);
      for (const w of windows) {
        await prisma.timeSlot.upsert({
          where: { terminalId_localDate_window: { terminalId: t.id, localDate: new Date(`${date}T00:00:00.000Z`), window: w.window } },
          create: { terminalId: t.id, localDate: new Date(`${date}T00:00:00.000Z`), window: w.window, startsAt: uzLocalToUtc(date, w.start), endsAt: uzLocalToUtc(date, w.end), capacity: w.capacity },
          update: {}, // mavjud sig'im va bandlik tegilmaydi
        });
        created++;
      }
    }
  }
  console.log(`TimeSlot: ${created} (egali terminal ${terminals.length} × ${BOOKING.horizonDays} kun)`);
}
