'use client';
import { useState } from 'react';
import { StationSearch, type StationPick } from '@/components/catalog/StationSearch';

/** GET-filtr formasi uchun stansiya combobox (yashirin input name="station" = stansiya id). */
export function StationFilter({ initial, name = 'station' }: { initial: StationPick | null; name?: string }) {
  const [v, setV] = useState<StationPick | null>(initial);
  return <StationSearch value={v} onChange={setV} name={name} placeholder="Stansiya" />;
}
