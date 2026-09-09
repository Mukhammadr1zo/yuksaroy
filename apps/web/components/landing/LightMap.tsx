'use client';
// Hero xaritasi: standardrail.com dagi kabi toza yorug' asos (CARTO Positron) va ustida bizning obyektlarimiz.
// Interaktiv, lekin ustida hech qanday tugma yoki qoplama yo'q: sichqoncha bilan suriladi, ikki marta bosish
// yaqinlashtiradi; g'ildirak faqat xarita "ushlangandan" keyin (bosish yoki surish) yaqinlashtiradi, sichqoncha
// xaritadan chiqsa yana sahifani suradi. Telefonda hero xaritasi fon: barmoq sahifani suradi.
// Attributsiya (ODbL, CARTO shartlari) MapHero'da matn qatori sifatida turadi. Yozuvlar sayt tiliga ergashadi.
// Uslub, yo'l qatlamlari va pin qatlamlari components/map/mapStyle.ts da (/map sahifasi bilan umumiy).
import { LngLatBounds, Map as MLMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { FALLBACK, MAX_BOUNDS, PIN, STYLE, WORKER_URL, addBaseLayers, localize, pinLayers } from '@/components/map/mapStyle';

setWorkerUrl(WORKER_URL);

/** /map-objects.geojson javobi: hero uchun faqat nuqta koordinatasi kerak (qolgan xossalar klasterda ishlatilmaydi). */
interface Terminals {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Record<string, unknown> }[];
}

export default function LightMap() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const locale = useLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const t = useTranslations('hero.map');

  useEffect(() => {
    if (!el.current) return;
    const map = new MLMap({
      container: el.current,
      style: STYLE,
      attributionControl: false,
      center: [69.45, 41.15],
      zoom: 8.5, // plitkalarda temir yo'l z8 dan: pastda kadr bo'sh ko'rinardi
      minZoom: 5,
      maxBounds: MAX_BOUNDS,
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      locale: { 'Map.Title': t('aria') },
    });
    map.touchZoomRotate.disableRotation();
    // Sensorli qurilmada xarita fon: barmoq xaritani emas, sahifani suradi
    if (window.matchMedia('(pointer: coarse)').matches) { map.dragPan.disable(); map.touchZoomRotate.disable(); }
    // G'ildirak: xarita ushlangandan keyingina yaqinlashtiradi, chiqib ketganda yana sahifa skrolli
    map.on('mousedown', () => map.scrollZoom.enable());
    el.current.addEventListener('mouseleave', () => map.scrollZoom.disable());
    mapRef.current = map;

    // Foydalanuvchi xaritani surgan bo'lsa, kadr qaytib "sakramaydi"
    let moved = false;
    map.on('movestart', (e) => { if (e.originalEvent) moved = true; });

    // Matn ustuni chapda: xaritaning "ko'rinadigan" qismi o'ngda. Padding xaritaning o'ziga beriladi,
    // shunda kadr ham, klaster bosilganda markazlash ham matn ostiga emas, ochiq joyga tushadi.
    const pad = () => ({
      left: Math.round((el.current?.clientWidth ?? 1200) * (window.innerWidth >= 1024 ? 0.54 : 0.08)) + 32,
      right: 60, top: 70, bottom: 70,
    });
    map.setPadding(pad());
    let bounds: LngLatBounds | null = null;
    const frame = () => {
      if (moved) return;
      const b = bounds ?? new LngLatBounds(FALLBACK[0], FALLBACK[1]);
      map.fitBounds(b, { maxZoom: 9.2, duration: 0 });
    };

    const ctl = new AbortController();
    // Faqat terminal nuqtalari (~2 KB); to'liq /map-objects da 167 ta shahobcha ham bor, ular hero da ishlatilmaydi
    const load = fetch('/api/v1/map-objects.geojson?cat=terminal', { signal: ctl.signal })
      .then((r) => r.json() as Promise<Terminals>)
      .then((d) => {
        if (!d.features?.length) return;
        const b = new LngLatBounds();
        d.features.forEach((f) => b.extend(f.geometry.coordinates));
        bounds = b;
        return d;
      })
      .catch(() => undefined);

    map.on('load', async () => {
      localize(map, localeRef.current);
      addBaseLayers(map, { far: false }); // hero kadri z8+ : uzoq masshtab GeoJSON kerak emas

      const data = await load;
      // Uzoqlashganda yaqin nuqtalar bitta doiraga yig'iladi, ichida soni (standardrail.com kabi)
      map.addSource('terminals', {
        type: 'geojson',
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 12,
        data: data ?? { type: 'FeatureCollection', features: [] },
      });
      for (const l of pinLayers('terminals', 'terminals', { color: PIN.terminal, halo: true })) map.addLayer(l);
      // Doirani bosish: o'sha joyga nuqtalar ajraladigan darajagacha yaqinlashadi
      map.on('click', 'terminals-cluster', async (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const zoom = await (map.getSource('terminals') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number);
        moved = true;
        map.easeTo({ center: f.geometry.coordinates as [number, number], zoom, duration: 500 });
      });
      map.on('mouseenter', 'terminals-cluster', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'terminals-cluster', () => { map.getCanvas().style.cursor = ''; });
      frame();
      ready.current = true;
      setLoaded(true);
    });

    const tm = window.setTimeout(() => setLoaded(true), 5000);
    const ro = new ResizeObserver(() => { map.resize(); map.setPadding(pad()); frame(); });
    ro.observe(el.current);
    return () => { ctl.abort(); window.clearTimeout(tm); ro.disconnect(); ready.current = false; mapRef.current = null; map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Til almashganda yozuvlar joyida almashadi (xarita qayta yuklanmaydi)
  useEffect(() => {
    if (ready.current && mapRef.current) localize(mapRef.current, locale);
  }, [locale]);

  // inline style: maplibre-gl.css dagi `.maplibregl-map{position:relative}` klassni yengadi
  return <div ref={el} style={{ position: 'absolute', inset: 0 }} className={`transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`} />;
}
