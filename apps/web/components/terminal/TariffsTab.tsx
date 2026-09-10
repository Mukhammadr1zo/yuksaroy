'use client';
// Tariflar: amaldagi jadval (tarix bilan), yangi versiya e'lon qilish (so'm -> tiyin). API xato kodlari terminalsAdmin.tariffs.err da.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SERVICE_CODES, TARIFF_UNITS, uzLocalToUtc, type ServiceCode, type TariffUnit } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { som, uzDate } from '@/lib/format';
import type { Tariff } from '@/lib/types';
import { BTN_PRIMARY, Field, INPUT, Notice, errText } from '@/components/kabinet/bits';
import { CargoSearch, type CargoPick } from '@/components/catalog/CargoSearch';

export function TariffsTab({ terminalId, services }: { terminalId: string | null; services: ServiceCode[] }) {
  const t = useTranslations('terminalsAdmin.tariffs');
  const locale = useLocale();
  const te = useTranslations('terminalsAdmin.tariffs.err');
  const tc = useTranslations('kabinet.common');
  const ts = useTranslations('service');
  const tu = useTranslations('unit');
  const codes = services.length ? services : SERVICE_CODES;
  const [history, setHistory] = useState(false);
  const [items, setItems] = useState<Tariff[] | null>(null);
  const [err, setErr] = useState(false);
  const [f, setF] = useState({ serviceCode: codes[0]!, cargo: null as CargoPick | null, som: '', unit: 'PER_TON' as TariffUnit, minSom: '', validFrom: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const load = useCallback(() => {
    if (!terminalId) return;
    api<Tariff[]>(`/terminals/${terminalId}/tariffs${history ? '?history=1' : ''}`).then(setItems).catch(() => setErr(true));
  }, [terminalId, history]);
  useEffect(() => { void load(); }, [load]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!terminalId) return;
    const price = Number(f.som);
    if (!(price > 0)) { setNotice({ tone: 'err', text: te('PRICE_REQUIRED') }); return; }
    setBusy(true); setNotice(null);
    try {
      await post(`/terminals/${terminalId}/tariffs`, {
        serviceCode: f.serviceCode, cargoGroupCode: f.cargo?.groupCode || undefined, priceTiyin: Math.round(price * 100), unit: f.unit,
        minTiyin: f.minSom.trim() ? Math.round(Number(f.minSom) * 100) : undefined,
        validFrom: f.validFrom ? uzLocalToUtc(f.validFrom, '00:00').toISOString() : undefined, note: f.note.trim() || undefined,
      });
      setNotice({ tone: 'ok', text: t('published') }); set({ som: '', minSom: '', note: '' }); load();
    } catch (e) { setNotice({ tone: 'err', text: errText(e, te, te.has, tc('failed')) }); } finally { setBusy(false); }
  }

  const now = Date.now();
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('lead')}</p>

      <section className="rounded-card border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">{t('current')}</h2>
          <button type="button" aria-pressed={history} onClick={() => setHistory((h) => !h)} className="text-sm font-semibold text-teal-ink underline">{history ? t('hideHistory') : t('history')}</button>
        </div>
        {err ? <p role="alert" className="px-4 py-3 text-sm text-red-700">{tc('loadFailed')}</p> : null}
        {terminalId && !items && !err ? <p className="px-4 py-3 text-sm text-muted">{tc('loading')}</p> : null}
        {(!terminalId || items?.length === 0) ? <p className="px-4 py-6 text-sm text-muted">{t('empty')}</p> : null}
        {items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-semibold">{t('col.service')}</th>
                  <th className="px-4 py-2 font-semibold">{t('col.cargoGroup')}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t('col.price')}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t('col.min')}</th>
                  <th className="px-4 py-2 font-semibold">{t('col.validFrom')}</th>
                  <th className="px-4 py-2 font-semibold">{t('col.validTo')}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t('col.version')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => {
                  const past = x.validTo != null && new Date(x.validTo).getTime() <= now;
                  return (
                    <tr key={x.id} className={`border-b border-line/70 last:border-0 ${past ? 'text-muted' : ''}`}>
                      <td className="px-4 py-2 font-semibold">{ts(x.serviceCode)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted">{x.cargoGroupCode ?? t('allCargo')}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">{som(x.priceTiyin, locale)} <span className="text-muted">/ {tu(x.unit)}</span></td>
                      <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{x.minTiyin ? som(x.minTiyin, locale) : '·'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{uzDate(x.validFrom, locale)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{x.validTo ? uzDate(x.validTo, locale) : <span className="text-teal-ink">{t('open')}</span>}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">v{x.version}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <form onSubmit={publish} className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('new')}</h2>
        {!services.length ? <p className="text-xs text-amber-ink">{t('hint.noServices')}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.service')} required>
            <select className={INPUT} value={f.serviceCode} onChange={(e) => set({ serviceCode: e.target.value as ServiceCode })}>
              {codes.map((c) => <option key={c} value={c}>{ts(c)}</option>)}
            </select>
          </Field>
          <Field group label={t('field.cargoGroup')} hint={t('hint.cargoGroup')}>
            <CargoSearch value={f.cargo} onChange={(c) => set({ cargo: c })} inputClassName={INPUT} />
          </Field>
          <Field label={t('field.priceSom')} required hint={t('hint.priceSom')}>
            <input type="number" min={1} step={1} inputMode="numeric" className={`${INPUT} font-mono`} value={f.som} onChange={(e) => set({ som: e.target.value })} />
          </Field>
          <Field label={t('field.unit')} required>
            <select className={INPUT} value={f.unit} onChange={(e) => set({ unit: e.target.value as TariffUnit })}>
              {TARIFF_UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
            </select>
          </Field>
          <Field label={t('field.minSom')}>
            <input type="number" min={0} step={1} inputMode="numeric" className={`${INPUT} font-mono`} value={f.minSom} onChange={(e) => set({ minSom: e.target.value })} />
          </Field>
          <Field label={t('field.validFrom')} hint={t('hint.validFrom')}>
            <input type="date" className={`${INPUT} font-mono`} value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
          </Field>
        </div>
        <Field label={t('field.note')}>
          <input className={INPUT} value={f.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        <button type="submit" disabled={busy || !terminalId} className={BTN_PRIMARY}>{busy ? tc('saving') : t('publish')}</button>
      </form>
    </div>
  );
}
