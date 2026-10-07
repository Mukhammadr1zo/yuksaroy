'use client';
// Yozishmalar: kelgan (mening obyektlarimga) va yuborgan (men). Tartib oxirgi xabar
// bo'yicha, o'qilmagan xabar soni ro'yxatda ko'rinadi: javob kutayotgan suhbat
// ro'yxat tubida qolib ketmasligi kerak.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import type { Inquiry } from '@/lib/types-kabinet';
import { CHIP, useListingLabels } from '@/components/kabinet/bits';

type Scope = 'owner' | 'mine';

export default function InquiriesPage() {
  const t = useTranslations('kabinet.inquiries');
  const locale = useLocale();
  const tch = useTranslations('kabinet.chat');
  const tc = useTranslations('kabinet.common');
  const L = useListingLabels();
  const [scope, setScope] = useState<Scope>('owner');
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setItems(null); setErr(false);
    api<Inquiry[]>(`/inquiries?scope=${scope}`)
      // Kelganlarda hali javob berilmaganlari tepada, qolgan tartib serverniki (oxirgi xabar).
      // Platforma adminining "Javobsiz suhbat" navbati shu sahifaga olib keladi: sanalgan
      // suhbat ro'yxatda darhol ko'rinsin, javob berilganlar orasida yo'qolib ketmasin.
      .then((xs) => setItems(scope === 'owner' ? [...xs].sort((a, b) => Number(b.status === 'OPEN') - Number(a.status === 'OPEN')) : xs))
      .catch(() => setErr(true));
  }, [scope]);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>

      <div className="mt-5 flex gap-2">
        {(['owner', 'mine'] as Scope[]).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={CHIP(scope === s)}>{t(`tabs.${s}`)}</button>
        ))}
      </div>

      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {items?.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t(`empty.${scope}`)}</p>
          <Link href={scope === 'owner' ? '/dashboard/listings/new' : '/terminals'} className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink">{t(`emptyCta.${scope}`)}</Link>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2">
        {items?.map((i) => (
          <li key={i.id} className={`rounded-card border bg-white p-4 ${i.unread > 0 ? 'border-teal' : 'border-line'}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link
                href={i.subject ? (i.subject.kind === 'terminal' ? `/terminals/${i.subject.slug}` : `/${i.subject.sub === 'TRUCK' ? 'carriers' : 'equipment'}/${i.subject.slug}`) : '/dashboard/inquiries'}
                className="font-semibold hover:underline wrap-anywhere"
              >
                {i.subject?.title ?? tch('deletedSubject')}
              </Link>
              {i.subject ? (
                <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">
                  {i.subject.kind === 'terminal' ? tch('terminalTag') : (L.kind[i.subject.sub as keyof typeof L.kind] ?? i.subject.sub)}
                </span>
              ) : null}
              {i.unread > 0 ? (
                <span className="rounded-full bg-teal px-2 py-0.5 font-mono text-xs font-bold text-white" aria-label={tch('unread', { count: i.unread })}>{i.unread}</span>
              ) : null}
              {/* OPEN: qabul qiluvchi tomon javob qarzdor - hali yozmagan yoki mijoz javobdan keyin yana yozgan (2026-10-07) */}
              {scope === 'owner' && i.status === 'OPEN' ? (
                <span className="rounded-full bg-amber px-2.5 py-0.5 text-xs font-semibold text-ink">{t('awaiting')}</span>
              ) : null}
              <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(i.lastMessageAt ?? i.createdAt, locale)}</span>
            </div>
            {scope === 'owner' ? <p className="mt-1 text-sm text-muted">{i.fromOrgName ?? t('fromPrivate')}</p> : null}
            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm wrap-anywhere">{i.message}</p>
            <Link href={`/dashboard/inquiries/${i.id}`} className="mt-2 inline-block text-sm font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{tch('open')}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
