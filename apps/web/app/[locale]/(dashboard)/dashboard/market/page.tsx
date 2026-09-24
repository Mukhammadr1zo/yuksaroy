'use client';
// Kabinet: mening so'rovlarim (takliflar, tanlash, yopish), mening takliflarim, xizmat profilim (yaratish, tahrirlash, yashirish).
// Tab ?tab= dan o'qiladi (window orqali: useSearchParams statik sahifada Suspense talab qiladi), ?id= so'rovni ajratadi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { regionRouteKm, type KycStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { km, som, somPerKm, uzDateTime, uzToday } from '@/lib/format';
import type { MarketOffer, MarketRequest, Paged, ServiceProfileCard } from '@/lib/types-market';
import { Pager } from '@/components/admin/kit';
import { BTN_GHOST, BTN_NAVY, BTN_PRIMARY, CHIP, INPUT, Notice } from '@/components/kabinet/bits';
import { KycBadge, PhoneBadge } from '@/components/catalog/KycBadge';
import { CopyLink } from '@/components/market/CopyLink';
import { DemoBadge, MarketPhone, MarketStatusPill, OfferStatusPill, useMarketLabels } from '@/components/market/bits';
import { ProfileForm } from '@/components/market/ProfileForm';
import { requestHref } from '@/components/market/RequestCard';

type Tab = 'requests' | 'offers' | 'profile';
const TABS: Tab[] = ['requests', 'offers', 'profile'];
type MyOffer = MarketOffer & { request: MarketRequest };
// Sahifa hajmi: ro'yxat serverda sahifalanadi, 100 dan eski ochiq so'rov ham kabinetdan boshqariladi
const PAGE = 20;

export default function MarketDashboardPage() {
  const t = useTranslations('market.dash');
  const tc = useTranslations('kabinet.common');
  const [tab, setTab] = useState<Tab>('requests');
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get('tab');
    if (TABS.includes(v as Tab)) setTab(v as Tab);
    setFocusId(sp.get('id'));
  }, []);
  const pick = (v: Tab) => {
    setTab(v);
    // Manzil yangilanadi, sahifa qayta yuklanmaydi: orqaga tugmasi ham ishlaydi
    window.history.replaceState(null, '', `?tab=${v}`);
  };

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t('lead')}</p>
      <div role="tablist" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((v) => <button key={v} role="tab" aria-selected={tab === v} type="button" onClick={() => pick(v)} className={CHIP(tab === v)}>{t(`tab${v[0]!.toUpperCase()}${v.slice(1)}`)}</button>)}
      </div>
      <div className="mt-6">
        {tab === 'requests' ? <Requests focusId={focusId} t={t} tc={tc} /> : tab === 'offers' ? <Offers t={t} tc={tc} /> : <Profiles t={t} tc={tc} />}
      </div>
    </>
  );
}

type T = ReturnType<typeof useTranslations>;

function Requests({ focusId, t, tc }: { focusId: string | null; t: T; tc: T }) {
  const locale = useLocale();
  // Bajarilgan ish soni xizmat kartasidagi bilan bir xil matn: nomfaza ham bitta
  const tg = useTranslations('services.grid');
  const L = useMarketLabels();
  const [items, setItems] = useState<MarketRequest[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(focusId);
  const [copied, setCopied] = useState<string | null>(null);
  // Qayta e'lon qilish uchun yozilayotgan sana: so'rov id si bo'yicha, bir vaqtda bittasi ochiq
  const [relistDate, setRelistDate] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api<Paged<MarketRequest>>(`/market/requests/mine?page=${page}&limit=${PAGE}`).then((r) => { setItems(r.items); setTotal(r.total); }).catch(() => { setErr(tc('loadFailed')); setItems([]); });
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setOpen(focusId); if (focusId) document.getElementById(`mr-${focusId}`)?.scrollIntoView({ block: 'center' }); }, [focusId, items?.length]);

  async function act(id: string, what: 'award' | 'close' | 'cancel' | 'done', offerId?: string) {
    if (what === 'close' && !window.confirm(t('confirmClose'))) return;
    if (what === 'cancel' && !window.confirm(t('confirmCancel'))) return;
    // Bajarildi yakuniy: ortga qaytarib bo'lmaydi va ijrochining hisobiga yoziladi
    if (what === 'done' && !window.confirm(t('confirmDone'))) return;
    // Tanlash qaytarib bo'lmaydigan qadam: qolgan takliflar yopiladi va raqamlar ochiladi
    if (what === 'award' && !window.confirm(t('confirmAward'))) return;
    setBusy(offerId ?? `${id}:${what}`); setErr(null);
    try {
      const r = await post<MarketRequest>(`/market/requests/${id}/${what}`, offerId ? { offerId } : {});
      setItems((xs) => (xs ?? []).map((x) => (x.id === id ? r : x)));
    } catch { setErr(tc('failed')); } finally { setBusy(null); }
  }
  /** Sanasi o'tgan yukni yangi sana bilan doskaga qaytarish: raqam va takliflar o'sha joyida qoladi. */
  async function relist(id: string) {
    const loadDate = relistDate[id];
    if (!loadDate) return;
    setBusy(`${id}:relist`); setErr(null);
    try {
      const r = await post<MarketRequest>(`/market/requests/${id}/relist`, { loadDate });
      setItems((xs) => (xs ?? []).map((x) => (x.id === id ? r : x)));
      setRelistDate((d) => ({ ...d, [id]: '' }));
    } catch { setErr(t('err.RELIST_NOT_ALLOWED')); } finally { setBusy(null); }
  }
  async function copy(id: string, url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(id); window.setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href="/cargo/new" className={BTN_PRIMARY}>{t('newCargo')}</Link>
        <Link href="/services/request" className={BTN_GHOST}>{t('newService')}</Link>
      </div>
      {err ? <div className="mt-4"><Notice tone="err">{err}</Notice></div> : null}
      {items === null ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {items && items.length === 0 ? <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t('emptyRequests')}</p> : null}
      <ul className="mt-6 space-y-3">
        {items?.map((r) => {
          const offers = r.offers ?? [];
          // Yo'l uzunligi: takliflar narxini km ga bo'lib solishtirish uchun
          const routeKm = r.board === 'CARGO' ? regionRouteKm(r.fromRegion, r.toRegion) : null;
          const isOpen = open === r.id;
          return (
            <li key={r.id} id={`mr-${r.id}`} className={`min-w-0 rounded-card border bg-white p-4 ${focusId === r.id ? 'border-teal' : 'border-line'}`}>
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-left">
                <span className="font-mono text-sm font-semibold text-navy">{r.no}</span>
                <MarketStatusPill status={r.status} />
                {r.isDemo ? <DemoBadge /> : null}
                <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
                <span className={`font-mono text-xs tabular-nums ${offers.length ? 'text-teal-ink' : 'text-muted'}`}>{t('offersCount', { count: offers.length })}</span>
              </button>
              <p className="mt-1 text-xs text-muted">
                {r.board === 'CARGO' ? `${L.region(r.fromRegion)} -> ${L.region(r.toRegion)}${routeKm != null ? ` · ${km(routeKm, locale)}` : ''} · ${r.cargoName ?? ''}${r.weightT ? `, ${r.weightT} t` : ''}` : `${r.serviceType ? L.service[r.serviceType] : ''} · ${L.region(r.regionCode)}`}
                {' · '}{uzDateTime(r.createdAt, locale)}
              </p>
              {isOpen ? (
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link href={requestHref(r)} className={BTN_GHOST}>{t('open')}</Link>
                    {/* Asosiy amal birinchi va to'q rangda: tanlangan so'rovning normal yakuni shu */}
                    {r.status === 'AWARDED' ? <button type="button" onClick={() => act(r.id, 'done')} disabled={busy !== null} className={BTN_NAVY}>{busy === `${r.id}:done` ? t('markingDone') : t('markDone')}</button> : null}
                    {r.status === 'OPEN' || r.status === 'AWARDED' ? <button type="button" onClick={() => act(r.id, 'close')} disabled={busy !== null} className={BTN_GHOST}>{busy === `${r.id}:close` ? t('closing') : t('close')}</button> : null}
                    {r.status === 'OPEN' ? <button type="button" onClick={() => act(r.id, 'cancel')} disabled={busy !== null} className={BTN_GHOST}>{busy === `${r.id}:cancel` ? t('cancelling') : t('cancel')}</button> : null}
                  </div>
                  {/* Sanasi o'tgan yuk doskadan tushadi, lekin bu yerda qoladi: yangi sana bilan qaytariladi */}
                  {r.status === 'OPEN' && r.board === 'CARGO' && r.loadDate && r.loadDate.slice(0, 10) < uzToday() ? (
                    <div className="mt-3">
                      <Notice tone="warn">{t('relistHint')}</Notice>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input type="date" min={uzToday()} value={relistDate[r.id] ?? ''} aria-label={t('relistDate')}
                          onChange={(e) => setRelistDate((d) => ({ ...d, [r.id]: e.target.value }))}
                          className={`${INPUT} font-mono sm:w-auto sm:flex-1`} />
                        <button type="button" onClick={() => relist(r.id)} disabled={busy !== null || !relistDate[r.id]} className={BTN_NAVY}>
                          {busy === `${r.id}:relist` ? t('relisting') : t('relist')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {r.status === 'AWARDED' ? <div className="mt-3"><Notice tone="ok">{t('awardedNote')}</Notice></div> : null}
                  {r.status === 'DONE' ? <div className="mt-3"><Notice tone="ok">{t('doneNote')}</Notice></div> : null}
                  {r.statusUrl ? (
                    <CopyLink url={r.statusUrl} className="mt-3" />
                  ) : null}
                  {offers.length === 0 ? <p className="mt-3 rounded-card border border-dashed border-line p-4 text-sm text-muted">{t('noOffers')}</p> : null}
                  <ul className="mt-3 space-y-2">
                    {offers.map((o) => (
                      <li key={o.id} className={`rounded-card border p-3 ${o.status === 'AWARDED' ? 'border-teal' : 'border-line'}`}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold wrap-anywhere">{o.providerName ?? '-'}</span>
                          {/* Kim ekani ko'rinsin: tashkilot bo'lsa tasdig'i, yakka odam bo'lsa raqami */}
                          {o.providerOrg ? <KycBadge kyc={o.providerOrg.kyc as KycStatus} />
                            : o.providerPhoneVerified != null ? <PhoneBadge verified={o.providerPhoneVerified} /> : null}
                          {/* Faqat noldan katta bo'lsa: "0 ta bajarilgan ish" qaror bermaydi, shovqin qiladi */}
                          {o.providerDoneCount ? <span className="rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-teal-ink">{tg('done', { count: o.providerDoneCount })}</span> : null}
                          <OfferStatusPill status={o.status} />
                          <span className="ml-auto font-mono text-xs text-muted tabular-nums">{uzDateTime(o.createdAt, locale)}</span>
                        </div>
                        <p className="mt-1 font-mono text-sm text-navy tabular-nums">
                          {o.priceTiyin != null ? som(o.priceTiyin, locale) : tc('onRequest')}
                          {o.priceTiyin != null && routeKm != null ? ` · ${somPerKm(o.priceTiyin, routeKm, locale)}` : ''}
                        </p>
                        {o.message ? <p className="mt-1 whitespace-pre-line text-sm text-ink/85 wrap-anywhere">{o.message}</p> : null}
                        {r.status === 'OPEN' && o.status === 'SENT' ? <button type="button" onClick={() => act(r.id, 'award', o.id)} disabled={busy !== null} className={`${BTN_NAVY} mt-2`}>{busy === o.id ? t('awarding') : t('award')}</button> : null}
                        {/* Tanlangandan keyin halqa yopiladi: g'olibning raqami shu yerda ochiladi.
                            Ish bajarilgan deb belgilangach ham qoladi: hisob-kitob keyinroq bo'ladi */}
                        {(r.status === 'AWARDED' || r.status === 'DONE') && o.status === 'AWARDED' && !r.isDemo ? (
                          <div className="mt-2">
                            <p className="text-xs text-muted">{t('winnerPhone')}</p>
                            <MarketPhone kind="offer" targetId={o.id} next="/dashboard/market?tab=requests" />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Pager page={page} pages={Math.ceil(total / PAGE)} onPage={setPage} />
    </>
  );
}

function Offers({ t, tc }: { t: T; tc: T }) {
  const locale = useLocale();
  const L = useMarketLabels();
  const [items, setItems] = useState<MyOffer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    api<Paged<MyOffer>>(`/market/offers/mine?page=${page}&limit=${PAGE}`).then((r) => { setItems(r.items); setTotal(r.total); }).catch(() => { setErr(tc('loadFailed')); setItems([]); });
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {err ? <Notice tone="err">{err}</Notice> : null}
      {items === null ? <p className="text-sm text-muted">{tc('loading')}</p> : null}
      {items && items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">
          <p>{t('emptyOffers')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2"><Link href="/cargo" className={BTN_GHOST}>{t('toCargo')}</Link><Link href="/services" className={BTN_GHOST}>{t('toServices')}</Link></div>
        </div>
      ) : null}
      <ul className="space-y-3">
        {items?.map((o) => {
          // Yo'l uzunligi: o'z narximni km bo'yicha ko'rish uchun
          const routeKm = o.request.board === 'CARGO' ? regionRouteKm(o.request.fromRegion, o.request.toRegion) : null;
          return (
          <li key={o.id} className="min-w-0 rounded-card border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-semibold text-navy">{o.request.no}</span>
              <OfferStatusPill status={o.status} />
              <MarketStatusPill status={o.request.status} />
              <span className="ml-auto font-mono text-xs text-muted tabular-nums">{uzDateTime(o.createdAt, locale)}</span>
            </div>
            <p className="mt-2 font-semibold wrap-anywhere">{o.request.title}</p>
            <p className="text-xs text-muted">{o.request.board === 'CARGO' ? `${L.region(o.request.fromRegion)} -> ${L.region(o.request.toRegion)}${routeKm != null ? ` · ${km(routeKm, locale)}` : ''}` : `${o.request.serviceType ? L.service[o.request.serviceType] : ''} · ${L.region(o.request.regionCode)}`}</p>
            <p className="mt-2 text-sm">
              <span className="text-muted">{t('myPrice')}: </span>
              <span className="font-mono text-navy tabular-nums">
                {o.priceTiyin != null ? som(o.priceTiyin, locale) : tc('onRequest')}
                {o.priceTiyin != null && routeKm != null ? ` · ${somPerKm(o.priceTiyin, routeKm, locale)}` : ''}
              </span>
            </p>
            {o.message ? <p className="mt-1 whitespace-pre-line text-sm text-ink/85 wrap-anywhere">{o.message}</p> : null}
            <Link href={requestHref(o.request)} className="mt-3 inline-block text-sm font-semibold text-teal-ink hover:text-navy">{t('open')}</Link>
          </li>
          );
        })}
      </ul>
      <Pager page={page} pages={Math.ceil(total / PAGE)} onPage={setPage} />
    </>
  );
}

function Profiles({ t, tc }: { t: T; tc: T }) {
  const tp = useTranslations('market.dash.profile');
  const tg = useTranslations('services.grid');
  const L = useMarketLabels();
  const [items, setItems] = useState<ServiceProfileCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceProfileCard | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api<{ items: ServiceProfileCard[] }>('/services/profiles/mine').then((r) => setItems(r.items)).catch(() => { setErr(tc('loadFailed')); setItems([]); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(p: ServiceProfileCard) {
    setBusy(p.id); setErr(null);
    try {
      const r = p.status === 'ACTIVE'
        ? await post<ServiceProfileCard>(`/services/profiles/${p.id}/hide`, {})
        : await api<ServiceProfileCard>(`/services/profiles/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
      setItems((xs) => (xs ?? []).map((x) => (x.id === p.id ? r : x)));
    } catch { setErr(tc('failed')); } finally { setBusy(null); }
  }
  const onSaved = (p: ServiceProfileCard) => {
    setItems((xs) => { const list = xs ?? []; return list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]; });
    setEditing(null); setSaved(true); window.setTimeout(() => setSaved(false), 2500);
  };
  const taken = (items ?? []).map((p) => p.serviceType);
  const canAdd = taken.length < 3;

  return (
    <>
      <p className="max-w-2xl text-sm text-muted">{tp('lead')}</p>
      {err ? <div className="mt-4"><Notice tone="err">{err}</Notice></div> : null}
      {saved ? <div className="mt-4"><Notice tone="ok">{tp('saved')}</Notice></div> : null}
      {items === null ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {editing ? (
        <div className="mt-6"><ProfileForm initial={editing === 'new' ? null : editing} taken={taken} onSaved={onSaved} onCancel={() => setEditing(null)} /></div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {items?.map((p) => (
              <li key={p.id} className={`min-w-0 rounded-card border bg-white p-4 ${p.status === 'ACTIVE' ? 'border-line' : 'border-dashed border-line opacity-80'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{L.service[p.serviceType]}</span>
                  <span className={`text-xs font-semibold ${p.status === 'ACTIVE' ? 'text-teal-ink' : 'text-muted'}`}>{p.status === 'ACTIVE' ? tp('active') : p.status === 'BLOCKED' ? tp('blocked') : tp('hidden')}</span>
                  {p.isDemo ? <DemoBadge /> : null}
                </div>
                <p className="mt-2 font-semibold wrap-anywhere">{p.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted wrap-anywhere">{p.description}</p>
                <p className="mt-1 text-xs text-muted wrap-anywhere">{p.regions.length ? p.regions.map((r) => L.region(r)).join(', ') : tg('regionsAll')}{p.priceNote ? ` · ${p.priceNote}` : ''}</p>
                {/* Admin yashirgan (BLOCKED) profilni egasi tahrirlay ham, ocha ham olmaydi: server rad etadi, tugma ham yo'q */}
                {p.status !== 'BLOCKED' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditing(p)} className={BTN_GHOST}>{tp('edit')}</button>
                    <button type="button" onClick={() => toggle(p)} disabled={busy !== null} className={BTN_GHOST}>
                      {busy === p.id ? (p.status === 'ACTIVE' ? tp('hiding') : tp('showing')) : p.status === 'ACTIVE' ? tp('hide') : tp('show')}
                    </button>
                    {p.status === 'ACTIVE' ? <Link href={`/services/${p.id}`} className={BTN_GHOST}>{t('open')}</Link> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {items && items.length === 0 ? <p className="mt-6 text-sm text-muted">{tp('none')}</p> : null}
          {items && canAdd ? <button type="button" onClick={() => setEditing('new')} className={`${BTN_PRIMARY} mt-4`}>{items.length ? tp('another') : tp('create')}</button> : null}
        </>
      )}
    </>
  );
}
