'use client';
// /map xaritasi: hero bilan bir xil asos (mapStyle), 4 toifa klasterli pin, koridor tasmasi, viloyat qoplamasi, radius doirasi,
// URL holati (kamera c,z: replaceState; filtr: pushState), hover va bosish, mobil pastki panel (peek / half / full),
// hudud chizish (ko'pburchak, ?area= base64url; tashqaridagi obyekt xira va ro'yxatdan chiqadi, API aralashmaydi).
// compact: landing mobil tasmasi (interaktiv emas, bosish -> /map). Nuqtalar /v1/map-objects.geojson dan, 404 bo'lsa bo'sh.
import { LngLatBounds, Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CalendarCheckIcon, CrosshairIcon, ListBulletsIcon, MagnifyingGlassIcon, PolygonIcon, ShippingContainerIcon, TrainIcon, TruckIcon, type Icon } from '@phosphor-icons/react';
import { LISTING_LABELS, REGIONS, REGION_CENTERS, SEARCH_LABELS, chipLabel, distanceKm, formatSom, type PriceUnit, type RegionCode, type SearchLang, type TerminalKind } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { pricePer } from '@/lib/format';
import { MAX_BOUNDS, PIN, STYLE, UZ_BOUNDS, WORKER_URL, addBaseLayers, localize, pinLayers, z } from './mapStyle';
import { addPinIcons } from './pinIcons';
import { FREE_CHIP, KINDS, effective, inArea, materialize, parseState, toParams, withoutChip, type Area, type Kind, type MapState } from './state';

setWorkerUrl(WORKER_URL);

/** /v1/map-objects.geojson xususiyatlari (3-bosqich shartnomasi). */
interface Props {
  id: string; kind: FeatKind; accuracy: 'exact' | 'station' | 'region'; name: string; slug?: string; terminalKind?: string; regionCode: string;
  count?: number; listingKind?: string; deal?: 'RENT' | 'SALE'; priceTiyin?: number; priceUnit?: string; freeToday?: number; fromPriceTiyin?: number;
}
interface Obj { key: string; p: Props; lng: number; lat: number }
type Listed = Obj & { km: number | null };
// @types/geojson pnpm'da ko'tarilmagan: kerakli minimal shakllar shu yerda
type Feat = { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'Point'; coordinates: [number, number] } | { type: 'LineString'; coordinates: [number, number][] } | { type: 'Polygon'; coordinates: [number, number][][] } };
type FC = { type: 'FeatureCollection'; features: Feat[] };
type Filter = NonNullable<Parameters<MLMap['setFilter']>[1]>;

const EMPTY: FC = { type: 'FeatureCollection', features: [] };
/**
 * Xaritadagi belgi turlari: uch toifa + 'siding'. Shahobcha alohida toifa emas, u terminal:
 * foydalanuvchi uchun bir xil belgi, bir xil rang, legendada alohida qatori yo'q. O'z qatlami
 * faqat ma'lumot sababli bor: shahobchalar stansiya bo'yicha guruh bo'lib keladi (aniq
 * koordinata yo'q) va pin ichida soni turadi. Filtr va sanoqda terminal toifasiga qo'shiladi.
 */
const FEAT_KINDS = [...KINDS, 'siding'] as const;
type FeatKind = (typeof FEAT_KINDS)[number];
const catOf = (k: FeatKind): Kind => (k === 'siding' ? 'terminal' : k);
/** Xaritadan katalogga qaytish: har toifaning o'z ochiq sahifasi. */
const CAT_PATH: Record<Kind, string> = { terminal: '/terminals', equipment: '/equipment', truck: '/carriers' };
/** Stansiya yozuvi sayt tiliga ergashadi; nomi yo'q bo'lsa o'zbekchasi qoladi. */
const STATION_NAME: Record<string, string> = { uz: 'name', ru: 'nameRu', en: 'nameEn' };
const SNAP = { peek: '96px', half: '45%', full: '85%' } as const;
const SNAP_K = { peek: 0, half: 0.45, full: 0.85 } as const;
const ORDER = ['peek', 'half', 'full'] as const;
type Snap = (typeof ORDER)[number];
const PIN_STYLE: Record<FeatKind, Parameters<typeof pinLayers>[2]> = {
  terminal: { color: PIN.terminal, halo: true, icon: 'ys-pin-terminal' },
  // Terminal bilan bir xil ko'rinish; ikonka o'rniga stansiyadagi terminallar soni
  siding: { color: PIN.terminal, halo: true, label: true },
  equipment: { color: PIN.equipment, icon: 'ys-pin-equipment' },
  truck: { color: PIN.truck, hollow: true, icon: 'ys-pin-truck' },
};
/** Legenda va toifa tugmalaridagi kichik belgi: pin bilan bir xil rang va shakl (halqa = taxminiy joylashuv). */
const SWATCH: Record<FeatKind, string> = {
  terminal: 'bg-[#FD7B03] ring-1 ring-white', siding: 'bg-[#FD7B03] ring-1 ring-white', equipment: 'bg-navy ring-1 ring-white', truck: 'border-2 border-teal bg-white',
};
// Xaritadagi pin ichidagi belgi bilan bir xil ikonka: rang yolg'iz yetarli emas edi
const KIND_ICON: Record<FeatKind, Icon> = { terminal: ShippingContainerIcon, siding: ShippingContainerIcon, equipment: TrainIcon, truck: TruckIcon };
const ICON_TONE: Record<FeatKind, string> = { terminal: 'text-white', siding: 'text-white', equipment: 'text-white', truck: 'text-teal' };

/** Toifa belgisi: rangli doira va ichida ikonka (legenda, chiplar, ro'yxat uchun bir xil). */
function KindBadge({ kind, className = '' }: { kind: FeatKind; className?: string }) {
  const I = KIND_ICON[kind];
  return (
    <span aria-hidden="true" className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${SWATCH[kind]} ${className}`}>
      <I size={9} weight="bold" className={ICON_TONE[kind]} />
    </span>
  );
}

/** Radius doirasi: 64 nuqtali poligon (turf'siz). */
function circle([lng, lat]: [number, number], km: number, n = 64): [number, number][] {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 110.574;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI; pts.push([lng + (km * Math.cos(a)) / kx, lat + (km * Math.sin(a)) / ky]); }
  return pts;
}
const point = (lng: number, lat: number, properties: Record<string, unknown> = {}): Feat => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } });
const href = (o: Obj) =>
  o.p.kind === 'terminal' ? `/terminals/${o.p.slug}` : o.p.kind === 'equipment' ? `/equipment/${o.p.slug}` : o.p.kind === 'truck' ? `/carriers/${o.p.slug}` : `/terminals?kind=RAIL&q=${encodeURIComponent(o.p.name)}`;
const keyOf = (e: MapLayerMouseEvent) => { const p = e.features?.[0]?.properties; return p ? `${p.kind}:${p.id}` : null; };
const inRegion = (o: Obj, regions: RegionCode[]) => !regions.length || regions.includes(o.p.regionCode as RegionCode);

/** only: faqat shu kalitlar (`kind:id`) chiziladi, masalan do'kon sahifasida tashkilot obyektlari. */
export function MapView({ initial, cards, compact = false, only }: { initial: MapState; cards?: Record<string, ReactNode>; compact?: boolean; only?: string[] }) {
  const locale = useLocale();
  const lang = locale as SearchLang;
  const t = useTranslations('map');
  const tc = useTranslations('catalog');
  const tr = useTranslations('region');
  const tf = useTranslations('filter');
  const th = useTranslations('hubs');
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [objs, setObjs] = useState<Obj[] | null>(null);
  // Kamera holatga kirmaydi: URL yozishda xaritadan olinadi (moveend har safar filtr effektini uyg'otmasin)
  const [s, setS] = useState<MapState>({ ...initial, c: null, z: null });
  const sRef = useRef(s);
  sRef.current = s;
  const eff = useMemo(() => effective(s, lang), [s, lang]);
  const [bounds, setBounds] = useState<LngLatBounds | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const popRef = useRef(false);
  popRef.current = !!(sel ?? hov);
  const [, bump] = useState(0);
  const [snap, setSnap] = useState<Snap>('peek');
  const drag = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const wantFrame = useRef(!initial.c);
  const focusRef = useRef<Obj[]>([]);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  // Chizish: null = chizilmayapti; uchlar [lng, lat]. Xarita hodisalari ref orqali o'qiydi.
  const [draft, setDraft] = useState<Area | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const finishRef = useRef<() => void>(() => {});

  // 1) Xarita: asos, qatlamlar, hodisalar, geojson yuklash
  useEffect(() => {
    if (!el.current) return;
    const map = new MLMap({
      container: el.current, style: STYLE, attributionControl: false,
      center: initial.c ?? [64.6, 41.4], zoom: initial.z ?? 5.3, minZoom: 4.5, maxBounds: MAX_BOUNDS,
      dragRotate: false, pitchWithRotate: false, touchPitch: false, interactive: !compact,
      locale: { 'Map.Title': t('aria'), 'NavigationControl.ZoomIn': t('zoomIn'), 'NavigationControl.ZoomOut': t('zoomOut') },
    });
    map.touchZoomRotate.disableRotation();
    if (!compact) map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    const ctl = new AbortController();
    fetch('/api/v1/map-objects.geojson', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .catch(() => EMPTY)
      .then((d: FC) => {
        if (ctl.signal.aborted) return;
        const keep = only ? new Set(only) : null;
        setObjs(d.features.filter((f) => f.geometry.type === 'Point').map((f) => {
          const p = f.properties as unknown as Props;
          const [lng, lat] = f.geometry.coordinates as [number, number];
          return { key: `${p.kind}:${p.id}`, p, lng: lng!, lat: lat! };
        }).filter((o) => !keep || keep.has(o.key)));
      });

    map.on('load', async () => {
      localize(map, localeRef.current);
      const sym = addBaseLayers(map);
      const none: Filter = ['in', ['get', 'code'], ['literal', []]];
      // Viloyat qoplamasi yo'llar ostida, koridor chizig'i va radius doirasi yozuvlar ostida, pinlar hammasidan ustida
      map.addSource('regions', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'ys-region-fill', type: 'fill', source: 'regions', filter: none, paint: { 'fill-color': PIN.siding, 'fill-opacity': 0.08 } }, 'ys-road');
      map.addLayer({ id: 'ys-region-line', type: 'line', source: 'regions', filter: none, paint: { 'line-color': PIN.siding, 'line-width': 1.5, 'line-opacity': 0.8 } }, sym);
      map.addSource('corridor', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'ys-corridor', type: 'line', source: 'corridor', layout: { 'line-cap': 'round' }, paint: { 'line-color': PIN.siding, 'line-width': 2, 'line-dasharray': [2, 2] } }, sym);
      map.addSource('near', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'ys-near-fill', type: 'fill', source: 'near', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#05979E', 'fill-opacity': 0.07 } }, sym);
      map.addLayer({ id: 'ys-near-line', type: 'line', source: 'near', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#05979E', 'line-width': 1.5 } }, sym);
      // Chizilgan hudud: teal 8% qoplama va kontur, uchlar pinlardan ustida
      map.addSource('area', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'ys-area-fill', type: 'fill', source: 'area', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': PIN.siding, 'fill-opacity': 0.08 } }, sym);
      map.addLayer({ id: 'ys-area-line', type: 'line', source: 'area', filter: ['!=', ['geometry-type'], 'Point'], layout: { 'line-join': 'round' }, paint: { 'line-color': PIN.siding, 'line-width': 2 } }, sym);
      map.addSource('sel', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'ys-sel', type: 'circle', source: 'sel', paint: { 'circle-radius': 15, 'circle-color': 'transparent', 'circle-stroke-width': 3, 'circle-stroke-color': PIN.siding } });
      // Stansiya qatlami: katalog birligi emas, orientir. Shuning uchun klastersiz, bosilmaydi
      // va obyekt pinlari ostida turadi. Faqat rasmiy ro'yxatdagi stansiyalar keladi.
      map.addSource('stations', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'ys-station', type: 'circle', source: 'stations', minzoom: 5.5,
        paint: {
          'circle-radius': z(6, 2, 12, 4), 'circle-color': '#FFFFFF',
          'circle-stroke-width': 1.4, 'circle-stroke-color': '#7C8698', 'circle-opacity': 0.9,
        },
      }, sym);
      map.addLayer({
        id: 'ys-station-label', type: 'symbol', source: 'stations', minzoom: 7.5,
        layout: {
          'text-field': ['coalesce', ['get', STATION_NAME[localeRef.current] ?? 'name'], ['get', 'name']],
          'text-font': ['Montserrat Medium'], 'text-size': z(8, 9, 13, 12),
          'text-offset': [0, 0.85], 'text-anchor': 'top', 'text-padding': 3,
        },
        paint: { 'text-color': '#5A6373', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.3 },
      }, sym);

      // Stansiyalar alohida so'raladi: kamdan-kam o'zgaradi, obyektlardan uzoqroq keshlanadi
      fetch('/api/v1/stations.geojson', { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .catch(() => EMPTY)
        .then((d: FC) => {
          if (ctl.signal.aborted) return;
          (map.getSource('stations') as GeoJSONSource | undefined)?.setData(d);
        });

      await addPinIcons(map);
      // Qatlam tartibi: terminal eng ustida (shahobcha klasterlari ko'p, terminalni yopmasin)
      for (const k of ['siding', 'truck', 'equipment', 'terminal'] as const satisfies readonly FeatKind[]) {
        // lit: klasterda kamida bitta yorug' nuqta bo'lsa klaster ham yorug' (mapStyle CLUSTER_DIM)
        map.addSource(k, { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 12, clusterProperties: { lit: ['+', ['case', ['to-boolean', ['get', 'dim']], 0, 1]] } });
        for (const l of pinLayers(k, k, PIN_STYLE[k])) map.addLayer(l);
        if (compact) continue;
        map.on('click', `${k}-cluster`, async (e) => {
          const f = e.features?.[0];
          if (draftRef.current) return;
          if (!f || f.geometry.type !== 'Point') return;
          const zoom = await (map.getSource(k) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number);
          map.easeTo({ center: f.geometry.coordinates as [number, number], zoom, duration: 500 });
        });
        map.on('click', k, (e) => {
          const key = keyOf(e);
          if (!key || draftRef.current) return;
          setSel(key); setHov(null);
          document.getElementById(`obj-${key}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        map.on('mousemove', k, (e) => { if (draftRef.current) return; const key = keyOf(e); if (key) setHov(key); map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', k, () => { setHov(null); if (!draftRef.current) map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', `${k}-cluster`, () => { if (!draftRef.current) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', `${k}-cluster`, () => { if (!draftRef.current) map.getCanvas().style.cursor = ''; });
      }
      map.addLayer({ id: 'ys-near-dot', type: 'circle', source: 'near', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#002352', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' } });
      map.addLayer({ id: 'ys-area-vertex', type: 'circle', source: 'area', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-stroke-color': PIN.siding } });
      // Bosish: chizish rejimida uch qo'shiladi, aks holda bo'sh joy tanlovni bekor qiladi. Ikki marta bosish chizishni yakunlaydi.
      if (!compact) {
        map.on('click', (e) => {
          if (draftRef.current) return setDraft([...draftRef.current, [e.lngLat.lng, e.lngLat.lat]]);
          if (!map.queryRenderedFeatures(e.point, { layers: [...FEAT_KINDS] }).length) setSel(null);
        });
        map.on('dblclick', (e) => { if (draftRef.current) { e.preventDefault(); finishRef.current(); } });
      }
      // Viloyat poligonlari (/v1/regions.geojson): 404 bo'lsa qoplama yo'q, qolgani ishlayveradi; compact: qoplama chizilmaydi, yuklanmaydi.
      if (!compact) fetch('/api/v1/regions.geojson', { signal: ctl.signal }).then((r) => (r.ok ? r.json() : EMPTY)).catch(() => EMPTY)
        .then((d: FC) => { if (mapRef.current === map) (map.getSource('regions') as GeoJSONSource).setData(d); });
      setBounds(map.getBounds());
      setReady(true);
    });

    // Kamera -> URL (300 ms kechikish) va ko'rinishdagi obyektlar
    let tm = 0;
    map.on('moveend', () => {
      if (compact) return;
      setBounds(map.getBounds());
      window.clearTimeout(tm);
      tm = window.setTimeout(() => {
        const c = map.getCenter();
        window.history.replaceState(null, '', `${window.location.pathname}${toParams({ ...sRef.current, c: [c.lng, c.lat], z: map.getZoom() })}`);
      }, 300);
    });
    map.on('move', () => { if (popRef.current) bump((x) => x + 1); });
    // ponytail: orqaga/oldinga faqat filtrlarni qaytaradi, kamerani emas
    const onPop = () => { const q = new URLSearchParams(window.location.search); setS({ ...parseState((k) => q.get(k) ?? ''), c: null, z: null }); setSel(null); };
    window.addEventListener('popstate', onPop);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el.current);
    return () => { ctl.abort(); window.clearTimeout(tm); window.removeEventListener('popstate', onPop); ro.disconnect(); mapRef.current = null; map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready && mapRef.current) localize(mapRef.current, locale); }, [locale, ready]);

  /** Kadr: fokusdagi obyektlar + koridor markazlari yoki radius doirasi; hech narsa bo'lmasa butun O'zbekiston. */
  const frame = (focus: Obj[], animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const b = new LngLatBounds();
    focus.forEach((o) => b.extend([o.lng, o.lat]));
    eff.area.forEach((c) => b.extend(c));
    if (eff.near) circle(eff.near, eff.radius, 8).forEach((c) => b.extend(c));
    else if (eff.corridor.length) eff.corridor.forEach((r) => b.extend([REGION_CENTERS[r].lng, REGION_CENTERS[r].lat]));
    else if (eff.regions.length && !focus.length) eff.regions.forEach((r) => b.extend([REGION_CENTERS[r].lng, REGION_CENTERS[r].lat]));
    map.fitBounds(b.isEmpty() ? new LngLatBounds(UZ_BOUNDS[0], UZ_BOUNDS[1]) : b, { padding: compact ? 24 : 56, maxZoom: compact ? 9 : 11, duration: animate ? 600 : 0 });
  };

  // Mobil panel balandligi xarita padding'iga: kadr va markazlash ochiq joyga tushadi (hero'dagi usul). Kadr effektidan oldin turadi.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || compact) return;
    const h = el.current?.clientHeight ?? 0;
    const mobile = !window.matchMedia('(min-width: 1024px)').matches;
    map.setPadding({ top: 0, left: 0, right: 0, bottom: mobile ? Math.round(h * Math.min(SNAP_K[snap], 0.45)) || 96 : 0 });
  }, [snap, ready, compact]);

  // 2) Filtrlar -> xarita ma'lumotlari (toifa/viloyat: yashirin; koridor/radius tashqarisi: xira)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !objs) return;
    const focus: Obj[] = [];
    const per: Record<FeatKind, Feat[]> = { terminal: [], siding: [], equipment: [], truck: [] };
    for (const o of objs) {
      // Bugungi bo'sh joy faqat terminalda bo'ladi: chip yoqilganda texnika, avtotransport
      // va stansiya guruhlari tushib qoladi. Bu xiralashtirish emas, yashirish: "bugun bo'sh"
      // toifa kabi qat'iy filtr
      if (!eff.cat.includes(catOf(o.p.kind)) || !inRegion(o, eff.regions)) continue;
      if (eff.free && !(o.p.freeToday ?? 0)) continue;
      const dim = (eff.corridor.length > 0 && !inRegion(o, eff.corridor)) || (eff.near != null && distanceKm(eff.near[1], eff.near[0], o.lat, o.lng) > eff.radius) || (eff.area.length > 0 && !inArea([o.lng, o.lat], eff.area));
      if (!dim) focus.push(o);
      per[o.p.kind].push(point(o.lng, o.lat, { id: o.p.id, kind: o.p.kind, count: o.p.count, dim }));
    }
    focusRef.current = focus;
    for (const k of FEAT_KINDS) (map.getSource(k) as GeoJSONSource).setData({ type: 'FeatureCollection', features: per[k] });
    const filter: Filter = ['in', ['get', 'code'], ['literal', eff.corridor.length ? eff.corridor : eff.regions]];
    map.setFilter('ys-region-fill', filter);
    map.setFilter('ys-region-line', filter);
    (map.getSource('corridor') as GeoJSONSource).setData(eff.corridor.length
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: eff.corridor.map((r) => [REGION_CENTERS[r].lng, REGION_CENTERS[r].lat]) } }
      : EMPTY);
    (map.getSource('near') as GeoJSONSource).setData(eff.near
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(eff.near, eff.radius)] } }, point(eff.near[0], eff.near[1])] }
      : EMPTY);
    if (wantFrame.current) { wantFrame.current = false; frame(focus, false); }
    else setBounds(map.getBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, objs, eff]);

  // Tanlangan pin atrofida halqa
  const byKey = useMemo(() => new Map((objs ?? []).map((o) => [o.key, o])), [objs]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const o = sel ? byKey.get(sel) : null;
    (map.getSource('sel') as GeoJSONSource).setData(o ? point(o.lng, o.lat) : EMPTY);
  }, [sel, ready, byKey]);

  // Hudud qatlami: chizish paytida uchlar va chiziq (3 tadan boshlab ko'pburchak), yakunlangach URL'dagi ko'pburchak
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pts = draft ?? eff.area;
    const feats: Feat[] = draft ? draft.map(([x, y]) => point(x, y)) : [];
    if (pts.length >= 3) feats.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]!]] } });
    else if (pts.length === 2) feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
    (map.getSource('area') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
  }, [draft, eff.area, ready]);
  // Chizish rejimi: kursor, ikki marta bosib yaqinlashtirish o'chadi, Esc bekor qiladi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getCanvas().style.cursor = draft ? 'crosshair' : '';
    if (!draft) return map.doubleClickZoom.enable();
    map.doubleClickZoom.disable();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDraft(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, ready]);

  // 3) Ko'rinishdagi obyektlar, toifa sanoqlari, qaror satri
  const { listed, counts } = useMemo(() => {
    const counts: Record<Kind, number> = { terminal: 0, equipment: 0, truck: 0 };
    const listed: Listed[] = [];
    if (!objs || !bounds) return { listed, counts };
    for (const o of objs) {
      if (!inRegion(o, eff.regions) || !bounds.contains([o.lng, o.lat])) continue;
      if (eff.free && !(o.p.freeToday ?? 0)) continue;
      const km = eff.near ? distanceKm(eff.near[1], eff.near[0], o.lat, o.lng) : null;
      if ((eff.corridor.length && !inRegion(o, eff.corridor)) || (km != null && km > eff.radius) || (eff.area.length && !inArea([o.lng, o.lat], eff.area))) continue;
      counts[catOf(o.p.kind)]++;
      if (eff.cat.includes(catOf(o.p.kind))) listed.push({ ...o, km });
    }
    if (eff.near) listed.sort((a, b) => a.km! - b.km!);
    return { listed, counts };
  }, [objs, bounds, eff]);
  const terms = listed.filter((o) => o.p.kind === 'terminal');
  const cheapest = Math.min(...terms.map((o) => o.p.fromPriceTiyin).filter((n): n is number => n != null));
  const decision = [
    t('decision.objects', { count: listed.length }),
    // Chip yoqilganda bu bo'lak chiqmaydi: filtr allaqachon faqat bo'sh joyi borlarni qoldirgan,
    // ya'ni bu son yuqoridagi "N obyekt ko'rinishda" bilan aynan teng bo'lardi
    !eff.free && terms.length ? tc('decision.freeToday', { count: terms.filter((o) => (o.p.freeToday ?? 0) > 0).length }) : null,
    Number.isFinite(cheapest) ? tc('decision.cheapest', { price: pricePer(cheapest, 'PER_TON', locale) }) : null,
    eff.near && listed[0]?.km != null ? tc('decision.nearest', { km: Math.round(listed[0].km) }) : null,
  ].filter(Boolean).join(tc('decision.separator'));

  /**
   * Katalogga qaytish havolasi: /terminals dagi "Xaritada ko'rish" ning aksi, bir xil paramlar bilan.
   *
   * Ikki holatda havola umuman ko'rsatilmaydi, chunki katalog xaritadagidan boshqa javob berardi:
   *  - chizilgan hudud bor (katalogda ko'pburchak filtri yo'q, ro'yxat jimgina kengayib ketardi);
   *  - "Bugun bo'sh" yoqilgan, lekin terminal toifasi o'chirilgan (xaritada 0 obyekt, katalog esa
   *    to'la ro'yxat ochardi). "bookable" faqat terminal katalogida bor.
   * ponytail: bir nechta toifa yoqilganda terminal katalogi ochiladi (eng katta ro'yxat);
   * har toifaga alohida havola kerak bo'lsa keyin qo'shiladi.
   */
  const listHref = (() => {
    if (eff.area.length) return null;
    if (eff.free && !eff.cat.includes('terminal')) return null;
    // free yoqilganda xaritada ham faqat terminal qoladi, demak havola ham terminal katalogiga
    const path = eff.free || eff.cat.length !== 1 ? '/terminals' : CAT_PATH[eff.cat[0]!];
    const p = new URLSearchParams();
    if (eff.corridorKey) p.set('corridor', eff.corridorKey);
    else if (eff.regions.length) p.set('region', eff.regions.join(','));
    if (eff.near) { p.set('near', `${eff.near[0].toFixed(5)},${eff.near[1].toFixed(5)}`); p.set('radius', String(eff.radius)); }
    if (eff.free) p.set('bookable', '1');
    if (s.q) p.set('q', s.q);
    const q = p.toString().replace(/%2C/g, ',').replace(/%3E/g, '>');
    return q ? `${path}?${q}` : path;
  })();

  const L = SEARCH_LABELS[lang];
  const region = (o: Obj) => L.region[o.p.regionCode as RegionCode] ?? o.p.regionCode;
  const kindLabel = (o: Obj) =>
    o.p.kind === 'terminal' ? L.kind[o.p.terminalKind as TerminalKind] ?? L.category.terminal
    : o.p.kind === 'siding' ? t('siding.count', { count: o.p.count ?? 1 })
    : `${LISTING_LABELS[lang].kind[o.p.listingKind as keyof typeof LISTING_LABELS.uz.kind] ?? L.category[o.p.kind]}${o.p.deal ? ` · ${L.deal[o.p.deal]}` : ''}`;
  const priceLine = (o: Obj) => {
    if (o.p.kind === 'terminal') {
      return [
        o.p.freeToday != null ? (o.p.freeToday > 0 ? t('popup.freeToday', { count: o.p.freeToday }) : t('popup.noSlots')) : null,
        o.p.fromPriceTiyin != null ? t('popup.from', { price: pricePer(o.p.fromPriceTiyin, 'PER_TON', locale) }) : null,
      ].filter(Boolean).join(' · ');
    }
    if (o.p.kind === 'siding') return '';
    if (o.p.priceTiyin == null) return t('popup.onRequest');
    const u = o.p.priceUnit as PriceUnit | undefined;
    return `${formatSom(o.p.priceTiyin)}${u && u !== 'TOTAL' ? ` ${LISTING_LABELS[lang].priceUnit[u]}` : ''}`;
  };

  // 4) Filtr o'zgarishi: holat + pushState (kamera xaritadan), kerak bo'lsa kadr
  const apply = (next: MapState, refit = false) => {
    wantFrame.current = refit;
    setS(next); setSel(null);
    const map = mapRef.current;
    const c = map?.getCenter();
    window.history.pushState(null, '', `${window.location.pathname}${toParams({ ...next, c: c ? [c.lng, c.lat] : null, z: map?.getZoom() ?? null })}`);
  };
  const toggle = (k: Kind) => {
    const on = eff.cat.includes(k);
    if (on && eff.cat.length === 1) return; // oxirgi toifa o'chmaydi (bo'sh = hammasi)
    const cat = on ? eff.cat.filter((x) => x !== k) : [...eff.cat, k];
    apply({ ...materialize(s, eff), cat: cat.length === KINDS.length ? [] : cat });
  };
  const locate = () => {
    if (eff.near) return apply({ ...materialize(s, eff), near: null, radius: 0 }, true);
    if (!navigator.geolocation) return setGeoErr(tc('nearMe.err.unsupported'));
    setBusy(true); setGeoErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); apply({ ...materialize(s, eff), near: [pos.coords.longitude, pos.coords.latitude], radius: 30 }, true); },
      () => { setBusy(false); setGeoErr(tc('nearMe.err.denied')); },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  };
  // Chizish: ikki marta bosishda bir nuqta 2-3 marta keladi, ketma-ket takrorlar 4 xonaga yaxlitlab tashlanadi
  const finishDraw = () => {
    const pts = (draftRef.current ?? []).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)] as [number, number]).filter((p, i, a) => !i || p[0] !== a[i - 1]![0] || p[1] !== a[i - 1]![1]);
    setDraft(null);
    if (pts.length >= 3) apply({ ...materialize(s, eff), area: pts }, true);
  };
  finishRef.current = finishDraw;
  const startDraw = () => { setDraft([]); setSel(null); setSnap('peek'); };
  const clearArea = () => apply({ ...materialize(s, eff), area: [] }, true);
  const onHandleUp = (e: React.PointerEvent) => {
    const y0 = drag.current;
    drag.current = null;
    if (y0 == null) return;
    const dy = e.clientY - y0;
    const i = ORDER.indexOf(snap);
    setSnap(dy < -30 ? ORDER[Math.min(i + 1, 2)]! : dy > 30 ? ORDER[Math.max(i - 1, 0)]! : snap === 'peek' ? 'half' : 'peek');
  };

  const popObj = (sel ?? hov) ? byKey.get((sel ?? hov)!) : null;
  // "Mening yonimda" yoqilgan bo'lsa popupda ham masofa turadi: ro'yxatdagi bilan bir xil hisob
  const popKm = popObj && eff.near ? distanceKm(eff.near[1], eff.near[0], popObj.lat, popObj.lng) : null;
  const pos = popObj && mapRef.current ? mapRef.current.project([popObj.lng, popObj.lat]) : null;
  const fade = `transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`;

  if (compact) {
    return (
      <div className="relative h-[300px] overflow-hidden rounded-card border border-line bg-sand">
        <div ref={el} className={`absolute inset-0 ${fade}`} />
        <Link href="/map" aria-label={t('strip.aria')} className="absolute inset-0 z-10">
          <span className="absolute bottom-3 right-3 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">{t('open')}</span>
          <span className="absolute bottom-1.5 left-2.5 font-mono text-[9px] text-muted/80">© OpenStreetMap, © CARTO</span>
        </Link>
      </div>
    );
  }

  const row = (o: Listed) => (
    <div className="flex items-start gap-3 rounded-card border border-line bg-white p-3">
      <KindBadge kind={o.p.kind} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold">{o.p.name}</p>
          {o.km != null ? <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{Math.round(o.km)} km</span> : null}
        </div>
        <p className="text-xs text-muted">{kindLabel(o)} · {region(o)}</p>
        {o.p.kind === 'siding' ? <p className="mt-0.5 text-[11px] text-amber-ink">{t('siding.approx')}</p> : null}
        {priceLine(o) ? <p className="mt-1 font-mono text-xs text-navy tabular-nums">{priceLine(o)}</p> : null}
      </div>
      <Link href={href(o)} className="shrink-0 text-xs font-semibold text-teal-ink hover:text-navy">{o.p.kind === 'siding' ? t('siding.open') : t('popup.open')}</Link>
    </div>
  );

  return (
    // div, main emas: bu komponent bosh sahifada, do'kon sahifasida va xarita sahifasida
    // chiziladi. Birinchi ikkisida qobiqning o'z <main id="main"> i bor, ya'ni bu yerda main
    // bo'lsa ikkita main bir-birining ichiga tushardi va id ham takrorlanardi.
    // Xarita sahifalarida main o'sha sahifaning o'zida turadi.
    <div className="ys-map relative flex min-h-0 flex-1 lg:[--sheet:0px]" style={{ '--sheet': SNAP[snap] } as CSSProperties}>
      {/* Panel: lg da chap ustun (400px), telefonda pastki varaq (peek / half / full) */}
      <section
        aria-label={t('list.aria')}
        className="absolute inset-x-0 bottom-0 z-20 flex h-(--sheet) flex-col rounded-t-[20px] border-t border-line bg-white transition-[height] duration-300 ease-(--ease-out-quart) lg:static lg:h-auto lg:w-[400px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0"
      >
        <div className="lg:hidden">
          <button
            type="button" aria-label={t('sheet.handle')}
            onPointerDown={(e) => { drag.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerUp={onHandleUp}
            className="mx-auto block h-6 w-16 touch-none cursor-grab before:mx-auto before:mt-2.5 before:block before:h-1.5 before:w-10 before:rounded-full before:bg-line before:content-['']"
          />
          <p className="line-clamp-2 px-4 pb-2 font-mono text-sm text-navy tabular-nums">{decision}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          <form
            onSubmit={(e) => { e.preventDefault(); apply({ ...s, q: String(new FormData(e.currentTarget).get('q') ?? '').trim(), region: '', corridor: '', near: null, radius: 0, free: false, cat: [] }, true); }}
            className="mx-4 mt-4 flex items-center gap-2 rounded-full border border-line bg-white p-1 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/25"
          >
            <MagnifyingGlassIcon size={18} weight="regular" aria-hidden="true" className="ml-2 shrink-0 text-muted" />
            <input key={s.q} name="q" type="search" defaultValue={s.q} placeholder={t('search.placeholder')} aria-label={t('search.aria')} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted/70" />
            <button className="shrink-0 rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-ink">{t('search.submit')}</button>
          </form>

          {eff.chips.length || eff.unresolved.length ? (
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
              {eff.chips.map((c) => {
                const label = chipLabel(c, lang);
                return (
                  <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-teal-ink">
                    {label}
                    <button type="button" aria-label={tc('chips.remove', { label })} onClick={() => apply(withoutChip(s, eff, c), true)} className="rounded-full px-1.5 leading-none hover:bg-teal/15">×</button>
                  </span>
                );
              })}
              {eff.unresolved.length ? <span className="text-xs text-muted">{tc('chips.unresolved', { words: eff.unresolved.join(', ') })}</span> : null}
            </div>
          ) : null}

          <div role="group" aria-label={t('catAria')} className="flex flex-wrap gap-1.5 px-4 pt-3">
            {KINDS.map((k) => {
              const on = eff.cat.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => toggle(k)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink/80 hover:border-teal hover:text-teal-ink'}`}>
                  <KindBadge kind={k} />
                  {t(`cat.${k}`)}
                  <span className={`font-mono tabular-nums ${on ? 'text-white/70' : 'text-muted'}`}>{counts[k]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 px-4 pt-3">
            <select
              value={eff.regions.length === 1 ? eff.regions[0] : ''}
              onChange={(e) => apply({ ...materialize(s, eff), region: e.target.value, corridor: '' }, true)}
              aria-label={tf('region.all')}
              className="min-w-0 flex-1 rounded-xl border border-field bg-white px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25"
            >
              <option value="">{tf('region.all')}</option>
              {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
            </select>
            <button
              type="button" onClick={locate} disabled={busy}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${eff.near ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white text-ink/80 hover:border-teal hover:text-teal-ink'}`}
            >
              <CrosshairIcon size={16} weight="regular" aria-hidden="true" />
              {busy ? tc('nearMe.busy') : eff.near ? tc('nearMe.active', { radius: eff.radius }) : tc('nearMe.idle')}
            </button>
            {/* Yorliq domen lug'atidan (chipLabel): chiplar qatori ham, katalog ham shu matnni ko'rsatadi */}
            <button
              type="button" aria-pressed={eff.free}
              onClick={() => apply({ ...materialize(s, eff), free: !eff.free })}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${eff.free ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white text-ink/80 hover:border-teal hover:text-teal-ink'}`}
            >
              <CalendarCheckIcon size={16} weight="regular" aria-hidden="true" />
              {chipLabel(FREE_CHIP, lang)}
            </button>
          </div>
          {geoErr ? <p className="px-4 pt-1 text-xs text-amber-ink">{geoErr}</p> : null}

          {/* Qaror satri va katalogga qaytish havolasi bitta qatorda: katalogdagi tartibning aksi */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-4">
            <p className="hidden font-mono text-sm text-navy tabular-nums lg:block">{decision}</p>
            {listHref ? (
              <Link href={listHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal hover:text-teal-ink">
                <ListBulletsIcon size={16} weight="duotone" className="text-teal" aria-hidden="true" />{th('viewList')}
              </Link>
            ) : null}
          </div>

          {!objs ? <p className="px-4 pt-4 text-sm text-muted">{t('loading')}</p>
          : listed.length === 0 ? (
            <div className="m-4 rounded-card border border-dashed border-line p-8 text-center text-muted">
              <p>{t('empty.title')}</p>
              <button type="button" onClick={() => frame(focusRef.current, true)} className="mt-3 text-sm font-semibold text-teal-ink underline">{t('empty.zoomOut')}</button>
            </div>
          ) : (
            // ponytail: virtualizatsiya yo'q; 1000+ qator bo'lsa qo'shiladi
            <ol className="space-y-3 px-4 pt-3">
              {listed.map((o) => (
                <li key={o.key} id={`obj-${o.key}`} onMouseEnter={() => setHov(o.key)} onMouseLeave={() => setHov(null)} className={`rounded-card ${sel === o.key ? 'ring-2 ring-teal ring-offset-2' : ''}`}>
                  {cards?.[o.key] ?? row(o)}
                  {o.p.accuracy === 'region' ? <p className="mt-1 px-1 text-[11px] text-amber-ink">{t('approxRegion')}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <div className="relative min-w-0 flex-1">
        <div ref={el} className={`absolute inset-0 ${fade}`} />

        {/* Legenda: uch toifa (shahobcha terminal ichida) + attributsiya (ODbL, CARTO) */}
        <ul aria-label={t('legend.aria')} className="pointer-events-none absolute bottom-[calc(var(--sheet)+12px)] left-3 z-10 flex max-w-[calc(100%-80px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-white/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted transition-[bottom] duration-300">
          {KINDS.map((k) => <li key={k} className="flex items-center gap-1.5"><KindBadge kind={k} />{t(`legend.${k}`)}</li>)}
          <li className="normal-case tracking-normal text-muted/70">
            <a className="pointer-events-auto hover:text-navy" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
            {', '}
            <a className="pointer-events-auto hover:text-navy" href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a>
          </li>
        </ul>

        {draft ? null : (
          <button type="button" onClick={() => setSnap(snap === 'peek' ? 'half' : 'peek')} className="absolute right-3 top-3 z-10 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold text-navy lg:hidden">
            {snap === 'peek' ? t('sheet.list') : t('sheet.map')}
          </button>
        )}

        {/* Hudud chizish: pill (bo'sh), chizish paneli (nuqta soni, Tugatish, Bekor), chizilgan hudud (Tozalash) */}
        <div role="group" aria-label={t('draw.aria')} className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5">
          {draft ? (
            <>
              <span className="rounded-full border border-teal bg-white px-3 py-1.5 font-mono text-sm text-teal-ink tabular-nums">{t('draw.points', { count: draft.length })}</span>
              <button type="button" onClick={finishDraw} disabled={draft.length < 3} className="rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-ink disabled:opacity-50">{t('draw.finish')}</button>
              <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold text-ink/80 hover:border-teal hover:text-teal-ink">{t('draw.cancel')}</button>
              <p className="w-full rounded-card border border-line bg-white/90 px-3 py-1.5 text-xs text-muted sm:w-auto">{t('draw.hint')}</p>
            </>
          ) : eff.area.length ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal bg-teal-soft px-3 py-1.5 text-sm font-semibold text-teal-ink"><PolygonIcon size={16} weight="regular" aria-hidden="true" />{t('draw.active')}</span>
              <button type="button" onClick={clearArea} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold text-ink/80 hover:border-teal hover:text-teal-ink">{t('draw.clear')}</button>
            </>
          ) : (
            <button type="button" onClick={startDraw} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold text-navy transition hover:border-teal hover:text-teal-ink"><PolygonIcon size={16} weight="regular" aria-hidden="true" />{t('draw.start')}</button>
          )}
        </div>

        {popObj && pos ? (
          <div className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-full" style={{ left: Math.min(Math.max(pos.x, 136), (el.current?.clientWidth ?? 400) - 136), top: pos.y - 16 }}>
            <div className="pointer-events-auto rounded-card border border-line bg-white p-3 text-ink">
              <p className="truncate font-bold">{popObj.p.name}</p>
              <p className="mt-0.5 text-xs text-muted">{kindLabel(popObj)} · {region(popObj)}</p>
              {priceLine(popObj) ? <p className="mt-1 font-mono text-xs text-navy tabular-nums">{priceLine(popObj)}</p> : null}
              {popKm != null ? <p className="mt-1 font-mono text-xs tabular-nums text-muted">{t('popup.distance', { km: Math.round(popKm) })}</p> : null}
              {popObj.p.accuracy !== 'exact' ? <p className="mt-1 text-[11px] text-amber-ink">{popObj.p.accuracy === 'station' ? t('siding.approx') : t('approxRegion')}</p> : null}
              {sel ? <Link href={href(popObj)} className="mt-2 inline-block text-sm font-semibold text-teal-ink hover:text-navy">{popObj.p.kind === 'siding' ? t('siding.open') : t('popup.open')} →</Link> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
