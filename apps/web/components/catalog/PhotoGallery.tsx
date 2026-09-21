'use client';
/**
 * Rasm galereyasi: asosiy rasm, o'q tugmalari, kichik rasmlar qatori va to'liq ekran.
 *
 * Bitta rasm bo'lsa o'q va qator chizilmaydi, lekin to'liq ekran baribir ishlaydi: odam
 * vagonning holatini yoki terminal maydonini kattalashtirib ko'rmoqchi, rasm soni muhim emas.
 * Rasmsiz obyekt istisno emas, asosiy holat (reestrdan kelgan minglab qator rasmsiz), shuning
 * uchun fallback chaqiruvchidan keladi: terminalda chizma, e'londa turiga mos belgi.
 *
 * To'liq ekran z-[60] da: chat oynasi (z-50) va yordam tugmasi (z-40) ustida turishi kerak,
 * aks holda rasm ortida ularning tugmalari bosiladi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowsOutSimpleIcon, CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';

const ARROW = 'tap-40 absolute top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-navy shadow transition hover:bg-white';

export function PhotoGallery({ photos, alt, fallback, aspect = 'aspect-[16/10]', className = '' }: {
  photos: readonly string[];
  alt: string;
  fallback?: React.ReactNode;
  aspect?: string;
  className?: string;
}) {
  const t = useTranslations('gallery');
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const swipe = useRef<number | null>(null);
  const n = photos.length;

  const go = useCallback((d: number) => setI((x) => (n ? (x + d + n) % n : 0)), [n]);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    // Orqadagi sahifa aylanmasin: telefonda rasmni surganda sahifa ketib qolardi
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, go]);

  const onStart = (e: React.TouchEvent) => { swipe.current = e.touches[0]?.clientX ?? null; };
  const onEnd = (e: React.TouchEvent) => {
    const from = swipe.current;
    swipe.current = null;
    const to = e.changedTouches[0]?.clientX;
    if (from == null || to == null) return;
    // 50 px: tasodifiy tegishdan ajratadigan eng kichik masofa
    if (Math.abs(to - from) > 50) go(to < from ? 1 : -1);
  };

  if (!n) return <div className={`${aspect} overflow-hidden rounded-card border border-line bg-sand ${className}`}>{fallback}</div>;

  const label = (k: number) => (n > 1 ? `${alt} (${k + 1}/${n})` : alt);

  return (
    <div className={className}>
      <div className={`group relative ${aspect} overflow-hidden rounded-card border border-line bg-sand`} onTouchStart={onStart} onTouchEnd={onEnd}>
        <button type="button" onClick={() => setOpen(true)} aria-label={t('openFull')} className="block h-full w-full cursor-zoom-in">
          <img src={photos[i]} alt={label(i)} className="h-full w-full object-cover" />
        </button>
        {n > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t('prev')} className={`${ARROW} left-2`}><CaretLeftIcon size={18} weight="bold" aria-hidden="true" /></button>
            <button type="button" onClick={() => go(1)} aria-label={t('next')} className={`${ARROW} right-2`}><CaretRightIcon size={18} weight="bold" aria-hidden="true" /></button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-navy/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-white tabular-nums">{i + 1} / {n}</span>
          </>
        ) : null}
        {/* Kattalashtirish mumkinligi sichqoncha bilan ko'rinadi; telefonda rasmning o'zi tugma */}
        <span className="pointer-events-none absolute bottom-2 left-2 hidden items-center gap-1 rounded-full bg-navy/80 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 sm:inline-flex">
          <ArrowsOutSimpleIcon size={12} weight="bold" aria-hidden="true" />{t('openFull')}
        </span>
      </div>

      {n > 1 ? (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {photos.map((p, k) => (
            <button
              key={p} type="button" onClick={() => setI(k)} aria-label={t('photoN', { n: k + 1 })} aria-current={k === i}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${k === i ? 'border-teal' : 'border-line opacity-70 hover:opacity-100'}`}
            >
              <img src={p} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div role="dialog" aria-modal="true" aria-label={alt} className="ys-lb fixed inset-0 z-[60] flex flex-col bg-navy/95 backdrop-blur-sm">
          <div className="flex shrink-0 items-center gap-3 px-4 py-3 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{alt}</p>
            {n > 1 ? <span className="shrink-0 font-mono text-sm tabular-nums text-white/80">{i + 1} / {n}</span> : null}
            <button ref={close} type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="tap-40 relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
              <XIcon size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {/* Rasm yonidagi bo'sh joyga bosilsa yopiladi: to'liq ekrandan chiqishning odatiy yo'li */}
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-2 pb-2"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            onTouchStart={onStart} onTouchEnd={onEnd}
          >
            <img key={photos[i]} src={photos[i]} alt={label(i)} className="ys-lb-img max-h-full max-w-full object-contain" />
          </div>

          {n > 1 ? (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t('prev')} className={`${ARROW} left-2 bg-white/15 text-white hover:bg-white/25 sm:left-4 sm:h-11 sm:w-11`}><CaretLeftIcon size={20} weight="bold" aria-hidden="true" /></button>
              <button type="button" onClick={() => go(1)} aria-label={t('next')} className={`${ARROW} right-2 bg-white/15 text-white hover:bg-white/25 sm:right-4 sm:h-11 sm:w-11`}><CaretRightIcon size={20} weight="bold" aria-hidden="true" /></button>
              <div className="no-scrollbar flex shrink-0 justify-start gap-2 overflow-x-auto px-4 pb-4 sm:justify-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                {photos.map((p, k) => (
                  <button
                    key={p} type="button" onClick={() => setI(k)} aria-label={t('photoN', { n: k + 1 })} aria-current={k === i}
                    className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${k === i ? 'border-teal' : 'border-white/25 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={p} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
