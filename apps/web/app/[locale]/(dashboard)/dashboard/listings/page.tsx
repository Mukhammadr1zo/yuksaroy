'use client';
// E'lonlarim: jadval + har qator uchun holatga mos harakatlar (e'lon berish, arxivlash, tahrirlash, qoralamani o'chirish).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LISTING_OWNER_LABELS, canListingTransition } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import { listingHref, type OwnerListing } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_NAVY, ListingStatusPill, Notice, errText, useLang, useListingLabels } from '@/components/kabinet/bits';
import { PremiumBadge } from '@/components/catalog/PremiumBadge';
import { PremiumModal } from '@/components/kabinet/PremiumModal';

export default function MyListingsPage() {
  const t = useTranslations('kabinet.listings');
  const tc = useTranslations('kabinet.common');
  const te = useTranslations('kabinet.form.err');
  const td = useTranslations('kabinet.form.deal');
  const tp = useTranslations('premium');
  const tan = useTranslations('analytics');
  const L = useListingLabels();
  const lang = useLang();
  const [items, setItems] = useState<OwnerListing[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [prem, setPrem] = useState<OwnerListing | null>(null); // Premium modal ochiq e'lon

  const load = () => api<OwnerListing[]>('/listings/mine').then(setItems).catch(() => setErr(tc('loadFailed')));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(l: OwnerListing, what: 'publish' | 'archive' | 'delete') {
    if (what === 'delete' && !window.confirm(t('confirmDelete'))) return;
    setBusy(`${l.id}:${what}`); setErr(null); setOk(null);
    try {
      if (what === 'delete') { await api(`/listings/${l.id}`, { method: 'DELETE' }); setItems((xs) => xs?.filter((x) => x.id !== l.id) ?? null); }
      else {
        const r = await post<OwnerListing>(`/listings/${l.id}/${what}`, {});
        setItems((xs) => xs?.map((x) => (x.id === l.id ? r : x)) ?? null);
        if (what === 'publish') setOk(`${l.title}: ${t(r.status === 'ACTIVE' ? 'published.ACTIVE' : 'published.PENDING_REVIEW')}`);
      }
    } catch (e) { setErr(errText(e, te, te.has, tc('failed'))); } finally { setBusy(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
        <Link href="/dashboard/listings/new" className={BTN_NAVY}>{t('new')}</Link>
      </div>

      {err ? <div className="mt-5"><Notice tone="err">{err}</Notice></div> : null}
      {ok ? <div className="mt-5"><Notice tone="ok">{ok}</Notice></div> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}

      {items && items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t('empty')}</p>
          <Link href="/dashboard/listings/new" className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink">{t('emptyCta')}</Link>
        </div>
      ) : null}

      {items && items.length ? (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{t('col.title')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.kind')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.owner')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.status')}</th>
                <th className="px-4 py-3 font-semibold">{tp('col')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col.price')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col.views')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.updated')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const publishable = canListingTransition(l.status, 'PENDING_REVIEW', 'OWNER');
                const archivable = canListingTransition(l.status, 'ARCHIVED', 'OWNER');
                return (
                  <tr key={l.id} className="border-b border-line/70 align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/listings/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                      {l.status === 'REJECTED' && l.rejectReason ? <p className="mt-0.5 text-xs text-red-700">{t('rejectReason')}: {l.rejectReason}</p> : null}
                      {l.status === 'ACTIVE' && l.expiresAt ? <p className="mt-0.5 font-mono text-xs text-muted">{t('expires')} {uzDateTime(l.expiresAt)}</p> : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{L.kind[l.kind]}{l.deal ? <span className="text-muted"> · {td(l.deal)}</span> : null}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{l.owner.type === 'org' ? l.owner.name : <span className="text-muted">{LISTING_OWNER_LABELS[lang].person}</span>}</td>
                    <td className="px-4 py-3"><ListingStatusPill status={l.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {l.premium ? <PremiumBadge className="mr-2" /> : null}
                      {l.status === 'ACTIVE' || l.status === 'PENDING_REVIEW'
                        ? <button type="button" onClick={() => setPrem(l)} className="text-xs font-semibold text-teal-ink underline hover:text-navy">{tp(l.premium ? 'extend' : 'get')}</button>
                        : l.premium ? null : <span className="text-muted">·</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono tabular-nums">
                      {l.priceTiyin != null ? <>{som(l.priceTiyin)}{l.priceUnit ? <span className="text-muted"> / {L.priceUnit[l.priceUnit]}</span> : null}</> : <span className="text-muted">{tc('onRequest')}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{l.views}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted">{uzDateTime(l.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {publishable ? <button type="button" disabled={busy?.startsWith(`${l.id}:`)} onClick={() => act(l, 'publish')} className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-ink disabled:opacity-60">{busy === `${l.id}:publish` ? '...' : l.status === 'DRAFT' ? t('publish') : t('republish')}</button> : null}
                        {archivable ? <button type="button" disabled={busy?.startsWith(`${l.id}:`)} onClick={() => act(l, 'archive')} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{t('archive')}</button> : null}
                        <Link href={`/dashboard/listings/${l.id}`} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{tc('edit')}</Link>
                        <Link href={`/dashboard/listings/${l.id}/analytics`} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{tan('link')}</Link>
                        {l.status === 'ACTIVE' ? <Link href={listingHref(l)} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{t('open')}</Link> : null}
                        {l.status === 'DRAFT' ? <button type="button" disabled={busy?.startsWith(`${l.id}:`)} onClick={() => act(l, 'delete')} className="px-2 py-1 text-xs font-semibold text-red-700 underline disabled:opacity-60">{tc('delete')}</button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {prem ? <PremiumModal listing={prem} onClose={() => setPrem(null)} /> : null}
    </main>
  );
}
