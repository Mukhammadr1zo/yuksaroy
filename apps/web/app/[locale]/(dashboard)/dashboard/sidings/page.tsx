'use client';
// Shahobchalarim: da'vo qilingan shahobcha yo'llar va da'vo holati (GET /sidings/mine).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CLAIM_STATUS_LABELS, type ClaimStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num } from '@/lib/format';
import type { MySiding } from '@/lib/types-kabinet';
import { useLang } from '@/components/kabinet/bits';

const TONE: Record<ClaimStatus, string> = { NONE: 'bg-line text-ink/70', PENDING: 'bg-amber-soft text-amber-ink', APPROVED: 'bg-teal text-white', REJECTED: 'bg-red-50 text-red-700' };

export default function MySidingsPage() {
  const t = useTranslations('kabinet.sidings');
  const tc = useTranslations('kabinet.common');
  const tr = useTranslations('region');
  const lang = useLang();
  const [items, setItems] = useState<MySiding[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => { api<{ items: MySiding[] }>('/sidings/mine').then((p) => setItems(p.items)).catch(() => setErr(true)); }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>

      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}

      {items && items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t('empty')}</p>
          <Link href="/sidings" className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink">{t('emptyCta')}</Link>
        </div>
      ) : null}

      {items && items.length ? (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{t('col.no')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.station')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.region')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col.length')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3 font-mono tabular-nums">{s.registryNo}</td>
                  <td className="px-4 py-3">{s.station?.nameUz ?? s.stationNameRaw}</td>
                  <td className="px-4 py-3 text-muted">{s.regionCode && tr.has(s.regionCode) ? tr(s.regionCode) : '·'}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{s.lengthM != null ? `${num(s.lengthM)} m` : '·'}</td>
                  <td className="px-4 py-3"><span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE[s.claimStatus]}`}>{CLAIM_STATUS_LABELS[lang][s.claimStatus]}</span></td>
                  <td className="px-4 py-3 text-right"><Link href={`/sidings/${s.id}`} className="text-sm font-semibold text-teal-ink underline">{t('open')}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
