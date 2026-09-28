'use client';
/**
 * Yon tomondagi reklama bloki.
 *
 * Mijoz komponenti, chunki javob kim so'raganiga bog'liq: obunachiga reklama
 * ko'rsatilmaydi va buni server sessiyaga qarab hal qiladi. Server komponenti esa
 * ommaviy sahifada sessiyani ko'rmaydi.
 *
 * Uchinchi tomon kodi, pikseli va kuzatuvchisi yo'q: maxfiylik sahifasida "reklama
 * kuzatuvchilari yo'q" deb yozilgan va bu blok shu yozuvni buzmaydi. Hech narsa
 * yuborilmaydi, faqat bitta o'qish so'rovi ketadi.
 *
 * Reklama bo'lmasa hech narsa chizilmaydi: bo'sh ramka sahifani buzadi.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type Ad = { id: string; title: string; body: string | null; imageUrl: string | null; href: string };

export function AdSlot({ placement }: { placement: 'terminal-aside' | 'listing-aside' }) {
  const t = useTranslations('ads');
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ ad: Ad | null }>(`/ads?placement=${placement}`)
      .then((r) => { if (alive) setAd(r.ad); })
      .catch(() => {}); // reklama yo'qligi sahifaning ishiga ta'sir qilmaydi
    return () => { alive = false; };
  }, [placement]);

  if (!ad) return null;
  return (
    <aside className="rounded-2xl border border-line bg-white p-4">
      {/* Yozuv majburiy: reklama reklama sifatida tanilishi kerak */}
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{t('label')}</p>
      <a
        href={ad.href} target="_blank" rel="noopener noreferrer sponsored"
        className="mt-2 block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {ad.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt="" loading="lazy" className="mb-2 w-full rounded-xl object-cover" />
        ) : null}
        <p className="font-semibold text-navy hover:underline">{ad.title}</p>
        {ad.body ? <p className="mt-1 text-sm text-muted">{ad.body}</p> : null}
      </a>
    </aside>
  );
}
