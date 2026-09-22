'use client';
/**
 * E'lon faol bo'lgan zahoti haydovchiga bitta havola: shu viloyatda nechta ochiq yuk bor.
 *
 * Nega kerak: mashina e'loni berilgandan keyin haydovchi kutib qolardi va bozorning
 * ikkinchi tomoni (yuk so'rovlari) borligini bilmasdi. Bu yerda yangi endpoint yo'q,
 * son doskaning o'zi ko'rsatadigan son bilan bir xil.
 *
 * Nol bo'lsa blok umuman chizilmaydi: "0 ta ochiq yuk" hech qanday qaror bermaydi.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SEARCH_LABELS, type RegionCode } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { OwnerListing } from '@/lib/types-kabinet';
import { useLang } from './bits';

export function OpenCargoLink({ l }: { l: OwnerListing | null }) {
  const t = useTranslations('kabinet.listings');
  const lang = useLang();
  const [total, setTotal] = useState(0);
  const ok = !!l && l.kind === 'TRUCK' && l.status === 'ACTIVE';
  const region = l?.regionCode;

  useEffect(() => {
    if (!ok || !region) { setTotal(0); return; }
    // Javob kelguncha odam ro'yxatga o'tib ketishi mumkin: o'chgan komponentga yozilmaydi
    let alive = true;
    api<{ total: number }>(`/market/requests?board=CARGO&from=${region}&limit=1`)
      .then((r) => { if (alive) setTotal(r.total); })
      .catch(() => {});
    return () => { alive = false; };
  }, [ok, region]);

  if (!ok || !region || !total) return null;
  return (
    <Link href={`/cargo?from=${region}`} className="font-semibold text-teal-ink underline underline-offset-4">
      {t('cargoOpen', { region: SEARCH_LABELS[lang].region[region as RegionCode], count: total })}
    </Link>
  );
}
