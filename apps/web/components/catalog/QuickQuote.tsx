'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { OPERATIONS, type Operation, type ServiceCode } from '@yuksaroy/domain';
import { ApiError, post } from '@/lib/api';
import { pricePer, som, stationName} from '@/lib/format';
import type { QuoteOffer, QuoteResponse } from '@/lib/types';
import { CargoSearch, type CargoPick } from './CargoSearch';
import { StationSearch, type StationPick } from './StationSearch';
import { DashLink } from '@/components/site/DashLink';

const EXTRAS: ServiceCode[] = ['WEIGH', 'STORAGE', 'CONTAINER', 'SVX', 'LAST_MILE', 'SHUNTING'];
type Tone = 'light' | 'dark';
const INPUT: Record<Tone, string> = {
  light: 'w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-teal focus:ring-2 focus:ring-teal/25',
  dark: 'w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50 focus:border-teal focus:ring-2 focus:ring-teal/30',
};

/**
 * «Tez hisob», login'siz. compact: hero (stansiya + yuk + vazn). To'liq: /quote (operatsiya, qo'shimchalar, kunlar).
 * terminalId berilsa, faqat shu terminal uchun. tone=dark, to'q fon (landing) uchun.
 */
export function QuickQuote({ compact = false, terminalId, terminalName, tone = 'light' }: { compact?: boolean; terminalId?: string; terminalName?: string; tone?: Tone }) {
  const t = useTranslations('quote');
  const tb = useTranslations('booking.quick');
  const ts = useTranslations('service');
  const [station, setStation] = useState<StationPick | null>(null);
  const [cargo, setCargo] = useState<CargoPick | null>(null);
  const [weightT, setWeightT] = useState('62');
  const [operation, setOperation] = useState<Operation>('LOAD');
  const [wagons, setWagons] = useState('1');
  const [days, setDays] = useState('1');
  const [extras, setExtras] = useState<ServiceCode[]>(compact ? [] : ['WEIGH']);
  const [res, setRes] = useState<QuoteResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dark = tone === 'dark';
  const muted = dark ? 'text-white/60' : 'text-muted';

  async function calc(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setRes(null);
    const weightKg = Math.round(Number(weightT.replace(',', '.')) * 1000);
    if (!terminalId && !station) return setErr(t('err.selectStation'));
    if (!(weightKg > 0)) return setErr(t('err.enterWeight'));
    setBusy(true);
    try {
      setRes(await post<QuoteResponse>('/quote', {
        terminalId, stationId: terminalId ? undefined : station!.id, operation, cargoCode: cargo?.code, weightKg,
        wagonCount: Number(wagons) || undefined, storageDays: extras.includes('STORAGE') ? Number(days) || 1 : undefined, services: extras,
      }));
    } catch (e) {
      const code = e instanceof ApiError ? e.body?.code : null;
      setErr(code === 'STATION_NOT_FOUND' ? t('err.stationNotFound') : code === 'TERMINAL_NOT_FOUND' ? t('err.terminalNotFound') : t('err.generic'));
    } finally { setBusy(false); }
  }

  return (
    <div>
      <form onSubmit={calc} className={compact ? 'grid gap-3 md:grid-cols-[1.2fr_1.2fr_.7fr_auto]' : 'grid gap-4'}>
        {terminalId ? (
          <p className={`rounded-xl px-4 py-3 text-sm ${compact ? 'md:col-span-2' : ''} ${dark ? 'bg-white/10' : 'bg-teal-soft'}`}>{t('terminalPrefix')} <b>{terminalName}</b></p>
        ) : (
          <StationSearch value={station} onChange={setStation} placeholder={t('station.placeholder')} inputClassName={INPUT[tone]} />
        )}
        <CargoSearch value={cargo} onChange={setCargo} placeholder={compact ? t('cargo.placeholderCompact') : undefined} inputClassName={INPUT[tone]} />
        <label className="relative block">
          <input inputMode="decimal" className={`${INPUT[tone]} pr-8 font-mono`} value={weightT} onChange={(e) => setWeightT(e.target.value)} aria-label={t('weight.aria')} />
          <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>t</span>
        </label>
        {!compact && (
          <div className="grid gap-4 sm:grid-cols-3">
            {/* legend fieldset ning birinchi bolasi bo'lishi shart va brauzer uni
                maxsus joylashtiradi. Fieldset ning o'ziga flex berilsa legend ham
                flex elementiga aylanib, tugmalarni siqib chiqaradi va ular qo'shni
                maydon ustiga chiqib ketadi. Shuning uchun flex ichki div da. */}
            <fieldset>
              <legend className={`mb-1 text-xs font-semibold ${muted}`}>{t('field.operation')}</legend>
              <div className="flex gap-2">
                {OPERATIONS.map((op) => (
                  <label key={op} className={`flex-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal has-[:focus-visible]:outline-offset-2 cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold ${operation === op ? 'border-teal bg-teal-soft text-teal-ink' : dark ? 'border-white/15 bg-white/5' : 'border-line bg-white'}`}>
                    <input type="radio" name="op" className="sr-only" checked={operation === op} onChange={() => setOperation(op)} />{ts(op)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={`block text-xs font-semibold ${muted}`}>{t('field.wagons')}
              <input inputMode="numeric" className={`${INPUT[tone]} mt-1 font-mono text-base font-normal`} value={wagons} onChange={(e) => setWagons(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>{t('field.storageDays')}
              <input inputMode="numeric" disabled={!extras.includes('STORAGE')} className={`${INPUT[tone]} mt-1 font-mono text-base font-normal disabled:opacity-50`} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
        )}
        {!compact && (
          <fieldset>
            <legend className={`mb-2 text-xs font-semibold ${muted}`}>{t('extras.legend')}</legend>
            <div className="flex flex-wrap gap-2">
              {EXTRAS.map((s) => {
                const on = extras.includes(s);
                return (
                  <label key={s} className={`has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal has-[:focus-visible]:outline-offset-2 cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? 'border-teal bg-teal-soft text-teal-ink' : dark ? 'border-white/15 bg-white/5' : 'border-line bg-white'}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setExtras(on ? extras.filter((x) => x !== s) : [...extras, s])} />{ts(s)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <button disabled={busy} className="rounded-full bg-teal px-6 py-3 font-semibold text-white transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-teal-ink active:scale-[0.98] disabled:opacity-60">{busy ? t('submit.busy') : tb('submit')}</button>
      </form>
      {err && <p role="alert" className={`mt-3 text-sm ${dark ? 'text-amber-soft' : 'text-red-700'}`}>{err}</p>}
      {res && (
        <div className="mt-5 space-y-3">
          {res.offers.length === 0 && <p className={`text-sm ${muted}`}>{t('result.empty', { operation: ts(operation).toLowerCase() })}</p>}
          {res.offers[0]?.nearby && <p className={`text-xs ${muted}`}>{t('result.nearbyNote')}</p>}
          {res.offers.map((o) => <Offer key={o.terminal.id} o={o} full={!compact} dark={dark} />)}
          {compact && res.offers.length > 0 && <Link href="/quote" className={`inline-block text-sm font-semibold underline ${dark ? 'text-teal-soft' : 'text-teal-ink'}`}>{t('result.detailLink')}</Link>}
        </div>
      )}
    </div>
  );
}

function Offer({ o, full, dark }: { o: QuoteOffer; full: boolean; dark: boolean }) {
  const locale = useLocale();
  const t = useTranslations('quote');
  const tb = useTranslations('booking.quick');
  const ts = useTranslations('service');
  const tu = useTranslations('unit');
  const tk = useTranslations('kind');
  const muted = dark ? 'text-white/60' : 'text-muted';
  return (
    <div className={`rounded-xl border p-4 ${dark ? 'border-white/15 bg-white/5' : 'border-line bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 wrap-anywhere">
          <Link href={`/terminals/${o.terminal.slug}`} className="font-bold hover:text-teal-ink">{o.terminal.name}</Link>
          <p className={`text-xs ${muted}`}>{tk(o.terminal.kind)}, {stationName(o.terminal)}{o.terminal.is24h ? ', 24/7' : ''}{!o.terminal.claimed ? t('offer.approxTariff') : ''}</p>
        </div>
        <p className={`font-display text-xl font-bold tabular-nums ${dark ? 'text-white' : 'text-navy'}`}>{som(o.totalTiyin, locale)}</p>
      </div>
      {full && (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.serviceCode} className={`border-t ${dark ? 'border-white/10' : 'border-line/70'}`}>
                <td className="py-1.5">{ts(l.serviceCode)}</td>
                <td className={`py-1.5 font-mono text-xs ${muted}`}>{l.qty} {tu(l.unit)} × {pricePer(l.unitPriceTiyin, l.unit, locale)}{l.minApplied ? ` ${t('offer.minApplied')}` : ''}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{som(l.amountTiyin, locale)}</td>
              </tr>
            ))}
            {o.commissionPayer === 'CLIENT' && o.commissionTiyin > 0 && (
              <tr className={`border-t ${dark ? 'border-white/10' : 'border-line/70'}`}><td className="py-1.5">{t('offer.commission', { pct: o.commissionPct / 100 })}</td><td /><td className="py-1.5 text-right font-mono">{som(o.commissionTiyin, locale)}</td></tr>
            )}
          </tbody>
        </table>
      )}
      {o.missing.length > 0 && <p className="mt-2 text-xs text-amber">{t('offer.missing', { services: o.missing.map((m) => ts(m)).join(', ') })}</p>}
      <div className="mt-3 flex gap-2">
        <Link href={`/terminals/${o.terminal.slug}`} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${dark ? 'border-white/20 hover:bg-white/10' : 'border-line hover:bg-sand'}`}>{tb('passport')}</Link>
        {/* Kirmaganni proxy /login?next=... ga yuboradi; kirgan vizardga shu terminal bilan tushadi */}
        <DashLink href={`/dashboard/orders/new?terminal=${o.terminal.slug}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white ${dark ? 'bg-teal hover:bg-teal-ink' : 'bg-navy hover:bg-navy-2'}`}>{t('offer.book')}</DashLink>
      </div>
    </div>
  );
}
