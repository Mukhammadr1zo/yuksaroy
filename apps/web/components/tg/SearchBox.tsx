'use client';
// Qidiruv qatori: bosh sahifada ham, /tg/search da ham shu bitta maydon. Yuborilganda /tg/search?q= (toifa saqlanadi).
// Matn 7-8 raqam bo'lsa, ostida "Vagon qayerda?" qatori chiqadi: vagon qidiruvi kvotadan yeydi, shuning uchun
// u faqat aniq bosilganda (havola yoki yuborish) ishlaydi, yozish paytida hech narsa so'ralmaydi.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, MagnifyingGlassIcon, TrainRegionalIcon } from '@phosphor-icons/react';
import { normalizeWagonNo } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { haptic } from './TgProvider';
import { CARD } from './bits';

export function SearchBox({ initial, cat }: { initial: string; cat?: string }) {
  const router = useRouter();
  const t = useTranslations('tg');
  const [q, setQ] = useState(initial);
  // Faqat raqam va ajratgichlardan iborat matn: normalizeWagonNo harf-so'zli matndan ham raqamlarni terib olardi ("720007 20 vagon"), pullik so'rov bekorga ketardi
  const raw = q.trim();
  const wagon = /^[\d\s.-]+$/.test(raw) ? normalizeWagonNo(raw) : null;
  const ph = t('common.searchPh');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    haptic();
    // Fokus ketadi: klaviatura yopiladi va tab paneli qaytadi (maydon qayta chizilganda focusout kelmasligi mumkin)
    (document.activeElement as HTMLElement | null)?.blur();
    // Bo'sh maydon ?q= yozmaydi: qidiruv ildizi ildizligicha qoladi (Orqaga tugmasi chiqib qolmaydi)
    const qs = [raw ? `q=${encodeURIComponent(raw)}` : '', cat ? `cat=${cat}` : ''].filter(Boolean).join('&');
    router.push(wagon ? `/tg/wagon?no=${wagon}` : `/tg/search${qs ? `?${qs}` : ''}`);
  };
  return (
    <div>
      <form role="search" aria-label={t('home.searchAria')} onSubmit={submit} className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ph} aria-label={ph} enterKeyHint="search" className="min-h-12 w-full text-ellipsis rounded-full border border-field bg-white pl-10 pr-4 text-base text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/25" />
        </label>
        <button type="submit" aria-label={t('home.search')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal text-white active:scale-[0.96]"><ArrowRightIcon size={20} weight="bold" aria-hidden="true" /></button>
      </form>
      {wagon ? (
        <Link data-wagon-suggest href={`/tg/wagon?no=${wagon}`} onClick={() => haptic()} className={`${CARD} mt-2 flex min-h-11 items-center gap-2 px-4 text-sm font-semibold text-teal-ink active:bg-sand`}>
          <TrainRegionalIcon size={20} weight="duotone" aria-hidden="true" />
          <span className="min-w-0 truncate">{t('common.wagonSuggest', { no: wagon })}</span>
          <ArrowRightIcon size={16} className="ml-auto shrink-0" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
