'use client';
// Do'kon xaritasi: MapView compact, faqat tashkilot obyektlari (only = kind:id kalitlari). maplibre faqat brauzerda.
import dynamic from 'next/dynamic';
import type { MapState } from '@/components/map/state';

const MapStrip = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), { ssr: false, loading: () => <div className="h-[300px] rounded-card border border-line bg-sand" /> });
const NO_STATE: MapState = { cat: [], region: '', corridor: '', near: null, radius: 0, q: '', c: null, z: null };

export function OrgMap({ only }: { only: string[] }) {
  return <MapStrip compact initial={NO_STATE} only={only} />;
}
