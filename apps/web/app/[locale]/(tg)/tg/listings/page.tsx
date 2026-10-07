'use client';
// E'lonlarim: holat, tur, narx, ko'rishlar. Yangi e'lon /tg/listings/new; tahrirlash to'liq saytda (openLink).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LISTING_LABELS, canExtendListing } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import type { OwnerListing } from '@/lib/types-kabinet';
import { ListingStatusPill } from '@/components/kabinet/bits';
import { cardSrc } from '@/components/catalog/CardPhoto';
import { haptic, useTg } from '@/components/tg/TgProvider';
import { BTN, CARD, Empty, Err, Skeleton, listingPrice, useLang } from '@/components/tg/bits';

export default function TgListingsPage() {
  const t = useTranslations('tg.listings');
  const tc = useTranslations('tg.common');
  // Uzaytirish yorliqlari kabinetdan: Telegram eslatmasi aynan shu tugma nomini aytadi
  const tk = useTranslations('kabinet.listings');
  const { tg } = useTg();
  const lang = useLang();
  const L = LISTING_LABELS[lang];
  const [items, setItems] = useState<OwnerListing[] | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<{ id: string; ok: boolean } | null>(null);
  useEffect(() => { api<OwnerListing[]>('/listings/mine').then(setItems).catch(() => setErr(true)); }, []);
  const edit = (l: OwnerListing) => { haptic(); tg?.openLink(`${window.location.origin}/dashboard/listings/${l.id}`); };

  /**
   * Faol e'lonning oxirgi 7 kunida "Qayta yuborish" uni uzaytiradi (kabinet bilan bitta qoida).
   * Mini App da yuborish tugmasi faqat shu holatda: qolgan holatlarda "Platformada tahrirlash"
   * ochadigan formada yuborish tugmasi bor, faol e'lonning formasida esa yo'q.
   */
  async function extend(l: OwnerListing) {
    haptic(); setBusy(l.id); setRes(null);
    try {
      const r = await post<OwnerListing>(`/listings/${l.id}/publish`, {});
      haptic('medium');
      // Javobda ko'rishlar soni 0 (u faqat /listings/mine da qo'shiladi): kartadagi son qoladi
      setItems((xs) => xs?.map((x) => (x.id === l.id ? { ...r, views: x.views } : x)) ?? null);
      setRes({ id: l.id, ok: true });
    } catch { setRes({ id: l.id, ok: false }); } finally { setBusy(null); }
  }

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">{t('title')}</h1>
        <Link href="/tg/listings/new" onClick={() => haptic()} className="min-h-10 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">{t('new')}</Link>
      </div>
      <div className="mt-4">
        {err ? <Err>{tc('loadFailed')}</Err> : !items ? <Skeleton /> : items.length === 0 ? (
          <Empty><p>{t('empty')}</p><Link href="/tg/listings/new" className={`${BTN} mt-4`}>{t('new')}</Link></Empty>
        ) : (
          <ul className="space-y-2">
            {items.map((l) => (
              <li key={l.id} className={`${CARD} flex gap-3 p-3`}>
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">{l.photo ? <img src={cardSrc(l.photo)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="truncate font-bold">{l.title}</p><ListingStatusPill status={l.status} /></div>
                  <p className="mt-0.5 truncate text-xs text-muted">{L.kind[l.kind]} · {l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : tc('onRequest')}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{t('views', { count: l.views })} · {uzDate(l.updatedAt, lang)}</p>
                  {l.rejectReason ? <p className="mt-1 text-xs text-red-700">{l.rejectReason}</p> : null}
                  {canExtendListing(l.status, l.expiresAt) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button type="button" disabled={busy === l.id} onClick={() => extend(l)} className="min-h-11 rounded-full bg-teal px-4 text-sm font-semibold text-white transition active:scale-[0.98] disabled:bg-line disabled:text-muted">{busy === l.id ? '...' : tk('republish')}</button>
                      <span className="font-mono text-[11px] font-semibold text-amber-ink">{tk('expires')} {uzDate(l.expiresAt!, lang)}</span>
                    </div>
                  ) : null}
                  {res?.id === l.id && res.ok && l.status === 'ACTIVE' && l.expiresAt ? <p role="status" className="mt-1 text-xs font-semibold text-teal-ink">{tk('extended', { date: uzDate(l.expiresAt, lang) })}</p> : null}
                  {res?.id === l.id && !res.ok ? <p role="alert" className="mt-1 text-xs text-red-700">{tc('failed')}</p> : null}
                  <button type="button" onClick={() => edit(l)} className="mt-1 text-xs font-semibold text-teal-ink underline">{t('openSite')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
