'use client';
// Ijrochi ko'rinishi: viloyatimdagi (va qo'shni) ochiq so'rovlar, har biriga taklif: narx so'mda (tiyinga aylanadi), yetib borish daqiqa, izoh.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import { asList, type UrgentOffer, type UrgentRequest } from '@/lib/types-urgent';
import { BTN_GHOST, BTN_NAVY, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { OfferStatusPill, UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';

type Draft = { price: string; eta: string; message: string };
const EMPTY: Draft = { price: '', eta: '', message: '' };

export default function UrgentOffersPage() {
  const t = useTranslations('urgent.provider');
  const locale = useLocale();
  const tm = useTranslations('urgent.mine');
  const td = useTranslations('urgent.detail');
  const tc = useTranslations('kabinet.common');
  const L = useUrgentLabels();
  const [items, setItems] = useState<UrgentRequest[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sent, setSent] = useState<Record<string, UrgentOffer>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  // Telegram xabaridagi havola: /dashboard/urgent/offers?id=<so'rov> shu qatorni ajratadi
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get('id'));
    api<unknown>('/urgent?scope=provider').then((r) => setItems(asList<UrgentRequest>(r))).catch((e) => { setErr(e instanceof ApiError && e.status === 404 ? tm('notReady') : tc('loadFailed')); setItems([]); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (items?.length && focusId) document.getElementById(`ur-${focusId}`)?.scrollIntoView({ block: 'center' }); }, [items, focusId]);

  const draft = (id: string) => drafts[id] ?? EMPTY;
  const set = (id: string, p: Partial<Draft>) => setDrafts((x) => ({ ...x, [id]: { ...draft(id), ...p } }));

  async function send(r: UrgentRequest) {
    const d = draft(r.id);
    setBusy(r.id); setRowErr((x) => ({ ...x, [r.id]: '' }));
    try {
      const o = await post<UrgentOffer>(`/urgent/${r.id}/offers`, {
        priceTiyin: d.price ? Math.round(Number(d.price) * 100) : undefined,
        etaMinutes: d.eta ? Number(d.eta) : undefined,
        message: d.message.trim() || undefined,
      });
      setSent((x) => ({ ...x, [r.id]: o }));
    } catch { setRowErr((x) => ({ ...x, [r.id]: tc('failed') })); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 max-w-[62ch] text-muted">{t('lead')}</p>
        </div>
        <Link href="/dashboard/urgent" className={BTN_GHOST}>{tm('tabMine')}</Link>
      </div>

      {err ? <div className="mt-6"><Notice tone="warn">{err}</Notice></div> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {items && items.length === 0 && !err ? <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t('empty')}</p> : null}

      <ul className="mt-6 space-y-4">
        {items?.map((r) => {
          const mine = sent[r.id] ?? r.myOffer ?? null;
          const d = draft(r.id);
          return (
            <li key={r.id} id={`ur-${r.id}`} className={`rounded-card border bg-white p-5 ${focusId === r.id ? 'border-teal' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono font-semibold text-navy">{r.no}</span>
                <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{L.kind[r.kind] ?? r.kind}</span>
                <UrgentStatusPill status={r.status} />
                <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(r.createdAt, locale)}</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {L.region(r.regionCode)}{r.stationName ? ` · ${r.stationName}` : ''}{r.wagonCount != null ? ` · ${r.wagonCount} ${td('wagons').toLowerCase()}` : ''}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm">{r.description}</p>
              {r.contactPhone ? <p className="mt-2 text-sm"><span className="text-muted">{t('phone')}: </span><a href={`tel:${r.contactPhone}`} className="font-mono font-semibold text-navy hover:text-teal-ink">{r.contactPhone}</a></p> : null}

              {mine ? (
                <div className="mt-4 rounded-xl bg-sand p-3 text-sm">
                  {/* Taklif holati: so'rov tanlangach ijrochi havoladan shu qatorga qaytadi va
                      "meni tanladimi" degan savolga javob shu yerda bo'lishi kerak. SENT da
                      chizilmaydi: u "javob kutilmoqda" degani va holat belgisi yangilik bermasdi. */}
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{t('offer.mine')}{mine.status !== 'SENT' ? <OfferStatusPill status={mine.status} /> : null}</p>
                  <p className="mt-1 font-mono text-navy tabular-nums">{mine.priceTiyin != null ? som(mine.priceTiyin, locale) : td('onRequest')}{mine.etaMinutes != null ? ` · ${td('eta', { min: mine.etaMinutes })}` : ''}</p>
                  {sent[r.id] ? <p className="mt-1 text-teal-ink">{t('offer.sent')}</p> : null}
                </div>
              ) : r.status === 'OPEN' ? (
                <form onSubmit={(e) => { e.preventDefault(); void send(r); }} className="mt-4 border-t border-line pt-4">
                  <h2 className="text-sm font-semibold">{t('offer.title')}</h2>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <Field label={t('offer.price')} hint={t('offer.priceHint')}>
                      <input className={`${INPUT} font-mono`} type="number" min={0} step={1000} inputMode="numeric" value={d.price} onChange={(e) => set(r.id, { price: e.target.value })} />
                    </Field>
                    <Field label={t('offer.eta')}>
                      <input className={`${INPUT} font-mono`} type="number" min={1} max={2880} inputMode="numeric" value={d.eta} onChange={(e) => set(r.id, { eta: e.target.value })} />
                    </Field>
                    <Field label={t('offer.message')}>
                      <input className={INPUT} maxLength={500} value={d.message} onChange={(e) => set(r.id, { message: e.target.value })} />
                    </Field>
                  </div>
                  {rowErr[r.id] ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{rowErr[r.id]}</p> : null}
                  <button type="submit" disabled={busy !== null} className={`${BTN_NAVY} mt-3`}>{busy === r.id ? t('offer.sending') : t('offer.send')}</button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
