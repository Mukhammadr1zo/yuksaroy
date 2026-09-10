'use client';
// Egasi o'z shahobcha yo'lini reestrdan topib biriktiradi. Ochiq katalogda egasiz yo'l ko'rinmaydi,
// shuning uchun qidiruv shu yerda: GET /sidings/registry (kirish talab qilinadi) -> POST /sidings/:id/claim.
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { num } from '@/lib/format';
import type { Membership } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_NAVY, INPUT, Notice } from './bits';

type Row = { id: string; registryNo: number; stationNameRaw: string; esrCode: string | null; regionCode: string | null; lengthM: number | null };

export function SidingRegistry({ orgs, onClaimed }: { orgs: Membership[]; onClaimed: () => void }) {
  const t = useTranslations('kabinet.sidings.registry');
  const tr = useTranslations('region');
  const tc = useTranslations('kabinet.common');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const orgId = orgs[0]?.orgId;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy('search'); setNote(null);
    try { setRows((await api<{ items: Row[] }>(`/sidings/registry?q=${encodeURIComponent(q.trim())}`)).items); }
    catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(null); }
  }

  async function claim(id: string) {
    if (!orgId) return;
    setBusy(id); setNote(null);
    try {
      await post(`/sidings/${id}/claim`, { orgId });
      setRows((x) => (x ? x.filter((r) => r.id !== id) : x));
      setNote({ tone: 'ok', text: t('claimed') });
      onClaimed();
    } catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(null); }
  }

  return (
    <section className="mt-8 rounded-card border border-line bg-white p-5">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t('lead')}</p>
      <form onSubmit={search} className="mt-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('placeholder')} className={`${INPUT} max-w-xs`} maxLength={80} />
        <button disabled={busy === 'search' || q.trim().length < 2} className={BTN_NAVY}>{busy === 'search' ? tc('loading') : t('search')}</button>
      </form>
      {note ? <div className="mt-3"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
      {rows && rows.length === 0 ? <p className="mt-3 text-sm text-muted">{t('none')}</p> : null}
      {rows && rows.length ? (
        <ul className="mt-3 divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-mono text-xs text-muted">#{r.registryNo}</span>
              <span className="font-semibold">{r.stationNameRaw}</span>
              {r.regionCode && tr.has(r.regionCode) ? <span className="text-muted">{tr(r.regionCode)}</span> : null}
              {r.lengthM != null ? <span className="font-mono text-xs text-muted tabular-nums">{num(r.lengthM, locale)} m</span> : null}
              <button type="button" disabled={!orgId || busy === r.id} onClick={() => void claim(r.id)} className={`${BTN_GHOST} ml-auto`}>{t('claim')}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
