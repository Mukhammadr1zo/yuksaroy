/**
 * Obyektlarga viloyat kodini qo'yadi va shahobcha yo'llarga taqribiy koordinata beradi.
 * Manba: prisma/seed/data/uz-regions.geojson (geoBoundaries gbOpen UZB ADM1, OpenStreetMap, ODbL 1.0).
 * Shahobcha yo'lning o'z koordinatasi reestrda yo'q, shuning uchun u tutashgan joy nuqtasidan olinadi.
 * Bir marta ishlatiladi: `pnpm --filter @yuksaroy/api backfill:region`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Ring = [number, number][];
interface RegionFeature {
  properties: { code: string; name: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

const regions: RegionFeature[] = JSON.parse(
  readFileSync(resolve(__dirname, 'data/uz-regions.geojson'), 'utf8'),
).features;

/** Nur usuli: nuqta ko'pburchak ichidami. */
function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Polygon: birinchi halqa tashqi chegara, qolganlari teshik. */
function inPolygon(lng: number, lat: number, poly: number[][][]): boolean {
  if (!inRing(lng, lat, poly[0] as Ring)) return false;
  return !poly.slice(1).some((hole) => inRing(lng, lat, hole as Ring));
}

export function regionOf(lat: number, lng: number): string | null {
  for (const f of regions) {
    const g = f.geometry;
    const hit =
      g.type === 'Polygon'
        ? inPolygon(lng, lat, g.coordinates as number[][][])
        : (g.coordinates as number[][][][]).some((poly) => inPolygon(lng, lat, poly));
    if (hit) return f.properties.code;
  }
  return null;
}

async function main() {
  // 1. Terminallar: o'z koordinatasi bor
  const terminals = await prisma.terminal.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: { id: true, name: true, lat: true, lng: true },
  });
  let tOk = 0;
  for (const t of terminals) {
    const code = regionOf(t.lat!, t.lng!);
    if (code) {
      await prisma.terminal.update({ where: { id: t.id }, data: { regionCode: code } });
      tOk++;
    } else {
      console.warn(`viloyat topilmadi: terminal ${t.name}`);
    }
  }

  // 2. Temir yo'l terminallari (shahobcha yo'llar): koordinata tutashgan stansiyadan, viloyat shundan
  const stations = await prisma.station.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true },
  });
  const byStation = new Map(stations.map((s) => [s.id, s]));
  // Faqat egasiz reestr qatorlari: egasi bor terminalning koordinatasini u o'zi kiritgan,
  // uni stansiya nuqtasiga surib yuborish aniq joyni yo'qotardi.
  const sidings = await prisma.terminal.findMany({ where: { kind: 'RAIL', orgId: null, stationId: { not: null } }, select: { id: true, stationId: true } });
  let sOk = 0;
  for (const sd of sidings) {
    const st = byStation.get(sd.stationId!);
    if (!st) continue;
    const code = regionOf(st.lat!, st.lng!);
    await prisma.terminal.update({ where: { id: sd.id }, data: { lat: st.lat, lng: st.lng, regionCode: code } });
    if (code) sOk++;
  }

  const counts = await prisma.terminal.groupBy({ by: ['regionCode'], where: { kind: 'RAIL' }, _count: { _all: true }, orderBy: { _count: { regionCode: 'desc' } } });
  console.log(`terminal: ${tOk}/${terminals.length}, shahobcha yo'l: ${sOk}/${sidings.length}`);
  for (const c of counts) console.log(`  ${c.regionCode ?? '(viloyat yo\'q)'}: ${c._count._all}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
