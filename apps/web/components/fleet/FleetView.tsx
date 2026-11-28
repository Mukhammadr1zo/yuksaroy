'use client';
/**
 * «Mening vagonlarim»: vagon operatorining parki (sayt kabineti va Mini App bir xil komponent).
 *
 * Egasi so'ragandek sodda: qaysi vagon qayerda, yuklangan yoki bo'sh, qaysi poyezdda. Kechikish va
 * "turib qolgan" yo'q; faqat bo'sh vagon 3 sutkadan ortiq tursa belgi. Poyezd tugmasi bosilsa
 * tarkibdagi hamma vagon: raqam, egasi va davlat bayrog'i (operatorning o'zinikilari ajratilgan).
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CaretDownIcon, CaretUpIcon, MagnifyingGlassIcon, SealCheckIcon, TrainIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { openOut } from '@/lib/open-out';

type Wagon = {
  no: string; station: string; mtu: string; op: string; loaded: boolean; cargo: string; dest: string; from: string; loadDate: string;
  train: string; trainSize: number; idleDays: number | null; opAt: number | null;
};
type Park = { org: { id: string; name: string }; park: { company: string; ref: number; count: number; wagons: Wagon[] }; idleDays: number };
type TrainWagon = { no: string; owner: string; company: string; country: string; loaded: boolean; cargo: string };
type Train = { ix: string; count: number; station: string; wagons: TrainWagon[] };
type Filter = 'all' | 'loaded' | 'empty' | 'inTrain' | 'idle';

/** Davlat bayrog'i oddiy chiziqlar bilan: emoji bayroq Windows'da ikki harf bo'lib chiqadi. */
const FLAG: Record<string, { bg: string; title: string }> = {
  UZ: { bg: 'linear-gradient(#1eb5e6 0 33%,#fff 33% 38%,#c00 38% 40%,#fff 40% 60%,#c00 60% 62%,#fff 62% 67%,#1eb53a 67%)', title: "O'zbekiston" },
  KZ: { bg: '#00afca', title: "Qozog'iston" },
  RU: { bg: 'linear-gradient(#fff 0 33%,#0039a6 33% 66%,#d52b1e 66%)', title: 'Rossiya' },
  TJ: { bg: 'linear-gradient(#cc0000 0 30%,#fff 30% 70%,#006600 70%)', title: 'Tojikiston' },
  KG: { bg: '#e8112d', title: "Qirg'iziston" },
  TM: { bg: '#00843d', title: 'Turkmaniston' },
  AF: { bg: 'linear-gradient(90deg,#000 0 33%,#d32011 33% 66%,#007a36 66%)', title: "Afg'oniston" },
};
function Flag({ c }: { c: string }) {
  const f = FLAG[c];
  return <span title={f?.title ?? '-'} aria-label={f?.title ?? '-'} className="inline-block h-3 w-[18px] shrink-0 rounded-[2px] border border-line" style={{ background: f?.bg ?? 'var(--color-line, #ddd)' }} />;
}

const PAGE = 60;
const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** external: Mini App ichida tashkilot sahifasi (sayt) Telegram brauzerida ochilsin, web view almashmasin. */
export function FleetView({ orgHref, card, external }: { orgHref: string; card: string; external?: boolean }) {
  const t = useTranslations('fleet');
  const locale = useLocale();
  const [data, setData] = useState<Park | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [trains, setTrains] = useState<Record<string, Train | 'busy' | 'err'>>({});

  useEffect(() => {
    api<Park>('/fleet/me').then(setData).catch((e) => setErr(e instanceof ApiError ? (e.body?.code ?? 'generic') : 'generic'));
  }, []);

  const ws = data?.park.wagons ?? [];
  const idleDays = data?.idleDays ?? 3;
  const isIdle = (w: Wagon) => !w.loaded && !w.train && (w.idleDays ?? 0) >= idleDays;
  const list = useMemo(() => {
    const k = key(q);
    return ws.filter((w) => (f === 'all' || (f === 'loaded' ? w.loaded : f === 'empty' ? !w.loaded : f === 'inTrain' ? !!w.train : isIdle(w)))
      && (!k || w.no.includes(k) || key(w.station).includes(k) || key(w.dest).includes(k)));
  }, [ws, f, q]);

  function toggleTrain(w: Wagon) {
    const id = `${w.no}:${w.train}`;
    setOpen(open === id ? null : id);
    if (trains[w.train] && trains[w.train] !== 'err') return;
    setTrains((p) => ({ ...p, [w.train]: 'busy' }));
    api<Train>(`/fleet/train/${encodeURIComponent(w.train)}`)
      .then((tr) => setTrains((p) => ({ ...p, [w.train]: tr })))
      .catch(() => setTrains((p) => ({ ...p, [w.train]: 'err' })));
  }

  if (err === 'FLEET_NONE') {
    return (
      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-bold">{t('none.title')}</h2>
        <p className="mt-2 text-sm text-muted">{t('none.body')}</p>
        <Link href={orgHref} onClick={external ? openOut(locale, orgHref) : undefined} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-teal px-5 text-sm font-semibold text-white">{t('none.cta')}</Link>
      </section>
    );
  }
  if (err) return <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t(`errors.${['FLEET_NOT_CONFIGURED', 'FLEET_UPSTREAM'].includes(err) ? err : 'generic'}`)}</p>;
  if (!data) return <p className="text-sm text-muted">{t('title')}</p>;

  const n = { total: ws.length, loaded: ws.filter((w) => w.loaded).length, empty: ws.filter((w) => !w.loaded).length, inTrain: ws.filter((w) => w.train).length };
  const idleN = ws.filter(isIdle).length;
  const mine = key(data.park.company);
  const FILTERS: Filter[] = ['all', 'loaded', 'empty', 'inTrain', 'idle'];

  return (
    <div>
      <p className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-xs font-semibold text-teal-ink"><SealCheckIcon size={14} weight="fill" aria-hidden="true" />{t('verified')}</p>
      <p className="mt-2 text-sm font-semibold">{data.org.name}</p>
      {data.park.ref ? <p className="text-xs text-muted">{t('asOf', { at: uzDateTime(new Date(data.park.ref).toISOString(), locale) })}</p> : null}

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {(['total', 'loaded', 'empty', 'inTrain'] as const).map((k) => (
          <div key={k} className={`${card} px-1 py-2.5`}><p className="font-mono text-lg font-bold tabular-nums">{n[k]}</p><p className="text-[11px] text-muted">{t(`kpi.${k}`)}</p></div>
        ))}
      </div>

      {idleN ? (
        <button type="button" onClick={() => { setF('idle'); setShown(PAGE); }} className="mt-3 w-full rounded-xl border border-amber/40 bg-amber-soft p-3 text-left text-sm text-amber-ink">
          {t('idleBanner', { n: idleN, days: idleDays })}
        </button>
      ) : null}

      <label className="relative mt-4 block">
        <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder={t('searchPh')} aria-label={t('searchPh')}
          className="min-h-11 w-full rounded-full border border-line bg-white pl-9 pr-4 text-sm" />
      </label>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((x) => (
          <button key={x} type="button" onClick={() => { setF(x); setShown(PAGE); }} aria-pressed={f === x}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${f === x ? 'border-navy bg-navy text-white' : 'border-line bg-white'}`}>
            {t(`filter.${x}`, { days: idleDays })}
          </button>
        ))}
      </div>

      {list.length === 0 ? <p className="mt-4 text-sm text-muted">{t('empty')}</p> : null}
      <ul className="mt-3 space-y-2">
        {list.slice(0, shown).map((w) => {
          const id = `${w.no}:${w.train}`;
          const tr = w.train ? trains[w.train] : undefined;
          return (
            <li key={w.no} className={`${card} p-3`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">{w.no}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${w.loaded ? 'bg-teal text-white' : 'bg-line text-ink'}`}>{t(`state.${w.loaded ? 'loaded' : 'empty'}`)}</span>
                {isIdle(w) ? <span className="ml-auto rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber-ink">{t('idle', { n: Math.floor(w.idleDays ?? 0) })}</span> : null}
              </div>
              <p className="mt-1 text-sm"><b>{w.station || '-'}</b>{w.dest ? <span className="text-muted"> → {w.dest}</span> : null}</p>
              {w.loaded && (w.cargo || w.from) ? (
                <p className="text-xs text-muted">{[w.cargo, w.from ? t('from', { from: w.from }) : ''].filter(Boolean).join(' · ')}</p>
              ) : null}
              {w.train ? (
                <>
                  <button type="button" onClick={() => toggleTrain(w)} aria-expanded={open === id}
                    className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-xl bg-sand px-3 py-2 text-left text-sm">
                    <TrainIcon size={18} weight="duotone" className="shrink-0 text-teal" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><b>{t('train', { ix: w.train })}</b> <span className="text-muted">· {t('trainSize', { n: w.trainSize })}</span></span>
                    {open === id ? <CaretUpIcon size={16} aria-hidden="true" /> : <CaretDownIcon size={16} aria-hidden="true" />}
                  </button>
                  {open === id ? (
                    tr === 'busy' || !tr ? <p className="mt-2 text-xs text-muted">{t('trainLoading')}</p>
                      : tr === 'err' ? <p className="mt-2 text-xs text-red-700">{t('trainFailed')}</p>
                        : (
                          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                            {tr.wagons.map((x) => {
                              const own = key(x.company) === mine;
                              return (
                                <li key={x.no} className={`flex items-center gap-2 px-3 py-2 text-xs ${own ? 'bg-teal-soft' : ''}`}>
                                  <Flag c={x.country} />
                                  <span className="w-[68px] shrink-0 font-mono font-semibold tabular-nums">{x.no}</span>
                                  <span className="min-w-0 flex-1 truncate text-muted">{x.owner || x.company || t('ownerUnknown')}</span>
                                  {own ? <span className="shrink-0 font-semibold text-teal-ink">{t('mine')}</span> : null}
                                </li>
                              );
                            })}
                          </ul>
                        )
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      {list.length > shown ? (
        <button type="button" onClick={() => setShown((s) => s + PAGE)} className="mt-3 min-h-11 w-full rounded-full border border-line bg-white text-sm font-semibold">
          {t('more', { n: list.length - shown })}
        </button>
      ) : null}
    </div>
  );
}
