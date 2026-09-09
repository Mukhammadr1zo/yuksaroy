/* eslint-disable no-console */
/**
 * RailNetwork3D uchun ma'lumot (8.4): RailMap PostGIS (yo'llar, MTU chegaralari) + YukSaroy DB (stansiya koordinatalari, pilot terminallar)
 *   → apps/web/public/data/railmap.min.json   (3D sahna, ≈100 KB gz)
 *   → apps/web/public/img/railmap-poster.svg  (mobil / reduced-motion / WebGL'siz fallback)
 *
 *   pnpm --filter @yuksaroy/api db:build-railmap
 * Proyeksiya: Mercator, markaz (64.6°E, 41.4°N), 1 birlik ≈ 0.43° bo'ylama (mamlakat kengligi ≈ 40 birlik).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const OUT_JSON = resolve(__dirname, '../../../web/public/data/railmap.min.json');
const OUT_SVG = resolve(__dirname, '../../../web/public/img/railmap-poster.svg');
const RAILMAP_URL = process.env.RAILMAP_DATABASE_URL ?? 'postgresql://uzrail:uzrail_dev_password@localhost:5433/uzrailmap';

const CX = 64.6, CY = 41.4, S = 40 / (73.2 - 56.0);
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const MY = merc(CY);
const r2 = (n: number) => Math.round(n * 100) / 100;
/** [lon, lat] → [x, y] (y shimolga o'sadi; 3D da z = -y) */
const proj = ([lon, lat]: [number, number]): [number, number] => [r2((lon - CX) * S), r2(((merc(lat) - MY) * 180) / Math.PI * S)];

type Coord = [number, number];
interface Data {
  v: 1; unit: string;
  outline: Coord[][];
  main: number[][];   // tekis [x0,y0,x1,y1,...]
  branch: number[][];
  stations: { n: string; x: number; y: number }[];
  terminals: { n: string; s: string; st: string; p: number | null; x: number; y: number }[]; // p — eng arzon tonna narxi (tiyin)
  path: Coord[];      // kamera yo'li: Toshkent → Qo'qon → Buxoro → Urganch → Nukus
}

const flat = (line: Coord[]) => line.flatMap((c) => proj(c));

async function main() {
  const rm = new PrismaClient({ datasourceUrl: RAILMAP_URL });
  const ys = new PrismaClient();
  try {
    // 1) Yo'llar (OSM: main/branch), soddalashtirilgan
    const lines = await rm.$queryRawUnsafe<Array<{ usage: string; g: string }>>(
      `SELECT usage::text AS usage, ST_AsGeoJSON(ST_Simplify(geometry, 0.004)) AS g FROM lines WHERE deleted_at IS NULL AND usage IN ('main','branch')`,
    );
    const main: number[][] = [], branch: number[][] = [];
    for (const l of lines) {
      const geom = JSON.parse(l.g) as { type: string; coordinates: Coord[][] | Coord[] };
      const parts = geom.type === 'MultiLineString' ? (geom.coordinates as Coord[][]) : [geom.coordinates as Coord[]];
      for (const p of parts) if (p.length >= 2) (l.usage === 'main' ? main : branch).push(flat(p));
    }
    // Poster uchun yanada sodda
    const posterLines = await rm.$queryRawUnsafe<Array<{ g: string }>>(
      `SELECT ST_AsGeoJSON(ST_Simplify(geometry, 0.02)) AS g FROM lines WHERE deleted_at IS NULL AND usage = 'main'`,
    );
    // 2) Mamlakat konturi = 6 MTU chegarasi birlashmasi
    const [{ g: outlineG }] = await rm.$queryRawUnsafe<Array<{ g: string }>>(`SELECT ST_AsGeoJSON(ST_Simplify(ST_Union(boundary), 0.02)) AS g FROM mtu`);
    const og = JSON.parse(outlineG) as { type: string; coordinates: Coord[][][] | Coord[][] };
    const polys = og.type === 'MultiPolygon' ? (og.coordinates as Coord[][][]) : [og.coordinates as Coord[][]];
    const outline = polys.map((poly) => poly[0]!.map(proj)); // faqat tashqi halqalar

    // 3) Stansiya va terminallar (YukSaroy DB)
    const st = await ys.station.findMany({ where: { lat: { not: null } }, select: { id: true, nameUz: true, nameRu: true, lat: true, lng: true } });
    const stations = st.map((s) => { const [x, y] = proj([s.lng!, s.lat!]); return { n: s.nameUz, x, y }; });
    const now = new Date();
    const tm = await ys.terminal.findMany({
      where: { status: 'ACTIVE' },
      select: { name: true, slug: true, lat: true, lng: true, station: { select: { lat: true, lng: true, nameUz: true } },
        tariffs: { where: { serviceCode: { in: ['LOAD', 'UNLOAD'] }, unit: 'PER_TON', cargoGroupCode: null, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] }, select: { priceTiyin: true } } },
    });
    const terminals = tm.flatMap((t) => {
      const lng = t.lng ?? t.station.lng, lat = t.lat ?? t.station.lat; if (lng == null || lat == null) return [];
      const [x, y] = proj([lng, lat]);
      const p = t.tariffs.length ? Math.min(...t.tariffs.map((x) => Number(x.priceTiyin))) : null;
      return [{ n: t.name, s: t.slug, st: t.station.nameUz, p, x, y }];
    });

    // 4) Kamera yo'li
    const find = (re: RegExp) => st.find((s) => re.test(s.nameRu ?? '') || re.test(s.nameUz));
    const path = [/^Ташкент$/, /^Коканд/, /^Бухара/, /^Ургенч/, /^Нукус/].map((re) => find(re)).filter(Boolean).map((s) => proj([s!.lng!, s!.lat!]));

    const data: Data = { v: 1, unit: 'mercator·40/17.2°', outline, main, branch, stations, terminals, path };
    mkdirSync(resolve(OUT_JSON, '..'), { recursive: true });
    const json = JSON.stringify(data);
    writeFileSync(OUT_JSON, json);

    // 5) Poster SVG (2D): kontur + asosiy yo'llar + stansiyalar + terminallar
    const all = [...outline.flat(), ...stations.map((s) => [s.x, s.y] as Coord)];
    const minX = Math.min(...all.map((c) => c[0])) - 1, maxX = Math.max(...all.map((c) => c[0])) + 1;
    const minY = Math.min(...all.map((c) => c[1])) - 1, maxY = Math.max(...all.map((c) => c[1])) + 1;
    const Y = (y: number) => r2(maxY - y + minY); // SVG y pastga
    const pl = (pts: Coord[]) => pts.map(([x, y]) => `${x},${Y(y)}`).join(' ');
    const r1 = (c: Coord): Coord => [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10];
    const len = (p: Coord[]) => p.reduce((s, c, i) => (i ? s + Math.hypot(c[0] - p[i - 1]![0], c[1] - p[i - 1]![1]) : 0), 0);
    // Poster: mayda OSM parchalari (< 0.3 birlik ≈ 13 km) tashlanadi, 1 kasr — hajm 5× kichik
    const posterPaths = posterLines
      .flatMap((l) => { const g = JSON.parse(l.g) as { type: string; coordinates: Coord[][] | Coord[] }; return (g.type === 'MultiLineString' ? (g.coordinates as Coord[][]) : [g.coordinates as Coord[]]).map((p) => p.map(proj)); })
      .filter((p) => len(p) >= 0.3).map((p) => p.map(r1));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(minX)} ${r2(minY)} ${r2(maxX - minX)} ${r2(maxY - minY)}" preserveAspectRatio="xMidYMid slice">
<rect x="${r2(minX)}" y="${r2(minY)}" width="${r2(maxX - minX)}" height="${r2(maxY - minY)}" fill="#122A44"/>
<g fill="#0D3A4A" stroke="#1E4A5E" stroke-width="0.12">${outline.map((o) => `<polygon points="${pl(o)}"/>`).join('')}</g>
<g fill="none" stroke="#0E9384" stroke-width="0.09" stroke-opacity="0.75" stroke-linecap="round" stroke-linejoin="round">${posterPaths.map((p) => `<polyline points="${pl(p)}"/>`).join('')}</g>
<g fill="#F6F1E7" fill-opacity="0.85">${stations.map((s) => `<circle cx="${s.x}" cy="${Y(s.y)}" r="0.12"/>`).join('')}</g>
<g fill="#C77E1E">${terminals.map((t) => `<circle cx="${t.x}" cy="${Y(t.y)}" r="0.3"/><circle cx="${t.x}" cy="${Y(t.y)}" r="0.7" fill="none" stroke="#C77E1E" stroke-width="0.08" stroke-opacity="0.6"/>`).join('')}</g>
</svg>`;
    mkdirSync(resolve(OUT_SVG, '..'), { recursive: true });
    writeFileSync(OUT_SVG, svg);

    // 6) Vektor xarita (SVG, landing): soddaroq yo'llar, SVG koordinatalar (y pastga), 1 kasr. ~10 k nuqta.
    // OSM parchalari (11 k) avval birlashtiriladi (LineMerge), keyin soddalashtiriladi — uzluksiz yo'llar, kam path
    const svgLines = await rm.$queryRawUnsafe<Array<{ usage: string; g: string }>>(
      `SELECT usage::text AS usage, ST_AsGeoJSON(ST_Simplify(ST_LineMerge(ST_Union(geometry)), CASE WHEN usage='main' THEN 0.006 ELSE 0.015 END)) AS g
       FROM lines WHERE deleted_at IS NULL AND usage IN ('main','branch') GROUP BY usage`,
    );
    const K = 40, OX = minX, OY = maxY;
    const sx = (x: number) => Math.round((x - OX) * K * 10) / 10, sy = (y: number) => Math.round((OY - y) * K * 10) / 10;
    const d = (pts: Coord[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)} ${sy(y)}`).join('');
    const svgMain: string[] = [], svgBranch: string[] = [];
    for (const l of svgLines) {
      const geom = JSON.parse(l.g) as { type: string; coordinates: Coord[][] | Coord[] };
      const parts = geom.type === 'MultiLineString' ? (geom.coordinates as Coord[][]) : [geom.coordinates as Coord[]];
      for (const p of parts) { if (p.length < 2) continue; const pp = p.map(proj); if (len(pp) < 0.04) continue; (l.usage === 'main' ? svgMain : svgBranch).push(d(pp)); }
    }
    const svgData = {
      w: Math.round((maxX - minX) * K), h: Math.round((maxY - minY) * K),
      outline: outline.map((ring) => d(ring) + 'Z'),
      main: svgMain, branch: svgBranch,
      stations: stations.map((s) => [sx(s.x), sy(s.y), s.n] as [number, number, string]),
      terminals: terminals.map((t) => ({ n: t.n, st: t.st, s: t.s, p: t.p, x: sx(t.x), y: sy(t.y) })),
      path: path.map(([x, y]) => [sx(x), sy(y)]),
    };
    const OUT_SVG_JSON = resolve(OUT_JSON, '../railmap-svg.json');
    writeFileSync(OUT_SVG_JSON, JSON.stringify(svgData));
    console.log(`railmap-svg.json: ${(JSON.stringify(svgData).length / 1024).toFixed(0)} KB, main ${svgMain.length} / branch ${svgBranch.length} path, viewBox ${svgData.w}×${svgData.h}`);

    // 7) Real xarita (MapLibre GL): GeoJSON lon/lat — yo'llar (usage bo'yicha bitta MultiLineString), stansiyalar, terminallar; kamera yo'li lon/lat
    const geoLines = await rm.$queryRawUnsafe<Array<{ usage: string; g: string }>>(
      `SELECT usage::text AS usage, ST_AsGeoJSON(ST_Simplify(ST_LineMerge(ST_Union(geometry)), 0.003), 4) AS g
       FROM lines WHERE deleted_at IS NULL AND usage IN ('main','branch') GROUP BY usage`,
    );
    const features: object[] = geoLines.map((l) => ({ type: 'Feature', properties: { kind: l.usage }, geometry: JSON.parse(l.g) }));
    for (const s of st) if (s.lat != null && s.lng != null) features.push({ type: 'Feature', properties: { kind: 'station', name: s.nameUz }, geometry: { type: 'Point', coordinates: [Math.round(s.lng * 1e5) / 1e5, Math.round(s.lat * 1e5) / 1e5] } });
    const realTerminals = tm.flatMap((t) => {
      const lng = t.lng ?? t.station.lng, lat = t.lat ?? t.station.lat; if (lng == null || lat == null) return [];
      const p = t.tariffs.length ? Math.min(...t.tariffs.map((x) => Number(x.priceTiyin))) : null;
      return [{ n: t.name, st: t.station.nameUz, s: t.slug, p, lng, lat }];
    });
    const pathLL = [/^Ташкент$/, /^Коканд/, /^Бухара/, /^Ургенч/, /^Нукус/].map((re) => find(re)).filter(Boolean).map((s) => [s!.lng!, s!.lat!]);
    const OUT_GEO = resolve(OUT_JSON, '../railmap.geojson');
    writeFileSync(OUT_GEO, JSON.stringify({ type: 'FeatureCollection', features }));
    writeFileSync(resolve(OUT_JSON, '../railmap-real.json'), JSON.stringify({ terminals: realTerminals, path: pathLL }));
    console.log(`railmap.geojson: ${(JSON.stringify({ features }).length / 1024).toFixed(0)} KB (${features.length} feature), railmap-real.json: terminal ${realTerminals.length}, yo'l ${pathLL.length}/5`);

    const pts = main.reduce((n, l) => n + l.length / 2, 0) + branch.reduce((n, l) => n + l.length / 2, 0);
    console.log(`railmap.min.json: ${(json.length / 1024).toFixed(0)} KB, yo'llar main ${main.length} / branch ${branch.length} (${pts} nuqta), kontur ${outline.length} poligon, stansiya ${stations.length}, terminal ${terminals.length}, kamera yo'li ${path.length}/5`);
    console.log(`railmap-poster.svg: ${(svg.length / 1024).toFixed(0)} KB`);
  } finally {
    await rm.$disconnect(); await ys.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
