import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGIONS, type RegionCode } from '@yuksaroy/domain';

/**
 * Koordinatadan viloyat kodi.
 *
 * Terminal.regionCode sxemada "koordinatadan hisoblanadi" deb yozilgan edi, lekin uni
 * hech narsa hisoblamasdi: reestrdan kelgan 1711 ta shahobcha yo'lda u bo'sh qolgan va
 * katalogdagi viloyat filtri ularni umuman topmasdi. Xarita esa stansiya koordinatasi
 * bo'yicha guruhlagani uchun o'sha yo'llarni ko'rsataverardi. Natijada xaritada 20 ta
 * ko'rinib, ichiga kirganda "topilmadi" chiqardi.
 *
 * Chegaralar katalog xaritaga beradigan fayldan o'qiladi, ya'ni hisob va xaritadagi
 * chiziq bir xil manbadan. Fayl bir marta o'qiladi va xotirada qoladi (~157 KB).
 */
const REGIONS_FILE = resolve(__dirname, '../../../../prisma/seed/data/uz-regions.geojson');

type Ring = [number, number][];
type Feature = { properties: { code: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] } };

let cache: { code: RegionCode; polys: Ring[][] }[] | null = null;

function load() {
  if (cache) return cache;
  const geo = JSON.parse(readFileSync(REGIONS_FILE, 'utf8')) as { features: Feature[] };
  const valid = new Set<string>(REGIONS);
  cache = geo.features
    .filter((f) => valid.has(f.properties.code))
    .map((f) => ({
      code: f.properties.code as RegionCode,
      polys: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][])),
    }));
  return cache;
}

/** Nuqta halqa ichidami (ray casting). Nuqta [lng, lat] tartibida. */
function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Birinchi halqa tashqi chegara, qolganlari teshik (anklav). */
function inPoly(x: number, y: number, poly: Ring[]): boolean {
  if (!poly.length || !inRing(x, y, poly[0]!)) return false;
  for (let i = 1; i < poly.length; i++) if (inRing(x, y, poly[i]!)) return false;
  return true;
}

/** Koordinata biror viloyatga tushmasa null: taxmin qilinmaydi. */
export function regionOfPoint(lat: number | null | undefined, lng: number | null | undefined): RegionCode | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const r of load()) for (const p of r.polys) if (inPoly(lng, lat, p)) return r.code;
  return null;
}
