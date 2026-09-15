'use client';
/**
 * Moderatsiya navbatlari: e'lonlar, KYC, obyekt da'volari, Premium to'lovlar, murojaatlar.
 * Shahobcha ham terminal, shuning uchun da'vo navbati bitta: ilgari ikkita bo'lim bir xil
 * qatorlarni ko'rsatib, qarorni ikki xil endpointga yuborardi.
 * Faol bo'lim URL da (?tab=), shunda bosh sahifadagi "kutilmoqda" havolalari to'g'ri bo'limga olib keladi.
 */
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { LISTING_OWNER_LABELS, ORG_KIND_LABELS } from '@yuksaroy/domain';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som, stationName, uzDateTime } from '@/lib/format';
import { listingHref, type AdminTerminal, type OrgRecord, type OwnerListing } from '@/lib/types-kabinet';
import type { AdminPremiumOrder, ContactPage } from '@/lib/types-trust';
import { useLang, useListingLabels } from '@/components/kabinet/bits';
import { BTN, CARD, Notice, PageHead, Pill } from '@/components/admin/kit';
import { Decide, type Decision } from '@/components/admin/Decide';

type Tab = 'listings' | 'kyc' | 'claims' | 'premium' | 'contact';
const TABS: Tab[] = ['listings', 'kyc', 'claims', 'premium', 'contact'];
const isTab = (v: string | null): v is Tab => TABS.includes(v as Tab);

type Flash = { text: string; tone: 'ok' | 'bad' } | null;

export default function ModerationPage() {
  const tc = useTranslations('admin.common');
  // useSearchParams statik renderda Suspense talab qiladi
  return <Suspense fallback={<p className="text-sm text-muted">{tc('loading')}</p>}><Moderation /></Suspense>;
}

function Moderation() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tp = useTranslations('premium');
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams().get('tab');
  const tab: Tab = isTab(q) ? q : 'listings';

  const [listings, setListings] = useState<OwnerListing[] | null>(null);
  const [orgs, setOrgs] = useState<OrgRecord[] | null>(null);
  const [claims, setClaims] = useState<AdminTerminal[] | null>(null);
  const [prem, setPrem] = useState<AdminPremiumOrder[] | null>(null);
  const [msgs, setMsgs] = useState<ContactPage | null>(null);
  const [err, setErr] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    // Har navbat alohida: biri yiqilsa qolgan bo'limlar ko'rinaveradi, xato esa bir marta e'lon qilinadi
    const fail = () => setErr(true);
    void api<OwnerListing[]>('/admin/listings?status=PENDING_REVIEW').then(setListings).catch(fail);
    void api<OrgRecord[]>('/admin/orgs?kyc=PENDING').then(setOrgs).catch(fail);
    // /admin/terminals hamma turni qamraydi (shahobcha ham shu yerda), /admin/sidings uning bir qismi edi
    void api<AdminTerminal[]>('/admin/terminals?claim=PENDING').then(setClaims).catch(fail);
    void api<AdminPremiumOrder[]>('/admin/premium?status=PENDING').then(setPrem).catch(fail);
    void api<ContactPage>('/admin/contact').then(setMsgs).catch(fail);
  }, []);

  const counts: Record<Tab, number | null> = { listings: listings?.length ?? null, kyc: orgs?.length ?? null, claims: claims?.length ?? null, premium: prem?.length ?? null, contact: msgs?.total ?? null };
  const tabLabel = (k: Tab) => (k === 'premium' ? tp('admin.tab') : k === 'contact' ? tp('messages.tab') : t(`tabs.${k}`));
  const emptyText = tab === 'premium' ? tp('admin.empty') : tab === 'contact' ? tp('messages.empty') : t('empty');

  // Qaror berilgan qator ro'yxatdan chiqadi, natija esa ro'yxat tepasida bir qator bo'lib qoladi
  const decided = (d: Decision) => setFlash({ text: t(`decided.${d}`), tone: d === 'approved' ? 'ok' : 'bad' });
  const drop = <T extends { id: string }>(set: (f: (xs: T[] | null) => T[] | null) => void, id: string) => set((xs) => xs?.filter((x) => x.id !== id) ?? null);

  const loaded = counts[tab] !== null;
  const rows = tab === 'listings' ? listings?.map((l) => <ListingRow key={l.id} l={l} onDone={(d) => { drop(setListings, l.id); decided(d); }} />)
    : tab === 'kyc' ? orgs?.map((o) => <OrgRow key={o.id} o={o} onDone={(d) => { drop(setOrgs, o.id); decided(d); }} />)
    : tab === 'claims' ? claims?.map((x) => <TerminalClaimRow key={x.id} x={x} onDone={(d) => { drop(setClaims, x.id); decided(d); }} />)
    : tab === 'premium' ? prem?.map((o) => <PremiumRow key={o.id} o={o} onDone={(text) => { drop(setPrem, o.id); setFlash({ text, tone: 'ok' }); }} />)
    : msgs?.items.map((m) => <ContactRow key={m.id} m={m} />);

  return (
    <>
      <PageHead title={t('nav.moderation')} lead={t('moderation.lead')} />

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k}
            onClick={() => { setFlash(null); router.replace(`${pathname}?tab=${k}`, { scroll: false }); }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${tab === k ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`}>
            {tabLabel(k)}{counts[k] ? <span className={`ml-1.5 font-mono text-xs tabular-nums ${tab === k ? 'text-white/70' : 'text-muted'}`}>{counts[k]}</span> : null}
          </button>
        ))}
      </div>

      {err ? <Notice tone="err">{tc('loadFailed')}</Notice> : null}
      {flash ? <p role="status" className={`mt-3 text-sm font-semibold ${flash.tone === 'ok' ? 'text-teal-ink' : 'text-red-700'}`}>{flash.text}</p> : null}

      {!loaded ? <p className="mt-5 text-sm text-muted">{err ? tc('loadFailed') : tc('loading')}</p>
        : counts[tab] === 0 ? <div className={`${CARD} mt-5 border-dashed px-6 py-12 text-center text-sm text-muted`}>{emptyText}</div>
        : <ul className="mt-5 space-y-3">{rows}</ul>}
      {tab === 'premium' || tab === 'contact' ? <p className="mt-3 text-xs text-muted">{tp(tab === 'premium' ? 'admin.lead' : 'messages.lead')}</p> : null}
    </>
  );
}

function ListingRow({ l, onDone }: { l: OwnerListing; onDone: (d: Decision) => void }) {
  const t = useTranslations('admin.listing');
  const tr = useTranslations('region');
  const L = useListingLabels();
  const lang = useLang();
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="ok">{L.kind[l.kind]}</Pill>
        <span className="font-semibold">{l.title}</span>
        <span className="ml-auto font-mono text-xs text-muted">{t('created')} {uzDateTime(l.createdAt, lang)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {l.owner.type === 'org' ? t('org') : LISTING_OWNER_LABELS[lang].person}: {l.owner.name} · {t('region')}: {tr.has(l.regionCode) ? tr(l.regionCode) : l.regionCode} · {t('price')}: <span className="font-mono">{l.priceTiyin != null ? `${som(l.priceTiyin, lang)}${l.priceUnit ? ` / ${L.priceUnit[l.priceUnit]}` : ''}` : t('onRequest')}</span> · <span className="font-mono">{l.photos.length}</span> {t('photos')}
        {l.year ? <> · <span className="font-mono">{l.year}</span></> : null}{l.condition ? ` · ${L.condition[l.condition]}` : ''}{l.model ? ` · ${l.model}` : ''}
      </p>
      {l.description ? <p className="mt-2 whitespace-pre-line text-sm">{l.description}</p> : null}
      {l.photos.length ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {l.photos.slice(0, 6).map((p) => <img key={p} src={p} alt="" className="h-20 w-28 shrink-0 rounded-xl border border-line object-cover" />)}
        </div>
      ) : null}
      {l.contactPhone ? <p className="mt-2 font-mono text-xs text-muted">{t('contact')}: {l.contactPhone}</p> : null}
      {l.status === 'ACTIVE' ? <Link href={listingHref(l)} className="mt-2 inline-block text-sm text-teal-ink underline">{l.slug}</Link> : null}
      <Decide path={`/admin/listings/${l.id}/decide`} reasonKey="reason" requireReason onDone={onDone} />
    </li>
  );
}

function OrgRow({ o, onDone }: { o: OrgRecord; onDone: (d: Decision) => void }) {
  const t = useTranslations('admin.org');
  const tr = useTranslations('region');
  const lang = useLang();
  const kinds = o.kinds?.length ? o.kinds : [o.kind];
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{o.name}</span>
        {kinds.map((k) => <Pill key={k} tone="ok">{ORG_KIND_LABELS[lang][k]}</Pill>)}
        {o.kycRequestedAt ? <span className="ml-auto font-mono text-xs text-muted">{t('requestedAt')} {uzDateTime(o.kycRequestedAt, lang)}</span> : null}
      </div>
      <p className="mt-1 font-mono text-sm">
        {t('stir')}: {o.stir ?? t('noStir')}{o.regionCode && tr.has(o.regionCode) ? <span className="text-muted"> · {t('region')}: {tr(o.regionCode)}</span> : null}
      </p>
      <p className="mt-1 text-sm text-muted">{[o.phone, o.telegram, o.website, o.address].filter(Boolean).join(' · ') || '·'}</p>
      {o.description ? <p className="mt-2 text-sm">{o.description}</p> : null}
      <Decide path={`/orgs/${o.id}/kyc/decide`} reasonKey="note" requireReason onDone={onDone} />
    </li>
  );
}

/** Terminal da'vosi: da'vogar tashkilot (claimOrgName), stansiya, ochiq sahifa; qaror POST /terminals/:id/claim/decide. */
function TerminalClaimRow({ x, onDone }: { x: AdminTerminal; onDone: (d: Decision) => void }) {
  const t = useTranslations('terminalsAdmin.admin');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="ok">{tk(x.kind)}</Pill>
        <span className="font-semibold">{x.name}</span>
        <span className="text-sm text-muted">{t('station')}: {stationName({ station: x.station, stationNameRaw: x.rail?.stationNameRaw ?? null })}{x.regionCode && tr.has(x.regionCode) ? ` · ${tr(x.regionCode)}` : ''}</span>
      </div>
      <p className="mt-1 text-sm"><span className="text-muted">{t('claimant')}:</span> <span className="font-semibold">{x.claimOrgName ?? x.claimOrgId ?? '·'}</span></p>
      <Link href={`/terminals/${x.slug}`} className="mt-1 inline-block text-sm text-teal-ink underline">{t('open')}</Link>
      <Decide path={`/terminals/${x.id}/claim/decide`} reasonKey="reason" requireReason={false} onDone={onDone} />
    </li>
  );
}

/** Premium to'lovi (qo'lda): e'lon, tashkilot, oylar, summa; tasdiq POST /admin/premium/:id/confirm -> PAID va premiumUntil uzayadi. */
function PremiumRow({ o, onDone }: { o: AdminPremiumOrder; onDone: (text: string) => void }) {
  const lang = useLang();
  const t = useTranslations('premium.admin');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function confirm() {
    setBusy(true); setErr(false);
    try { const r = await post<{ premiumUntil: string }>(`/admin/premium/${o.id}/confirm`, {}); onDone(t('confirmed', { until: uzDateTime(r.premiumUntil, lang) })); }
    catch { setErr(true); setBusy(false); }
  }
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{o.listing.title}</span>
        <Pill tone="warn">{t(`status.${o.status}`)}</Pill>
        <span className="ml-auto font-mono text-xs text-muted">{t('created')} {uzDateTime(o.createdAt, lang)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t('org')}: <span className="text-ink">{o.listing.orgName ?? '·'}</span> · <span className="font-mono">{t('months', { n: o.months })}</span> · <span className="font-mono font-semibold text-navy">{som(o.amountTiyin, lang)}</span> · {t('until')}: <span className="font-mono">{o.listing.premiumUntil ? uzDateTime(o.listing.premiumUntil, lang) : t('noPremium')}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{o.id}</p>
      <div className="mt-3">
        <button type="button" disabled={busy} onClick={confirm} className={BTN}>{busy ? t('confirming') : t('confirm')}</button>
        {err ? <p role="alert" className="mt-2 text-sm text-red-700">{t('failed')}</p> : null}
      </div>
    </li>
  );
}

/** Aloqa formasidan kelgan murojaat: faqat o'qish, javob telefon yoki email orqali. */
function ContactRow({ m }: { m: ContactPage['items'][number] }) {
  const lang = useLang();
  const t = useTranslations('premium.messages');
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="ok">{t.has(`topic.${m.topic}`) ? t(`topic.${m.topic}`) : m.topic}</Pill>
        <span className="font-semibold">{m.name}</span>
        <span className="font-mono text-sm">{m.contact}</span>
        <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(m.createdAt, lang)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
    </li>
  );
}
