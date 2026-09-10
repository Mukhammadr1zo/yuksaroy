'use client';
// Terminallarim: GET /terminals/mine jadvali. Har qator: holat, stansiya, viloyat, bugungi bo'sh slotlar, tariflar soni; faollashtirish yoki yashirish (PATCH status).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { MyTerminal } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_NAVY, Notice, errText } from '@/components/kabinet/bits';
import { TerminalStatusPill } from '@/components/terminal/TerminalForm';

export default function MyTerminalsPage() {
  const t = useTranslations('terminalsAdmin.list');
  const te = useTranslations('terminalsAdmin.form.err');
  const tc = useTranslations('kabinet.common');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  const [items, setItems] = useState<MyTerminal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { api<MyTerminal[]>('/terminals/mine').then(setItems).catch(() => setErr(tc('loadFailed'))); }, [tc]);

  async function setStatus(x: MyTerminal, status: 'ACTIVE' | 'HIDDEN') {
    setBusy(x.id); setErr(null); setOk(null);
    try {
      const r = await api<MyTerminal>(`/terminals/${x.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setItems((xs) => xs?.map((y) => (y.id === x.id ? { ...y, status: r.status } : y)) ?? null);
      setOk(t('changed', { name: x.name }));
    } catch (e) { setErr(errText(e, te, te.has, tc('failed'))); } finally { setBusy(null); }
  }

  return (
    <main className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-muted">{t('lead')}</p>
        </div>
        <Link href="/dashboard/terminals/new" className={BTN_NAVY}>{t('new')}</Link>
      </div>

      {err ? <div className="mt-5"><Notice tone="err">{err}</Notice></div> : null}
      {ok ? <div className="mt-5"><Notice tone="ok">{ok}</Notice></div> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}

      {items && items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="font-semibold">{t('empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('emptyHint')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/terminals/new" className="rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink">{t('emptyCta')}</Link>
          </div>
        </div>
      ) : null}

      {items && items.length ? (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{t('col.name')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.kind')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.status')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.station')}</th>
                <th className="px-4 py-3 font-semibold">{t('col.region')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col.freeToday')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col.tariffs')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-b border-line/70 align-top last:border-0">
                  <td className="px-4 py-3"><Link href={`/dashboard/terminals/${x.id}`} className="font-semibold hover:underline">{x.name}</Link>{x.orgName ? <p className="mt-0.5 text-xs text-muted">{x.orgName}</p> : null}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{tk(x.kind)}</td>
                  <td className="px-4 py-3"><TerminalStatusPill status={x.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{x.station.nameUz}{x.station.esrCode ? <span className="ml-1 font-mono text-xs text-muted">{x.station.esrCode}</span> : null}</td>
                  <td className="px-4 py-3 text-muted">{x.regionCode && tr.has(x.regionCode) ? tr(x.regionCode) : '·'}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${(x.freeToday ?? 0) > 0 ? 'text-teal-ink' : 'text-muted'}`}>{x.freeToday ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{x.tariffs.length ? x.tariffs.length : <span className="font-body text-xs text-amber-ink">{t('noTariffs')}</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {x.status !== 'ACTIVE' ? <button type="button" disabled={busy !== null} onClick={() => setStatus(x, 'ACTIVE')} className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-ink disabled:opacity-60">{busy === x.id ? '...' : t('activate')}</button> : null}
                      {x.status === 'ACTIVE' ? <button type="button" disabled={busy !== null} onClick={() => setStatus(x, 'HIDDEN')} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{busy === x.id ? '...' : t('hide')}</button> : null}
                      <Link href={`/dashboard/terminals/${x.id}`} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{tc('edit')}</Link>
                      {x.status === 'ACTIVE' ? <Link href={`/terminals/${x.slug}`} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{t('open')}</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
