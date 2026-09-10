'use client';
// Moderatsiya (platforma admini): navbatdagi e'lonlar, KYC so'rovlari, shahobcha va terminal da'volari. Har qator: tasdiqlash yoki sabab bilan rad etish.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LISTING_OWNER_LABELS, ORG_KIND_LABELS } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { num, som, uzDateTime } from '@/lib/format';
import { listingHref, type AdminTerminal, type Me, type MySiding, type OrgRecord, type OwnerListing } from '@/lib/types-kabinet';
import type { AdminPremiumOrder, ContactPage } from '@/lib/types-trust';
import { BTN_GHOST, CHIP, INPUT, Notice, useLang, useListingLabels } from '@/components/kabinet/bits';

type Tab = 'listings' | 'kyc' | 'claims' | 'terminalClaims' | 'premium' | 'contact';
const TABS: Tab[] = ['listings', 'kyc', 'claims', 'terminalClaims', 'premium', 'contact'];

export default function AdminPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('kabinet.common');
  const ta = useTranslations('terminalsAdmin');
  const tp = useTranslations('premium');
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('listings');
  const [listings, setListings] = useState<OwnerListing[] | null>(null);
  const [orgs, setOrgs] = useState<OrgRecord[] | null>(null);
  const [claims, setClaims] = useState<MySiding[] | null>(null);
  const [tclaims, setTclaims] = useState<AdminTerminal[] | null>(null);
  const [prem, setPrem] = useState<AdminPremiumOrder[] | null>(null);
  const [msgs, setMsgs] = useState<ContactPage | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => { api<Me>('/auth/me').then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    if (!me?.isPlatformAdmin) return;
    setErr(false);
    // Har navbat alohida: biri yiqilsa qolgan bo'limlar ko'rinaveradi, xato esa bir marta e'lon qilinadi
    const fail = () => setErr(true);
    void api<OwnerListing[]>('/admin/listings?status=PENDING_REVIEW').then(setListings).catch(fail);
    void api<OrgRecord[]>('/admin/orgs?kyc=PENDING').then(setOrgs).catch(fail);
    void api<{ items: MySiding[] }>('/admin/sidings?claim=PENDING').then((p) => setClaims(p.items)).catch(fail);
    void api<AdminTerminal[]>('/admin/terminals?claim=PENDING').then(setTclaims).catch(fail);
    void api<AdminPremiumOrder[]>('/admin/premium?status=PENDING').then(setPrem).catch(fail);
    void api<ContactPage>('/admin/contact').then(setMsgs).catch(fail);
  }, [me]);

  if (me === undefined) return <main className="mx-auto max-w-5xl px-6 py-10 text-muted">{tc('loading')}</main>;
  if (!me?.isPlatformAdmin) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">{t('forbidden')}</main>;

  const counts: Record<Tab, number | null> = { listings: listings?.length ?? null, kyc: orgs?.length ?? null, claims: claims?.length ?? null, terminalClaims: tclaims?.length ?? null, premium: prem?.length ?? null, contact: msgs?.total ?? null };
  const tabLabel = (k: Tab) => (k === 'terminalClaims' ? ta('adminTab') : k === 'premium' ? tp('admin.tab') : k === 'contact' ? tp('messages.tab') : t(`tabs.${k}`));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={CHIP(tab === k)}>
            {tabLabel(k)}{counts[k] ? <span className={`ml-1.5 font-mono text-xs ${tab === k ? 'text-white/70' : 'text-muted'}`}>{counts[k]}</span> : null}
          </button>
        ))}
      </div>

      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}

      <ul className="mt-6 space-y-3">
        {tab === 'listings' ? (listings ? listings.map((l) => <li key={l.id}><ListingRow l={l} /></li>) : <Loading err={err} />) : null}
        {tab === 'kyc' ? (orgs ? orgs.map((o) => <li key={o.id}><OrgRow o={o} /></li>) : <Loading err={err} />) : null}
        {tab === 'claims' ? (claims ? claims.map((s) => <li key={s.id}><ClaimRow s={s} /></li>) : <Loading err={err} />) : null}
        {tab === 'terminalClaims' ? (tclaims ? tclaims.map((x) => <li key={x.id}><TerminalClaimRow x={x} /></li>) : <Loading err={err} />) : null}
        {tab === 'premium' ? (prem ? prem.map((o) => <li key={o.id}><PremiumRow o={o} /></li>) : <Loading err={err} />) : null}
        {tab === 'contact' ? (msgs ? msgs.items.map((m) => <li key={m.id}><ContactRow m={m} /></li>) : <Loading err={err} />) : null}
      </ul>
      {tab === 'premium' || tab === 'contact' ? <p className="mt-3 text-xs text-muted">{tp(tab === 'premium' ? 'admin.lead' : 'messages.lead')}</p> : null}
      {counts[tab] === 0 ? <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{tab === 'premium' ? tp('admin.empty') : tab === 'contact' ? tp('messages.empty') : t('empty')}</p> : null}
    </main>
  );
}

function Loading({ err }: { err?: boolean }) { const tc = useTranslations('kabinet.common'); return <li className="text-sm text-muted">{err ? tc('loadFailed') : tc('loading')}</li>; }

/** Qaror bloki: tasdiqlash darhol, rad etish sabab bilan. `path` ga { approve, [reasonKey]: text } yuboriladi. */
function Decide({ path, reasonKey, reasonRequired }: { path: string; reasonKey: 'reason' | 'note'; reasonRequired: boolean }) {
  const t = useTranslations('admin');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send(approve: boolean) {
    setBusy(true); setErr(null);
    try { await post(path, { approve, [reasonKey]: reason.trim() || undefined }); setDone(approve ? 'approved' : 'rejected'); }
    catch { setErr(t('failed')); } finally { setBusy(false); }
  }

  if (done) return <p className={`mt-3 text-sm font-semibold ${done === 'approved' ? 'text-teal-ink' : 'text-red-700'}`}>{t(`decided.${done}`)}</p>;
  return (
    <div className="mt-3">
      {rejecting ? (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">{reasonRequired ? t('reason') : t('note')}
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || (reasonRequired && !reason.trim())} onClick={() => send(false)} className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{busy ? t('busy') : t('confirmReject')}</button>
            <button type="button" onClick={() => setRejecting(false)} className={BTN_GHOST}>{t('cancel')}</button>
          </div>
          {reasonRequired && !reason.trim() ? <p className="text-xs text-muted">{t('reasonRequired')}</p> : null}
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => send(true)} className="rounded-full bg-teal px-6 py-2 text-sm font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98] disabled:opacity-60">{busy ? t('busy') : t('approve')}</button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={BTN_GHOST}>{t('reject')}</button>
        </div>
      )}
      {err ? <p role="alert" className="mt-2 text-sm text-red-700">{err}</p> : null}
    </div>
  );
}

function ListingRow({ l }: { l: OwnerListing }) {
  const t = useTranslations('admin.listing');
  const tr = useTranslations('region');
  const L = useListingLabels();
  const lang = useLang();
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{L.kind[l.kind]}</span>
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
      <Decide path={`/admin/listings/${l.id}/decide`} reasonKey="reason" reasonRequired />
    </article>
  );
}

function OrgRow({ o }: { o: OrgRecord }) {
  const t = useTranslations('admin.org');
  const tr = useTranslations('region');
  const lang = useLang();
  const kinds = o.kinds?.length ? o.kinds : [o.kind];
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{o.name}</span>
        {kinds.map((k) => <span key={k} className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{ORG_KIND_LABELS[lang][k]}</span>)}
        {o.kycRequestedAt ? <span className="ml-auto font-mono text-xs text-muted">{t('requestedAt')} {uzDateTime(o.kycRequestedAt, lang)}</span> : null}
      </div>
      <p className="mt-1 font-mono text-sm">
        {t('stir')}: {o.stir ?? t('noStir')}{o.regionCode && tr.has(o.regionCode) ? <span className="text-muted"> · {t('region')}: {tr(o.regionCode)}</span> : null}
      </p>
      <p className="mt-1 text-sm text-muted">{[o.phone, o.telegram, o.website, o.address].filter(Boolean).join(' · ') || '·'}</p>
      {o.description ? <p className="mt-2 text-sm">{o.description}</p> : null}
      <Decide path={`/orgs/${o.id}/kyc/decide`} reasonKey="note" reasonRequired />
    </article>
  );
}

function ClaimRow({ s }: { s: MySiding }) {
  const lang = useLang();
  const t = useTranslations('admin.claim');
  const tr = useTranslations('region');
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{t('siding')} <span className="font-mono">No {s.registryNo}</span></span>
        <span className="text-sm text-muted">{t('station')}: {s.station?.nameUz ?? s.stationNameRaw}{s.regionCode && tr.has(s.regionCode) ? ` · ${tr(s.regionCode)}` : ''}</span>
        {s.claimedAt ? <span className="ml-auto font-mono text-xs text-muted">{t('claimedAt')} {uzDateTime(s.claimedAt, lang)}</span> : null}
      </div>
      <p className="mt-1 text-sm"><span className="text-muted">{t('claimant')}:</span> <span className="font-semibold">{s.ownerOrgName ?? s.ownerOrgId ?? '·'}</span></p>
      <p className="mt-0.5 text-sm text-muted">{t('registryOwner')}: {s.ownerNameRaw || '·'}{s.lengthM != null ? <> · <span className="font-mono">{num(s.lengthM, lang)} m</span></> : null}</p>
      <Link href={`/sidings/${s.id}`} className="mt-1 inline-block text-sm text-teal-ink underline">{t('open')}</Link>
      <Decide path={`/sidings/${s.id}/claim/decide`} reasonKey="reason" reasonRequired={false} />
    </article>
  );
}

/** Terminal da'vosi: da'vogar tashkilot (claimOrgName), stansiya, ochiq sahifa; qaror POST /terminals/:id/claim/decide. */
function TerminalClaimRow({ x }: { x: AdminTerminal }) {
  const t = useTranslations('terminalsAdmin.admin');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{tk(x.kind)}</span>
        <span className="font-semibold">{x.name}</span>
        <span className="text-sm text-muted">{t('station')}: {x.station.nameUz}{x.regionCode && tr.has(x.regionCode) ? ` · ${tr(x.regionCode)}` : ''}</span>
      </div>
      <p className="mt-1 text-sm"><span className="text-muted">{t('claimant')}:</span> <span className="font-semibold">{x.claimOrgName ?? x.claimOrgId ?? '·'}</span></p>
      <Link href={`/terminals/${x.slug}`} className="mt-1 inline-block text-sm text-teal-ink underline">{t('open')}</Link>
      <Decide path={`/terminals/${x.id}/claim/decide`} reasonKey="reason" reasonRequired={false} />
    </article>
  );
}

/** Premium to'lovi (qo'lda): e'lon, tashkilot, oylar, summa; tasdiq POST /admin/premium/:id/confirm -> PAID va premiumUntil uzayadi. */
function PremiumRow({ o }: { o: AdminPremiumOrder }) {
  const lang = useLang();
  const t = useTranslations('premium.admin');
  const [busy, setBusy] = useState(false);
  const [until, setUntil] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  async function confirm() {
    setBusy(true); setErr(false);
    try { const r = await post<{ premiumUntil: string }>(`/admin/premium/${o.id}/confirm`, {}); setUntil(r.premiumUntil); }
    catch { setErr(true); } finally { setBusy(false); }
  }
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{o.listing.title}</span>
        <span className="rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-semibold text-amber-ink">{t(`status.${o.status}`)}</span>
        <span className="ml-auto font-mono text-xs text-muted">{t('created')} {uzDateTime(o.createdAt, lang)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t('org')}: <span className="text-ink">{o.listing.orgName ?? '·'}</span> · <span className="font-mono">{t('months', { n: o.months })}</span> · <span className="font-mono font-semibold text-navy">{som(o.amountTiyin, lang)}</span> · {t('until')}: <span className="font-mono">{o.listing.premiumUntil ? uzDateTime(o.listing.premiumUntil, lang) : t('noPremium')}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{o.id}</p>
      {until ? <p className="mt-3 text-sm font-semibold text-teal-ink">{t('confirmed', { until: uzDateTime(until, lang) })}</p> : (
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={confirm} className="rounded-full bg-teal px-6 py-2 text-sm font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98] disabled:opacity-60">{busy ? t('confirming') : t('confirm')}</button>
          {err ? <p role="alert" className="mt-2 text-sm text-red-700">{t('failed')}</p> : null}
        </div>
      )}
    </article>
  );
}

/** Aloqa formasidan kelgan murojaat: faqat o'qish, javob telefon yoki email orqali. */
function ContactRow({ m }: { m: ContactPage['items'][number] }) {
  const lang = useLang();
  const t = useTranslations('premium.messages');
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{t.has(`topic.${m.topic}`) ? t(`topic.${m.topic}`) : m.topic}</span>
        <span className="font-semibold">{m.name}</span>
        <span className="font-mono text-sm">{m.contact}</span>
        <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(m.createdAt, lang)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
    </article>
  );
}
