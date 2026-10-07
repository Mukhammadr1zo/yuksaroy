import { REGION_ADJACENCY, REGION_CENTERS, distanceKm, type RegionCode } from '@yuksaroy/domain';

/**
 * Bo'sh natijada taklif qilinadigan viloyat: so'ralgan viloyatdan qo'shnilar bo'ylab
 * halqama-halqa (REGION_ADJACENCY), natijasi bor birinchi halqada markazi eng yaqini.
 *
 * Sanoq chaqiruvchidan o'sha filtrlar bilan keladi, ya'ni havola yana bo'sh sahifaga
 * olib bormaydi. Hech qayerda natija bo'lmasa null: sahifa bu holda havola chizmaydi.
 */
export function nearestRegionWith(from: RegionCode, counts: Partial<Record<string, number>>): { region: RegionCode; total: number } | null {
  const c = REGION_CENTERS[from];
  const km = (r: RegionCode) => distanceKm(c.lat, c.lng, REGION_CENTERS[r].lat, REGION_CENTERS[r].lng);
  const seen = new Set<RegionCode>([from]);
  let ring: RegionCode[] = [from];
  while (ring.length) {
    ring = [...new Set(ring.flatMap((r) => REGION_ADJACENCY[r]))].filter((r) => !seen.has(r));
    ring.forEach((r) => seen.add(r));
    const hit = ring.filter((r) => (counts[r] ?? 0) > 0).sort((a, b) => km(a) - km(b))[0];
    if (hit) return { region: hit, total: counts[hit]! };
  }
  return null;
}
