'use client';
// Shoshilinch so'rovlarim: yangi so'rov shakli va ro'yxat. Ijrochi ko'rinishi /dashboard/urgent/offers.
// Sarlavha ota sahifada: bu yerda faqat harakat tugmalari va ro'yxat.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { REGIONS, URGENT_KINDS, type UrgentKind } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import type { Me, Membership } from '@/lib/types-kabinet';
import { asList, type UrgentRequest } from '@/lib/types-urgent';
import { BTN_GHOST, BTN_NAVY, BTN_PRIMARY, CHIP, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';
import { PhoneField } from '@/components/ui/fields';

type Draft = { kind: UrgentKind; regionCode: string; stationName: string; wagonCount: string; description: string; contactPhone: string; orgId: string };
const EMPTY: Draft = { kind: 'LOCO_CALL', regionCode: '', stationName: '', wagonCount: '', description: '', contactPhone: '', orgId: '' };
const notLive = (e: unknown) => e instanceof ApiError && e.status === 404;

export function UrgentMine() {
  const t = useTranslations('urgent.mine');
  const locale = useLocale();
  const tc = useTranslations('kabinet.common');
  const tp = useTranslations('urgent.provider');
  const tr = useTranslations('region');
  const L = useUrgentLabels();
  const router = useRouter();
  const [items, setItems] = useState<UrgentRequest[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [orgs, setOrgs] = useState<Membership[]>([]);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    api<unknown>('/urgent?scope=mine').then((r) => setItems(asList<UrgentRequest>(r))).catch((e) => { setErr(notLive(e) ? t('notReady') : tc('loadFailed')); setItems([]); });
    api<Me>('/auth/me').then((me) => setD((x) => ({ ...x, contactPhone: x.contactPhone || me.phone || '' }))).catch(() => {});
    api<Membership[]>('/orgs/mine').then(setOrgs).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  // Tugma o'chiq bo'lsa sabab ko'rinsin: yetishmayotgan maydonlar ro'yxati
  const missing = [!d.regionCode && t('form.region'), d.description.trim().length < 5 && t('form.description'), d.contactPhone.trim().length < 7 && t('form.phone')].filter(Boolean) as string[];
  const valid = missing.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setFormErr(null);
    try {
      const r = await post<UrgentRequest>('/urgent', {
        kind: d.kind, regionCode: d.regionCode, stationName: d.stationName.trim() || undefined, wagonCount: d.wagonCount ? Number(d.wagonCount) : undefined,
        description: d.description.trim(), contactPhone: d.contactPhone.trim(), orgId: d.orgId || undefined,
      });
      router.push(`/dashboard/urgent/${r.id}`);
    } catch (er) { setFormErr(notLive(er) ? t('notReady') : tc('failed')); setBusy(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('lead')}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/urgent/offers" className={BTN_GHOST}>{tp('title')}</Link>
          <button type="button" onClick={() => setOpen((o) => !o)} className={BTN_NAVY} aria-expanded={open}>{open ? tc('cancel') : t('new')}</button>
        </div>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-card border border-line bg-white p-5">
          <Field group label={t('form.kind')} required>
            <div className="flex flex-wrap gap-2">
              {URGENT_KINDS.map((k) => <button key={k} type="button" aria-pressed={d.kind === k} className={CHIP(d.kind === k)} onClick={() => set({ kind: k })}>{L.kind[k]}</button>)}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('form.region')} required>
              <select className={INPUT} value={d.regionCode} required onChange={(e) => set({ regionCode: e.target.value })}>
                <option value="">{t('form.regionPick')}</option>
                {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
              </select>
            </Field>
            <Field label={t('form.station')}>
              <input className={INPUT} maxLength={120} placeholder={t('form.stationPh')} value={d.stationName} onChange={(e) => set({ stationName: e.target.value })} />
            </Field>
            <Field label={t('form.wagons')}>
              <input className={`${INPUT} font-mono`} type="number" min={1} max={999} inputMode="numeric" value={d.wagonCount} onChange={(e) => set({ wagonCount: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
            </Field>
            <Field label={t('form.phone')} required>
              <PhoneField className={`${INPUT} font-mono`} required value={d.contactPhone} onChange={(contactPhone) => set({ contactPhone })} />
            </Field>
          </div>
          <Field label={t('form.description')} required>
            <textarea className={`${INPUT} min-h-28`} maxLength={2000} required placeholder={t('form.descriptionPh')} value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          {orgs.length ? (
            <Field label={t('form.org')}>
              <select className={INPUT} value={d.orgId} onChange={(e) => set({ orgId: e.target.value })}>
                <option value="">{t('form.orgSelf')}</option>
                {orgs.map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
              </select>
            </Field>
          ) : null}
          {formErr ? <Notice tone="err">{formErr}</Notice> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || !valid} className={BTN_PRIMARY}>{busy ? t('form.sending') : t('form.submit')}</button>
            {valid ? null : <p className="text-sm text-muted">{t('form.missing', { fields: missing.join(', ') })}</p>}
          </div>
        </form>
      ) : null}

      {err ? <div className="mt-6"><Notice tone="warn">{err}</Notice></div> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {items && items.length === 0 && !err ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t('empty')}</p>
          {!open ? <button type="button" onClick={() => setOpen(true)} className={`${BTN_PRIMARY} mt-4`}>{t('new')}</button> : null}
        </div>
      ) : null}

      {items && items.length ? (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 font-semibold">{t('col.no')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('col.kind')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('col.region')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('col.status')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('col.offers')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('col.created')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3 font-mono"><Link href={`/dashboard/urgent/${r.id}`} className="font-semibold text-navy hover:underline">{r.no}</Link></td>
                  <td className="px-4 py-3">{L.kind[r.kind] ?? r.kind}{r.stationName ? <span className="block text-xs text-muted">{r.stationName}</span> : null}</td>
                  <td className="px-4 py-3">{L.region(r.regionCode)}</td>
                  <td className="px-4 py-3"><UrgentStatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{r.offersCount ?? r.offers?.length ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{uzDateTime(r.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
