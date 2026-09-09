'use client';
// Koordinata tanlash: yorug' xarita (mapStyle), bitta suriladigan belgi. Bosish yoki surish onPick chaqiradi; tashqaridan lat/lng o'zgarsa belgi ko'chadi.
// maplibre-gl faqat brauzerda (window kerak), shuning uchun import useEffect ichida.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { STYLE, WORKER_URL } from '@/components/map/mapStyle';

type Pt = { lat: number; lng: number };
const TASHKENT: Pt = { lat: 41.31, lng: 69.28 };

export function MapPicker({ point, fallback, onPick, className = 'h-64 w-full' }: { point: Pt | null; fallback?: Pt | null; onPick: (p: Pt) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markerRef = useRef<import('maplibre-gl').Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let gone = false;
    const start = point ?? fallback ?? TASHKENT;
    import('maplibre-gl').then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
      if (gone) return;
      setWorkerUrl(WORKER_URL);
      const map = new Map({ container: node, style: STYLE, attributionControl: false, center: [start.lng, start.lat], zoom: point ? 13 : fallback ? 11 : 9, dragRotate: false });
      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
      const marker = new Marker({ color: '#FD7B03', draggable: true }).setLngLat([start.lng, start.lat]).addTo(map);
      const round = (n: number) => Math.round(n * 1e5) / 1e5;
      marker.on('dragend', () => { const p = marker.getLngLat(); pickRef.current({ lat: round(p.lat), lng: round(p.lng) }); });
      map.on('click', (e) => { marker.setLngLat(e.lngLat); pickRef.current({ lat: round(e.lngLat.lat), lng: round(e.lngLat.lng) }); });
      map.getCanvas().style.cursor = 'crosshair';
      mapRef.current = map; markerRef.current = marker;
    });
    return () => { gone = true; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Input'dan yozilgan koordinata: belgi va kadr ergashadi
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current;
    if (!map || !marker || !point) return;
    const cur = marker.getLngLat();
    if (Math.abs(cur.lat - point.lat) < 1e-6 && Math.abs(cur.lng - point.lng) < 1e-6) return;
    marker.setLngLat([point.lng, point.lat]);
    map.easeTo({ center: [point.lng, point.lat], duration: 400 });
  }, [point]);

  return <div ref={el} className={`overflow-hidden rounded-card border border-line bg-sand ${className}`} role="application" aria-label="map" />;
}
