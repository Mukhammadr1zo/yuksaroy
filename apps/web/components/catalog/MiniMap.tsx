'use client';
// Tafsilot sahifasi xarita ko'rinishi: LightMap bilan bir xil yorug' uslub, bitta yoki bir nechta pin, interaktiv emas.
// maplibre-gl faqat brauzerda yuklanadi (window kerak), shuning uchun import useEffect ichida.
// polygon: viloyat chegarasi (hub sahifasi), teal 8% to'ldirish; ko'p pin bo'lsa Marker o'rniga circle qatlami.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export interface Pin { lat: number; lng: number; color?: string }
export type Poly = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };

export function MiniMap({ pins, zoom = 11, className = 'h-56 w-full', polygon = null }: { pins: Pin[]; zoom?: number; className?: string; polygon?: Poly | null }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || (!pins.length && !polygon)) return;
    let map: import('maplibre-gl').Map | undefined;
    let gone = false;
    import('maplibre-gl').then(({ Map, Marker, LngLatBounds, setWorkerUrl }) => {
      if (gone) return;
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const b = new LngLatBounds();
      pins.forEach((p) => b.extend([p.lng, p.lat]));
      if (polygon) (polygon.type === 'Polygon' ? polygon.coordinates[0] ?? [] : polygon.coordinates.flatMap((r) => r[0] ?? [])).forEach(([x, y]) => b.extend([x!, y!]));
      const first = pins[0] ?? { lng: b.getCenter().lng, lat: b.getCenter().lat };
      map = new Map({ container: node, style: '/map/light.json', interactive: false, attributionControl: false, center: [first.lng, first.lat], zoom });
      if (pins.length > 1 || polygon) map.fitBounds(b, { padding: 32, maxZoom: 12, duration: 0 });
      map.on('load', () => {
        if (!map) return;
        if (polygon) {
          map.addSource('ys-region', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: polygon } });
          map.addLayer({ id: 'ys-region-fill', type: 'fill', source: 'ys-region', paint: { 'fill-color': '#077F84', 'fill-opacity': 0.08 } });
          map.addLayer({ id: 'ys-region-line', type: 'line', source: 'ys-region', paint: { 'line-color': '#077F84', 'line-width': 1.5 } });
        }
        // ponytail: 12 tadan ko'p pin DOM marker o'rniga circle qatlami, rang birinchi pindan
        if (pins.length > 12) {
          map.addSource('ys-pins', { type: 'geojson', data: { type: 'FeatureCollection', features: pins.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) } });
          map.addLayer({ id: 'ys-pins', type: 'circle', source: 'ys-pins', paint: { 'circle-radius': 4, 'circle-color': pins[0]?.color ?? '#FD7B03', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
        }
      });
      if (pins.length <= 12) for (const p of pins) new Marker({ color: p.color ?? '#FD7B03' }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    return () => { gone = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={el} className={`overflow-hidden rounded-card border border-line bg-sand ${className}`} aria-hidden="true" />;
}
