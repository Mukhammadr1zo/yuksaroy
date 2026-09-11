'use client';
// Mening obyektlarim: terminal, shahobcha yo'l, texnika va avtotransport e'lonlari BITTA ro'yxatda.
// Ilgari uch xil sahifa edi (E'lonlarim, Terminallar, Shahobchalarim) va qaysi biri qaerdaligini topish qiyin edi.
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PathIcon, ShippingContainerIcon, TrainIcon, TruckIcon, type Icon } from '@phosphor-icons/react';
import { CLAIM_STATUS_LABELS, type ClaimStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import type { MySiding, MyTerminal, OwnerListing } from '@/lib/types-kabinet';
import { BTN_PRIMARY, CHIP, ListingStatusPill, useLang } from '@/components/kabinet/bits';

type Kind = 'terminal' | 'siding' | 'equipment' | 'truck';
const ICON: Record<Kind, Icon> = { terminal: ShippingContainerIcon, siding: PathIcon, equipment: TrainIcon, truck: TruckIcon };
const TONE: Record<Kind, string> = {
  terminal: 'bg-[#FD7B03] text-white', siding: 'border-2 border-teal bg-white text-teal',
  equipment: 'bg-navy text-white', truck: 'border-2 border-[#FD7B03] bg-white text-[#FD7B03]',
};
const FILTERS: (Kind | 'all')[] = ['all', 'terminal', 'siding', 'equipment', 'truck'];

type Row = {
  key: string; kind: Kind; title: string; sub: string; href: string; publicHref: string | null;
  status: React.ReactNode; fact: string | null;
};

export default function ObjectsPage() {
  const t = useTranslations('kabinet.objects');
  const tc = useTranslations('kabinet.common');
  const tr = useTranslations('region');
  const tk = useTranslations('kind');
  const locale = useLocale();
  const lang = useLang();
  const [terminals, setTerminals] = useState<MyTerminal[] | null>(null);
  const [sidings, setSidings] = useState<MySiding[] | null>(null);
  const [listings, setListings] = useState<OwnerListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [only, setOnly] = useState<Kind | 'all'>('all');

  useEffect(() => {
    let alive = true;
    const fail = () => { if (alive) setFailed(true); };
    api<MyTerminal[]>('/terminals/mine').then((r) => alive && setTerminals(r)).catch(() => { setTerminals([]); fail(); });
    api<{ items: MySiding[] }>('/sidings/mine').then((r) => alive && setSidings(r.items)).catch(() => { setSidings([]); fail(); });
    api<OwnerListing[]>('/listings/mine').then((r) => alive && setListings(r)).catch(() => { setListings([]); fail(); });
    return () => { alive = false; };
  }, []);

  const region = (code: string | null) => (code && tr.has(code) ? tr(code) : null);

  const rows: Row[] | null = useMemo(() => {
    if (!terminals || !sidings || !listings) return null;
    const out: Row[] = [];
    for (const x of terminals) out.push({
      key: `t:${x.id}`, kind: 'terminal', title: x.name,
      sub: [tk(x.kind), x.station?.nameUz, region(x.regionCode)].filter(Boolean).join(' · '),
      href: `/dashboard/terminals/${x.id}`, publicHref: x.status === 'ACTIVE' ? `/terminals/${x.slug}` : null,
      status: <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.status === 'ACTIVE' ? 'bg-teal text-white' : 'bg-line text-ink/70'}`}>{t(`terminalStatus.${x.status}`)}</span>,
      fact: x.freeToday !== undefined ? t('freeToday', { count: x.freeToday }) : null,
    });
    for (const x of sidings) out.push({
      key: `s:${x.id}`, kind: 'siding', title: `${x.station?.nameUz ?? x.stationNameRaw} No ${x.registryNo}`,
      sub: [region(x.regionCode), x.lengthM != null ? `${num(x.lengthM, locale)} m` : null].filter(Boolean).join(' · '),
      href: `/dashboard/sidings/${x.id}`, publicHref: x.claimStatus === 'APPROVED' ? `/sidings/${x.id}` : null,
      status: <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.claimStatus === 'APPROVED' ? 'bg-teal text-white' : 'bg-amber-soft text-amber-ink'}`}>{CLAIM_STATUS_LABELS[lang][x.claimStatus as ClaimStatus]}</span>,
      fact: x.claimedAt ? t('claimedAt', { date: uzDate(x.claimedAt, locale) }) : null,
    });
    for (const x of listings) out.push({
      key: `l:${x.id}`, kind: x.kind === 'TRUCK' ? 'truck' : 'equipment', title: x.title,
      sub: [region(x.regionCode), x.model].filter(Boolean).join(' · '),
      href: `/dashboard/listings/${x.id}`, publicHref: x.status === 'ACTIVE' ? `/${x.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${x.slug}` : null,
      status: <ListingStatusPill status={x.status} />,
      fact: x.status === 'ACTIVE' ? t('views', { count: x.views }) : null,
    });
    return out;
  }, [terminals, sidings, listings]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = rows?.filter((r) => only === 'all' || r.kind === only) ?? null;
  const count = (k: Kind | 'all') => (k === 'all' ? rows?.length ?? 0 : rows?.filter((r) => r.kind === k).length ?? 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('lead')}</p>
        </div>
        <Link href="/dashboard/listings/new" className={BTN_PRIMARY}>{t('add')}</Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((k) => (
          <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)} className={CHIP(only === k)}>
            {t(`filter.${k}`)} <span className="font-mono text-[11px] opacity-70">{count(k)}</span>
          </button>
        ))}
      </div>

      {failed ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}
      {!rows && !failed ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}

      {shown && shown.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t('empty')}</p>
          <Link href="/dashboard/listings/new" className={`${BTN_PRIMARY} mt-4 inline-block`}>{t('add')}</Link>
        </div>
      ) : null}

      {shown && shown.length ? (
        <ul className="mt-4 space-y-2">
          {shown.map((r) => {
            const I = ICON[r.kind];
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white p-3 sm:p-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[r.kind]}`}>
                  <I size={18} weight="duotone" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={r.href} className="block truncate font-semibold hover:text-teal-ink">{r.title}</Link>
                  <p className="truncate text-xs text-muted">{r.sub || t(`filter.${r.kind}`)}</p>
                </div>
                {r.fact ? <span className="hidden font-mono text-xs text-muted sm:block">{r.fact}</span> : null}
                {r.status}
                {r.publicHref ? <Link href={r.publicHref} className="font-mono text-xs text-teal-ink underline decoration-dotted">{t('open')}</Link> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
