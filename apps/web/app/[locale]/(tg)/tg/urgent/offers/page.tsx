'use client';
// Ijrochi ko'rinishi: viloyatimdagi ochiq so'rovlar, har biriga narx (so'm), yetib borish (daqiqa), izoh. ?id= bo'lsa shu so'rov ochiq holda.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import { asList, type UrgentOffer, type UrgentRequest } from '@/lib/types-urgent';
import { OfferStatusPill, UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';
import { haptic } from '@/components/tg/TgProvider';
import { BTN, CARD, Empty, Err, INPUT, Skeleton } from '@/components/tg/bits';

type Draft = { price: string; eta: string; message: string };
const EMPTY: Draft = { price: '', eta: '', message: '' };

export default function TgOffersPage() {
  const t = useTranslations('urgent.provider');
  const locale = useLocale();
  const td = useTranslations('urgent.detail');
  const tu = useTranslations('tg.urgent');
  const tc = useTranslations('tg.common');
  const L = useUrgentLabels();
  const focusId = useSearchParams().get('id');
  const [items, setItems] = useState<UrgentRequest[] | null>(null);
  const [open, setOpen] = useState<string | null>(focusId);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sent, setSent] = useState<Record<string, UrgentOffer>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api<unknown>('/urgent?scope=provider').then((r) => setItems(asList<UrgentRequest>(r))).catch(() => { setItems([]); setErr(tc('loadFailed')); }); }, [tc]);
  useEffect(() => { if (items?.length && focusId) document.getElementById(`ur-${focusId}`)?.scrollIntoView({ block: 'start' }); }, [items, focusId]);
  const draft = (id: string) => drafts[id] ?? EMPTY;
  const set = (id: string, p: Partial<Draft>) => setDrafts((x) => ({ ...x, [id]: { ...draft(id), ...p } }));

  async function send(r: UrgentRequest) {
    const d = draft(r.id);
    setBusy(r.id); setErr(null);
    try {
      const o = await post<UrgentOffer>(`/urgent/${r.id}/offers`, { priceTiyin: d.price ? Math.round(Number(d.price) * 100) : undefined, etaMinutes: d.eta ? Number(d.eta) : undefined, message: d.message.trim() || undefined });
      setSent((x) => ({ ...x, [r.id]: o })); haptic('medium');
    } catch { setErr(tc('failed')); } finally { setBusy(null); }
  }

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('lead')}</p>
      <Link href="/tg/urgent" className="mt-2 inline-block text-xs font-semibold text-teal-ink">{tu('mine')}</Link>
      {err ? <div className="mt-3"><Err>{err}</Err></div> : null}
      <div className="mt-4">
        {!items ? <Skeleton /> : items.length === 0 && !err ? <Empty>{t('empty')}</Empty> : (
          <ul className="space-y-2">
            {items.map((r) => {
              const mine = sent[r.id] ?? r.myOffer ?? null;
              const d = draft(r.id);
              const isOpen = open === r.id;
              return (
                <li key={r.id} id={`ur-${r.id}`} className={`${CARD} p-3 ${focusId === r.id ? 'border-teal' : ''}`}>
                  <button type="button" onClick={() => { haptic(); setOpen(isOpen ? null : r.id); }} aria-expanded={isOpen} className="w-full text-left">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{r.no}</span><UrgentStatusPill status={r.status} /><span className="ml-auto font-mono text-xs text-muted">{uzDateTime(r.createdAt, locale)}</span></div>
                    <p className="mt-1 text-sm font-semibold">{L.kind[r.kind] ?? r.kind} · {L.region(r.regionCode)}{r.stationName ? ` · ${r.stationName}` : ''}{r.wagonCount ? ` · ${r.wagonCount} vag` : ''}</p>
                    <p className={`mt-0.5 text-sm text-muted ${isOpen ? 'whitespace-pre-line' : 'truncate'}`}>{r.description}</p>
                  </button>
                  {isOpen ? (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="font-mono text-sm"><span className="text-muted">{t('phone')}: </span><a href={`tel:${r.contactPhone}`} className="font-semibold text-navy">{r.contactPhone}</a></p>
                      {mine ? (
                        <p className="mt-2 rounded-xl bg-teal-soft px-3 py-2 text-sm text-teal-ink"><b>{t('offer.mine')}:</b> {mine.priceTiyin != null ? som(mine.priceTiyin, locale) : td('onRequest')}{mine.etaMinutes != null ? ` · ${td('eta', { min: mine.etaMinutes })}` : ''}{mine.status !== 'SENT' ? <> <OfferStatusPill status={mine.status} /></> : null}</p>
                      ) : (
                        <form onSubmit={(e) => { e.preventDefault(); void send(r); }} className="mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-xs font-semibold">{t('offer.price')}<input inputMode="numeric" value={d.price} onChange={(e) => set(r.id, { price: e.target.value.replace(/\D/g, '') })} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
                            <label className="block text-xs font-semibold">{t('offer.eta')}<input inputMode="numeric" value={d.eta} onChange={(e) => set(r.id, { eta: e.target.value.replace(/\D/g, '').slice(0, 5) })} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
                          </div>
                          <label className="block text-xs font-semibold">{t('offer.message')}<textarea value={d.message} maxLength={1000} rows={2} onChange={(e) => set(r.id, { message: e.target.value })} className={`${INPUT} mt-1 font-normal`} /></label>
                          <p className="text-[11px] text-muted">{t('offer.priceHint')}</p>
                          <button type="submit" disabled={busy === r.id} className={BTN}>{busy === r.id ? t('offer.sending') : t('offer.send')}</button>
                        </form>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
