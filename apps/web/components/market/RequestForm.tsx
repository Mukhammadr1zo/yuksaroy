'use client';
// So'rov formasi: yuk (yo'nalish, yuk, og'irlik, sana, kuzov) yoki xizmat (tur, viloyat). Xatolar maydon ostida oddiy so'z bilan.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { REGIONS, SERVICE_TYPES, TRUCK_TYPES, type MarketBoard, type ServiceType } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, hasSession, post } from '@/lib/api';
import { uzToday } from '@/lib/format';
import type { FieldErrors, MarketRequest } from '@/lib/types-market';
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { useMarketLabels } from './bits';

type Draft = {
  title: string; description: string; serviceType: string; regionCode: string;
  fromRegion: string; toRegion: string; fromText: string; toText: string; cargoName: string; weightT: string; loadDate: string; truckType: string; contactPhone: string;
};
const EMPTY: Draft = { title: '', description: '', serviceType: '', regionCode: '', fromRegion: '', toRegion: '', fromText: '', toText: '', cargoName: '', weightT: '', loadDate: '', truckType: '', contactPhone: '' };

export function RequestForm({ board, next, serviceType }: { board: MarketBoard; next: string; serviceType?: string }) {
  const t = useTranslations('market.form');
  const te = useTranslations('market.err');
  const L = useMarketLabels();
  const cargo = board === 'CARGO';
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [d, setD] = useState<Draft>({ ...EMPTY, serviceType: (SERVICE_TYPES as readonly string[]).includes(serviceType ?? '') ? serviceType! : '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MarketRequest | null>(null);

  useEffect(() => { setAuthed(hasSession()); }, []);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const err = (k: keyof Draft) => (errors[k] ? te(errors[k]!) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setTop(null); setErrors({});
    try {
      const body = cargo
        ? { board, title: d.title, description: d.description, fromRegion: d.fromRegion, toRegion: d.toRegion, fromText: d.fromText, toText: d.toText, cargoName: d.cargoName, weightT: d.weightT ? Number(d.weightT) : undefined, loadDate: d.loadDate, truckType: d.truckType || undefined, contactPhone: d.contactPhone }
        : { board, title: d.title, description: d.description, serviceType: d.serviceType, regionCode: d.regionCode, contactPhone: d.contactPhone };
      setDone(await post<MarketRequest>('/market/requests', body));
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.body?.errors) setErrors(e.body.errors as FieldErrors);
      else setTop(e instanceof ApiError && e.status === 429 ? te('RATE_LIMITED') : te('generic'));
    } finally { setBusy(false); }
  }

  if (authed === null) return null;
  if (!authed) return <Notice tone="warn">{t('loginNeeded')} <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">{t('loginCta')}</Link></Notice>;
  if (done) {
    const publicHref = cargo ? `/cargo/${done.no}` : `/services/requests/${done.no}`;
    return (
      <div className="grid gap-4">
        <Notice tone="ok"><span className="font-semibold">{t('done', { no: done.no })}</span> {t('doneBody')}</Notice>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/market?tab=requests&id=${done.id}`} className={BTN_PRIMARY}>{t('viewMine')}</Link>
          <Link href={publicHref} className={BTN_GHOST}>{t('viewPublic')}</Link>
        </div>
      </div>
    );
  }

  const regionOptions = (empty: string) => (
    <>
      <option value="">{empty}</option>
      {REGIONS.map((r) => <option key={r} value={r}>{L.region(r)}</option>)}
    </>
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      {cargo ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fromRegion')} required error={err('fromRegion')}>
              <select className={INPUT} value={d.fromRegion} onChange={(e) => set({ fromRegion: e.target.value })}>{regionOptions(t('regionPick'))}</select>
            </Field>
            <Field label={t('toRegion')} required error={err('toRegion')}>
              <select className={INPUT} value={d.toRegion} onChange={(e) => set({ toRegion: e.target.value })}>{regionOptions(t('regionPick'))}</select>
            </Field>
            <Field label={t('fromText')} error={err('fromText')}><input className={INPUT} maxLength={200} placeholder={t('fromTextPh')} value={d.fromText} onChange={(e) => set({ fromText: e.target.value })} /></Field>
            <Field label={t('toText')} error={err('toText')}><input className={INPUT} maxLength={200} placeholder={t('toTextPh')} value={d.toText} onChange={(e) => set({ toText: e.target.value })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('cargoName')} required error={err('cargoName')} className="lg:col-span-2"><input className={INPUT} maxLength={120} placeholder={t('cargoNamePh')} value={d.cargoName} onChange={(e) => set({ cargoName: e.target.value })} /></Field>
            <Field label={t('weightT')} required error={err('weightT')}><input className={`${INPUT} font-mono`} type="number" min={0.1} max={10000} step={0.1} inputMode="decimal" value={d.weightT} onChange={(e) => set({ weightT: e.target.value })} /></Field>
            <Field label={t('loadDate')} required error={err('loadDate')}><input className={`${INPUT} font-mono`} type="date" min={uzToday()} value={d.loadDate} onChange={(e) => set({ loadDate: e.target.value })} /></Field>
          </div>
          <Field label={t('truckType')} error={err('truckType')}>
            <select className={INPUT} value={d.truckType} onChange={(e) => set({ truckType: e.target.value })}>
              <option value="">{t('truckAny')}</option>
              {TRUCK_TYPES.map((x) => <option key={x} value={x}>{L.truck(x)}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('serviceType')} required error={err('serviceType')}>
            <select className={INPUT} value={d.serviceType} onChange={(e) => set({ serviceType: e.target.value })}>
              <option value="">{t('typePick')}</option>
              {SERVICE_TYPES.map((x) => <option key={x} value={x}>{L.service[x as ServiceType]}</option>)}
            </select>
          </Field>
          <Field label={t('region')} required error={err('regionCode')}>
            <select className={INPUT} value={d.regionCode} onChange={(e) => set({ regionCode: e.target.value })}>{regionOptions(t('regionPick'))}</select>
          </Field>
        </div>
      )}
      <Field label={t('title')} required error={err('title')}>
        <input className={INPUT} maxLength={120} placeholder={cargo ? t('titlePhCargo') : t('titlePhService')} value={d.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label={t('description')} required error={err('description')}>
        <textarea className={INPUT} rows={4} maxLength={2000} placeholder={cargo ? t('descriptionPhCargo') : t('descriptionPhService')} value={d.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label={t('phone')} hint={t('phoneHint')} error={err('contactPhone')}>
        <input className={`${INPUT} font-mono`} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={d.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
      </Field>
      {top ? <Notice tone="err">{top}</Notice> : null}
      <div><button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? t('sending') : t('submit')}</button></div>
    </form>
  );
}
