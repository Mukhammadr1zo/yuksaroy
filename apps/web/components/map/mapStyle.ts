// Umumiy xarita asosi: hero (LightMap) va /map (MapView) bir xil uslub, yo'l qatlamlari va pin qatlamlarini ishlatadi.
// Bu yerdagi qiymatlar LightMap'dan ko'chirildi, hero ko'rinishi o'zgarmagan.
import type { ExpressionSpecification, LayerSpecification, Map as MLMap } from 'maplibre-gl';

/** CARTO Positron nusxasi, standardrail.com ishlatadigan mapbox light-v11 ranglariga bo'yalgan (public/map/light.json,
 *  scratchpad make-light.cjs bilan yaratilgan). Plitka, glif va sprite hali CARTO'dan; manba almashsa faqat shu fayl o'zgaradi. */
export const STYLE = '/map/light.json';
/** Turbopack ichidagi ESM worker ishlamadi, shuning uchun worker public/maplibre/ dan olinadi */
export const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';
/** O'zbekiston va qo'shnilar: xarita okeanga surilib ketmaydi */
export const MAX_BOUNDS: [[number, number], [number, number]] = [[52, 34.5], [78, 47.5]];
/** Obyekt topilmasa ko'rsatiladigan kadr: pilot hududi. */
export const FALLBACK: [[number, number], [number, number]] = [[68.9, 40.7], [70.1, 41.5]];
/** Butun O'zbekiston kadri (/map bo'sh holati). */
export const UZ_BOUNDS: [[number, number], [number, number]] = [[55.9, 37.1], [73.2, 45.6]];

/**
 * Plitkalarda `name:uz` yo'q (tekshirildi: carto.streets tiles.json). O'zbekiston uchun OSM `name` maydoni
 * o'zi lotin o'zbekcha, `name:latin` ham shu. Ruscha `name:ru`, inglizcha `name_en`.
 */
const NAME: Record<string, ExpressionSpecification> = {
  uz: ['coalesce', ['get', 'name:uz'], ['get', 'name:latin'], ['get', 'name']],
  ru: ['coalesce', ['get', 'name:ru'], ['get', 'name']], // qo'shni davlatlarda `name` kirillcha, translit kerak emas
  en: ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']],
};
const NAMED_LAYERS = new Set(['place', 'water_name', 'waterway', 'transportation_name', 'poi']);

/** Yozuvlar sayt tiliga ergashadi (xarita qayta yuklanmaydi). */
export function localize(map: MLMap, locale: string) {
  const expr = NAME[locale] ?? NAME.uz;
  for (const l of map.getStyle().layers) {
    if (l.type === 'symbol' && NAMED_LAYERS.has(l['source-layer'] ?? '')) map.setLayoutProperty(l.id, 'text-field', expr);
  }
}

export const RAIL = '#002352';
export const ROAD = '#F39C1F'; // MapHero legendasida ham shu rang
const T = { source: 'carto', 'source-layer': 'transportation' } as const;
/** Masshtab bo'yicha chiziqli o'zgarish: z(zoom1, qiymat1, zoom2, qiymat2, ...). */
export const z = (...stops: (number | ExpressionSpecification)[]): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], ...stops];
const major: ExpressionSpecification = ['match', ['get', 'class'], ['motorway', 'trunk'], true, false];
/** Magistral va tarmoq temir yo'li: stansiya parki va shoxobchalar (`service`) alohida, yupqa chiziladi. */
const mainRail: ExpressionSpecification = ['all', ['==', ['get', 'class'], 'rail'], ['!', ['has', 'service']]];
const tunnelFade: ExpressionSpecification = ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 1];

/** Plitkalarda temir yo'l z8 dan, magistral avtoyo'llar z5 dan bor (tekshirildi: z6..z10 plitkalar). */
const LAYERS: LayerSpecification[] = [
  {
    id: 'ys-road', type: 'line', ...T, minzoom: 5,
    filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROAD,
      'line-width': z(5, ['case', major, 1.2, 0.7], 9, ['case', major, 3, 1.8], 13, ['case', major, 5.5, 3.2]),
    },
  },
  {
    id: 'ys-road-minor', type: 'line', ...T, minzoom: 10,
    filter: ['==', ['get', 'class'], 'secondary'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ROAD, 'line-opacity': 0.85, 'line-width': z(10, 1, 14, 2.4) },
  },
  {
    id: 'ys-rail-service', type: 'line', ...T, minzoom: 13, // plitkalarda xizmat yo'llari z13+ dan
    filter: ['all', ['==', ['get', 'class'], 'rail'], ['has', 'service']],
    paint: { 'line-color': RAIL, 'line-opacity': 0.5, 'line-width': z(13, 0.8, 16, 1.8) },
  },
  {
    id: 'ys-rail-case', type: 'line', ...T, minzoom: 8, filter: mainRail,
    paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.9, 'line-width': z(8, 3, 14, 7) },
  },
  {
    id: 'ys-rail', type: 'line', ...T, minzoom: 8, filter: mainRail,
    paint: { 'line-color': RAIL, 'line-opacity': tunnelFade, 'line-width': z(8, 1.4, 14, 3) },
  },
  {
    id: 'ys-rail-dash', type: 'line', ...T, minzoom: 8, filter: mainRail,
    paint: { 'line-color': '#FFFFFF', 'line-width': z(8, 0.8, 14, 1.8), 'line-dasharray': [3, 3] },
  },
];
/**
 * Uzoq masshtab (z<8) uchun butun O'zbekiston tarmog'i: CARTO plitkalarida temir yo'l faqat z8 dan bor.
 * Manba: OSM (Overpass, railway=rail, usage=main|branch, ODbL), 100 m gacha soddalashtirilgan, ~250 KB.
 * standardrail.com ham shu ikki qavatli usulni ishlatadi (uzoq uchun kichik GeoJSON, yaqin uchun plitka).
 */
const FAR_RAIL_URL = '/data/uz-rail-far.geojson';
const F = { source: 'uz-rail-far', maxzoom: 8 } as const;
const FAR_LAYERS: LayerSpecification[] = [
  { id: 'ys-far-rail-case', type: 'line', ...F, paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.9, 'line-width': z(4, 2, 8, 3.2) } },
  { id: 'ys-far-rail', type: 'line', ...F, paint: { 'line-color': RAIL, 'line-width': z(4, 0.9, 8, 1.5), 'line-opacity': ['case', ['==', ['get', 'u'], 'b'], 0.7, 1] } },
  { id: 'ys-far-rail-dash', type: 'line', ...F, minzoom: 6, paint: { 'line-color': '#FFFFFF', 'line-width': z(6, 0.5, 8, 0.9), 'line-dasharray': [3, 3] } },
];

/**
 * Yo'llar yozuvlar ostida: birinchi symbol qatlamidan oldin qo'yiladi. Qaytaradi: shu symbol id (keyingi qatlamlar uchun).
 * `far: false` uzoq masshtab GeoJSON manbasini (35 KB gzip) qo'shmaydi: hero kadri z8 dan yuqori, u yerda plitka yetadi.
 */
export function addBaseLayers(map: MLMap, o: { far?: boolean } = {}): string | undefined {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  for (const l of LAYERS) map.addLayer(l, firstSymbol);
  if (o.far !== false) {
    map.addSource('uz-rail-far', { type: 'geojson', data: FAR_RAIL_URL });
    for (const l of FAR_LAYERS) map.addLayer(l, firstSymbol);
  }
  return firstSymbol;
}

/**
 * Pin ranglari uch toifa bo'yicha: terminal to'q sariq, texnika navy, avtotransport teal.
 *
 * Shahobcha terminal bilan bir xil rangda, chunki u alohida toifa emas (katalogda ham
 * shunday). Farqni shakl bildiradi: to'la pin = aniq joy, ichi bo'sh halqa va ichidagi
 * raqam = stansiya bo'yicha taxminiy joy va o'sha stansiyadagi yo'llar soni.
 *
 * Ilgari shahobcha teal, avtotransport esa terminal bilan bir xil sariq edi: xaritada
 * bitta sariq nuqta ikki toifa taassurotini berardi.
 */
export const PIN = { terminal: '#FD7B03', siding: '#FD7B03', equipment: '#002352', truck: '#077F84' } as const;

/** Koridordan tashqaridagi obyekt xira (dim xususiyati). Klaster: ichida yorug' nuqta bo'lmasa xira (lit, clusterProperties). */
const DIM: ExpressionSpecification = ['case', ['to-boolean', ['get', 'dim']], 0.3, 1];
const CLUSTER_DIM: ExpressionSpecification = ['case', ['>', ['coalesce', ['get', 'lit'], 1], 0], 1, 0.3];
const single: ExpressionSpecification = ['!', ['has', 'point_count']];

/**
 * Klasterli pin qatlamlari: halo (ixtiyoriy), nuqta, klaster doirasi, klaster soni.
 * hollow: oq ichli halqa (taxminiy joylashuv: stansiya yoki viloyat markazi); label: nuqta ichida `count`.
 * Hero: pinLayers('terminals', 'terminals', { color: PIN.terminal, halo: true }) avvalgi bilan bir xil.
 */
export function pinLayers(prefix: string, source: string, o: { color: string; halo?: boolean; hollow?: boolean; label?: boolean; icon?: string }): LayerSpecification[] {
  const layers: LayerSpecification[] = [];
  if (o.halo) layers.push({
    id: `${prefix}-halo`, type: 'circle', source, filter: single,
    paint: { 'circle-radius': z(5, 10, 10, 22), 'circle-color': o.color, 'circle-opacity': ['*', 0.15, DIM] },
  });
  layers.push({
    id: prefix, type: 'circle', source, filter: single,
    paint: o.hollow
      ? { 'circle-radius': z(5, 7, 10, 11), 'circle-color': '#FFFFFF', 'circle-stroke-width': 2.5, 'circle-stroke-color': o.color, 'circle-opacity': DIM, 'circle-stroke-opacity': DIM }
      : { 'circle-radius': z(5, 5, 10, 9), 'circle-color': o.color, 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF', 'circle-opacity': DIM, 'circle-stroke-opacity': DIM },
  });
  // Rang yetarli emas edi: doira ichida toifa belgisi (konteyner, vagon, fura, relslar)
  if (o.icon) layers.push({
    id: `${prefix}-icon`, type: 'symbol', source, filter: single,
    layout: { 'icon-image': o.icon, 'icon-size': z(5, 0.5, 10, 0.8), 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    paint: { 'icon-opacity': DIM },
  });
  if (o.label) layers.push({
    id: `${prefix}-label`, type: 'symbol', source, filter: ['all', single, ['has', 'count']],
    layout: { 'text-field': ['to-string', ['get', 'count']], 'text-font': ['Montserrat Medium'], 'text-size': z(5, 9, 10, 11), 'text-allow-overlap': true },
    paint: { 'text-color': o.color, 'text-opacity': DIM },
  });
  layers.push({
    id: `${prefix}-cluster`, type: 'circle', source, filter: ['has', 'point_count'],
    paint: {
      'circle-color': o.color, 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF',
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23],
      'circle-opacity': CLUSTER_DIM, 'circle-stroke-opacity': CLUSTER_DIM,
    },
  });
  layers.push({
    id: `${prefix}-cluster-count`, type: 'symbol', source, filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Montserrat Medium'], 'text-size': 13, 'text-allow-overlap': true },
    paint: { 'text-color': '#FFFFFF', 'text-opacity': CLUSTER_DIM },
  });
  return layers;
}
