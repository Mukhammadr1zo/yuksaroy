/* eslint-disable no-console */
/**
 * Manba fayllardan seed JSON'larini yasaydi (bir marta; natija repo'da: prisma/seed/data/*.json).
 *
 *   pnpm --filter @yuksaroy/api db:build-data -- [--railmap DIR] [--sidings XLSX] [--etsng XLSX]
 *
 * Manbalar:
 *  - RailMap/packages/database/seed-data/stations-2026.ts - O'TY 2026 rasmiy reestri (276 stansiya, RJU, tur, klass)
 *  - Шахобча йўллар.xlsx - 1 393 shahobcha (egasi, «ESR - stansiya», uzunlik, sig'im) → ESR kodlari ham shu yerdan
 *  - yuklar.xlsx - ETSNG pozitsiyalari (407)
 *  - (ixtiyoriy) RAILMAP_DATABASE_URL - koordinatalar (PostGIS `stations.location`); ulanmasa o'tkazib yuboriladi
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : [])).filter((x) => x.length));
const RAILMAP = resolve(args.railmap ?? 'C:/Users/user/Desktop/IT/RailMap');
const SIDINGS_XLSX = resolve(args.sidings ?? `${RAILMAP}/Шахобча йўллар.xlsx`);
const ETSNG_XLSX = resolve(args.etsng ?? 'C:/Users/user/Desktop/yuklar.xlsx');
const OUT = resolve(__dirname, 'data');

type Rju = 'TAS' | 'KOK' | 'BUX' | 'KUN' | 'KAR' | 'TER';
const RJU_BY_RU: Record<string, Rju> = {
  ташкент: 'TAS', тошкент: 'TAS', каканд: 'KOK', коканд: 'KOK', кокан: 'KOK', бухара: 'BUX', бухоро: 'BUX',
  кунград: 'KUN', кунгирот: 'KUN', карши: 'KAR', термиз: 'TER', термез: 'TER',
};

/** RailMap bilan bir xil normalizatsiya: kirill variantlarini tenglashtiradi, belgilarni tashlaydi. */
const key = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/қ/g, 'к').replace(/ў/g, 'у').replace(/ғ/g, 'г').replace(/ҳ/g, 'х').replace(/ё/g, 'е').replace(/ц/g, 'с')
    .replace(/[\s\-'’ʻ`.,()/]/g, '');

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: "'", ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  қ: 'q', ў: "o'", ғ: "g'", ҳ: 'h',
};
/** Ruscha/kirill nomdan lotin nom (faqat 2026 reestrida bo'lmagan stansiyalar uchun). */
const translit = (s: string) => s.split('').map((c) => { const l = c.toLowerCase(); const t = CYR[l]; if (t === undefined) return c; return c === l ? t : t.charAt(0).toUpperCase() + t.slice(1); }).join('');
const apos = (s: string) => s.replace(/[ʻ’`]/g, "'");
/**
 * Excel reestridan keladigan tipografik belgilar ASCII ga.
 * Egri qo'shtirnoq backtick ga: shu reestrning o'zida backtick allaqachon ustun (667 qator),
 * ya'ni yangi uslub emas, mavjudiga moslash. Bu nomlar saytda ko'rinadi.
 */
const FANCY: Array<[number, string]> = [[0x201c, '`'], [0x201d, '`'], [0x2018, "'"], [0x2019, "'"], [0x2013, '-'], [0x2014, '-']];
const noFancy = (s: string) => FANCY.reduce((acc, [code, to]) => acc.split(String.fromCharCode(code)).join(to), s);

async function main() {
  mkdirSync(OUT, { recursive: true });

  // 1) 2026 reestri
  const regPath = `${RAILMAP}/packages/database/seed-data/stations-2026.ts`;
  if (!existsSync(regPath)) throw new Error(`stations-2026.ts topilmadi: ${regPath}`);
  const reg = (await import(pathToFileURL(regPath).href)) as { STATIONS_2026: Array<{ rju: Rju; nameRu: string; nameUzLatin: string; type: string; classRank: string | null; isTariff: boolean; isPark: boolean }> };
  const stations = reg.STATIONS_2026.filter((s) => !s.isPark).map((s) => ({
    esrCode: null as string | null, nameUz: apos(s.nameUzLatin), nameRu: s.nameRu, rju: s.rju, stationType: s.type,
    classRank: s.classRank ? String(s.classRank).replace('CLASS_', '').toLowerCase() : null, isTariff: s.isTariff, lat: null as number | null, lng: null as number | null,
  }));
  const byRu = new Map(stations.map((s) => [key(s.nameRu), s]));
  console.log(`stations-2026: ${stations.length} (parklarsiz)`);

  // 2) Shahobcha reestri → sidings + ESR kodlari
  const wb = XLSX.read(readFileSync(SIDINGS_XLSX), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: false, defval: null });
  const sidings: Array<{ registryNo: number; rju: Rju | null; ownerNameRaw: string; esrCode: string | null; stationNameRaw: string; lengthM: number | null; unloadCapacity: number; loadCapacity: number }> = [];
  const esrName = new Map<string, string>();
  let esrMatched = 0, esrNew = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const no = Number.parseInt(String(r[0] ?? ''), 10);
    const owner = String(r[2] ?? '').trim(), st = String(r[3] ?? '').trim();
    if (!Number.isFinite(no) || !owner || !st) continue;
    const m = st.match(/^\s*(\d{4,6})?\s*[-–]\s*(.+)$/);
    const esr = m?.[1] ?? null, name = (m?.[2] ?? st).trim();
    const len = Number(String(r[4] ?? '').replace(',', '.').replace(/\s/g, ''));
    sidings.push({
      registryNo: no, rju: RJU_BY_RU[String(r[1] ?? '').trim().toLowerCase()] ?? null, ownerNameRaw: noFancy(owner), esrCode: esr, stationNameRaw: noFancy(name),
      lengthM: Number.isFinite(len) && len > 0 ? Math.round(len) : null, unloadCapacity: Number(r[5]) || 0, loadCapacity: Number(r[6]) || 0,
    });
    if (esr && !esrName.has(esr)) esrName.set(esr, name);
  }
  for (const [esr, name] of esrName) {
    const s = byRu.get(key(name));
    if (s) { if (!s.esrCode) { s.esrCode = esr; esrMatched++; } }
    else {
      const rju = sidings.find((x) => x.esrCode === esr)?.rju ?? 'TAS';
      const ns = { esrCode: esr, nameUz: apos(translit(name)), nameRu: name, rju, stationType: null, classRank: null, isTariff: true, lat: null, lng: null };
      stations.push(ns); byRu.set(key(name), ns); esrNew++;
    }
  }
  console.log(`sidings: ${sidings.length}; ESR kodlari: ${esrName.size} (reestr stansiyasiga ${esrMatched}, reestrdan tashqari yangi ${esrNew})`);

  // 3) Koordinatalar (ixtiyoriy, RailMap PostGIS)
  const dbUrl = process.env.RAILMAP_DATABASE_URL ?? 'postgresql://uzrail:uzrail_dev_password@localhost:5433/uzrailmap';
  try {
    const { PrismaClient } = await import('@prisma/client');
    const rm = new PrismaClient({ datasourceUrl: dbUrl });
    const pts = await Promise.race([
      rm.$queryRawUnsafe<Array<{ esr: string | null; ru: string | null; uz: string; lat: number; lng: number }>>(
        `SELECT esr_code AS esr, name_ru AS ru, name_uz_latin AS uz, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM stations WHERE deleted_at IS NULL AND location IS NOT NULL`,
      ),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    await rm.$disconnect();
    let hit = 0;
    const byEsr5 = new Map(stations.filter((s) => s.esrCode).map((s) => [s.esrCode!.slice(0, 5), s]));
    const byUz = new Map(stations.map((s) => [key(s.nameUz), s]));
    for (const p of pts) {
      const s = (p.esr && byEsr5.get(p.esr.slice(0, 5))) || (p.ru && byRu.get(key(p.ru))) || byUz.get(key(apos(p.uz)));
      if (s && s.lat === null) { s.lat = Math.round(p.lat * 1e5) / 1e5; s.lng = Math.round(p.lng * 1e5) / 1e5; hit++; }
    }
    console.log(`koordinatalar: RailMap ${pts.length} nuqta → ${hit} stansiya`);
  } catch (e) {
    console.log(`koordinatalar o'tkazib yuborildi (${dbUrl.replace(/:[^:@]+@/, ':***@')}): ${(e as Error).message.split('\n')[0]}`);
  }

  // 4) ETSNG
  const wbE = XLSX.read(readFileSync(ETSNG_XLSX), { type: 'buffer' });
  const er = XLSX.utils.sheet_to_json<unknown[]>(wbE.Sheets[wbE.SheetNames[0]!]!, { header: 1, raw: false, defval: null });
  const cargo: Array<{ code: string; codeTo: string; name: string; groupCode: string; groupName: string }> = [];
  // ETSNG kodi 6 raqam (2 guruh + 3 pozitsiya + nazorat); xlsx boshidagi nolni tashlab yuborgan: "11005" → "011005".
  const six = (v: unknown) => { const s = String(v ?? '').trim(); return /^\d{5,6}$/.test(s) ? s.padStart(6, '0') : null; };
  let g = { code: '', name: '' };
  for (const r of er) {
    if (r[0] && six(r[1])) g = { code: six(r[1])!, name: String(r[0]).trim() };
    const code = six(r[3]);
    if (!code || !r[2]) continue;
    cargo.push({ code, codeTo: six(r[4]) ?? code, name: String(r[2]).trim(), groupCode: g.code, groupName: g.name });
  }
  console.log(`ETSNG: ${cargo.length} pozitsiya`);

  writeFileSync(`${OUT}/stations.json`, JSON.stringify(stations, null, 1));
  writeFileSync(`${OUT}/sidings.json`, JSON.stringify(sidings, null, 1));
  writeFileSync(`${OUT}/cargo-types.json`, JSON.stringify(cargo, null, 1));
  console.log(`yozildi: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
