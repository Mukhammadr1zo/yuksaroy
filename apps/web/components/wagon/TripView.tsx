'use client';
/**
 * Vagon yo'li va vaqt chizig'i: sayt (/wagon) va Mini App (/tg/wagon) natija kartasining ostida.
 *
 * Obunachiga: yuklangan stansiya va sana -> hozir -> manzil, yuk nomi va vazni, keyin qadamlar
 * (yangisi tepada). Obunasizga server bularni umuman yubormaydi, faqat `locked`: shunda karta
 * ostida "obunada ko'rinadi" degan qisqa taklif chiqadi.
 */
import { useTranslations } from 'next-intl';
import { LockSimpleIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { num, uzDate } from '@/lib/format';
import type { WagonResult } from '@/lib/types-wagon';

const day = (d: string | null, locale: string) => (d ? uzDate(d.slice(0, 10), locale) : '');

export function TripView({ r, locale, subscribeHref }: { r: WagonResult; locale: string; subscribeHref: string }) {
  const t = useTranslations('wagon.trip');
  const trip = r.trip ?? null;
  const steps = r.timeline ?? [];

  if (r.locked && !trip && !steps.length) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-sand px-3 py-2 text-xs text-muted">
        <LockSimpleIcon size={14} aria-hidden="true" />{t('locked')}{' '}
        <Link href={subscribeHref} className="font-semibold text-teal-ink underline underline-offset-2">{t('lockedCta')}</Link>
      </p>
    );
  }
  if (!trip && steps.length < 2) return null;

  return (
    <div className="mt-3 space-y-3">
      {trip ? (
        <ol className="relative space-y-2 border-l-2 border-teal/40 pl-4 text-sm">
          {trip.from ? (
            <li><span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-teal" aria-hidden="true" />
              <span className="text-muted">{t('from')}</span> <b>{trip.from}</b>{trip.loadDate ? <span className="font-mono text-xs text-muted"> · {day(trip.loadDate, locale)}</span> : null}</li>
          ) : null}
          {r.current?.station ? (
            <li><span className="absolute -left-[6px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-teal bg-white" aria-hidden="true" />
              <span className="text-muted">{t('now')}</span> <b>{r.current.station}</b></li>
          ) : null}
          {trip.dest ? (
            <li><span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-navy" aria-hidden="true" />
              <span className="text-muted">{t('dest')}</span> <b>{trip.dest}</b></li>
          ) : null}
        </ol>
      ) : null}
      {trip?.cargo ? (
        <p className="text-sm"><span className="text-muted">{t('cargo')}</span> <b>{trip.cargo}</b>{trip.weightT ? <span className="font-mono text-xs text-muted"> · {num(trip.weightT, locale)} t</span> : null}</p>
      ) : null}
      {steps.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-teal-ink">{t('steps', { n: steps.length })}</summary>
          <ol className="mt-2 space-y-1.5">
            {steps.map((s, i) => (
              <li key={`${s.date}-${i}`} className="flex items-baseline gap-2">
                <span className="w-20 shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted">{day(s.date, locale)}</span>
                <span className="min-w-0 flex-1 break-words"><b className="font-semibold">{s.station ?? t('unknown')}</b>{s.op ? <span className="text-muted"> · {s.op}</span> : null}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
