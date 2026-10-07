'use client';
/**
 * Moderatsiya navbatlari: e'lonlar, KYC, obyekt da'volari, Premium to'lovlar, obunalar, murojaatlar.
 * Shahobcha ham terminal, shuning uchun da'vo navbati bitta: ilgari ikkita bo'lim bir xil
 * qatorlarni ko'rsatib, qarorni ikki xil endpointga yuborardi.
 * Faol bo'lim URL da (?tab=), shunda bosh sahifadagi "kutilmoqda" havolalari to'g'ri bo'limga olib keladi.
 * ?mine=1 faqat menga biriktirilgan qatorlar (vazifalar xaritasi bitta so'rov: GET /admin/tasks?open=1),
 * #<id> esa vazifa havolasidan kelgan qatorni o'rtaga keltirib 2 s belgilaydi (obyekt sahifasi yo'q navbatlar).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { KYC_STATUS_LABELS, LISTING_OWNER_LABELS, ORG_KIND_LABELS, REPORT_REASON_LABELS, REPORT_STATUSES, REPORT_STATUS_LABELS, REPORT_TARGET_LABELS } from '@yuksaroy/domain';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som, stationName, uzDateTime } from '@/lib/format';
import { listingHref, type AdminTerminal, type OrgRecord, type OwnerListing } from '@/lib/types-kabinet';
import type { AdminPremiumOrder, AdminSubscription, ContactPage, ReportPage } from '@/lib/types-trust';
import { useLang, useListingLabels } from '@/components/kabinet/bits';
import { BTN, BTN_DANGER, BTN_GHOST, CARD, ConfirmButton, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList, type Paged } from '@/components/admin/kit';
import { Decide, type Decision } from '@/components/admin/Decide';
import { AssignTask, type Task, type TaskEntity } from '@/components/admin/AssignTask';
import { useAdminMe } from '@/components/admin/context';
import { MessageFiles } from '@/components/chat/Attachments';

type Tab = 'listings' | 'kyc' | 'claims' | 'premium' | 'subscription' | 'contact' | 'reports';
const TABS: Tab[] = ['listings', 'kyc', 'claims', 'premium', 'subscription', 'contact', 'reports'];
const isTab = (v: string | null): v is Tab => TABS.includes(v as Tab);
/** Yorliq -> vazifa obyekti turi (serverdagi TASK_ENTITIES; Order va UrgentRequest o'z varaqlarida). */
const ENTITY: Record<Tab, TaskEntity> = { listings: 'Listing', kyc: 'Organization', claims: 'Terminal', premium: 'PremiumOrder', subscription: 'Subscription', contact: 'ContactMessage', reports: 'Report' };
/** Shu sahifada chiziladigan turlar: xaritada Order va UrgentRequest ham bor, ular chip soniga kirmasin (son ko'ringan qatorlarga teng bo'lsin). */
const MOD = new Set<TaskEntity>(Object.values(ENTITY));

type Flash = { text: string; tone: 'ok' | 'bad' } | null;
/** Qator komponentlariga uzatiladigan vazifa holati: task yo'q = biriktirilmagan. */
type TaskProps = { task?: Task | null; onTaskChanged?: () => void };
/** Yorliq qatorlari: joriy vazifani beradi, mine rejimida faqat menikini qoldiradi. */
type TaskCtx = { taskOf: (entity: TaskEntity, id: string) => Task | null; mine: boolean; meId: string; reloadTasks: () => void };

/**
 * #<id> hash: qatorlar chizilgach o'sha qator o'rtaga keladi va 2 s belgilanadi. Vazifa havolasi
 * shu bilan keladi (Premium, murojaat, shikoyatda alohida obyekt sahifasi yo'q). ready = ro'yxat chizildi.
 */
function useHashRing(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const el = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('ring-2', 'ring-teal');
    const tm = setTimeout(() => el.classList.remove('ring-2', 'ring-teal'), 2000);
    return () => clearTimeout(tm);
  }, [ready]);
}

// Suspense shart emas: AdminShell bolalarni bitta Suspense ichida chizadi (useSearchParams talabi bir joyda)
export default function ModerationPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tp = useTranslations('premium');
  const tsb = useTranslations('subscription');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const q = sp.get('tab');
  const tab: Tab = isTab(q) ? q : 'listings';
  const mine = sp.get('mine') === '1';
  const { me } = useAdminMe();

  const [listings, setListings] = useState<OwnerListing[] | null>(null);
  const [orgs, setOrgs] = useState<OrgRecord[] | null>(null);
  const [claims, setClaims] = useState<AdminTerminal[] | null>(null);
  const [prem, setPrem] = useState<AdminPremiumOrder[] | null>(null);
  const [subs, setSubs] = useState<AdminSubscription[] | null>(null);
  const [msgs, setMsgs] = useState<ContactPage | null>(null);
  const [reports, setReports] = useState<ReportPage | null>(null);
  const [err, setErr] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  // Ochiq vazifalar xaritasi entity:id bo'yicha; 500 ta yetadi (navbatlar shuncha bo'lmaydi), oshsa keyingi o'qishda
  const [tasks, setTasks] = useState<Map<string, Task>>(() => new Map());

  // Yorliqdagi son javobsizlarniki. Alohida funksiya: ContactTab amaldan keyin uni
  // qayta chaqiradi, aks holda yorliq filtrlangan sonni ko'rsatib qolardi.
  const loadContactCount = useCallback(() => {
    void api<ContactPage>('/admin/contact/all?limit=1&handled=0').then(setMsgs).catch(() => setErr(true));
  }, []);
  // Yorliqdagi son faqat yangilarniki: ReportsTab amaldan keyin uni qayta chaqiradi
  const loadReportCount = useCallback(() => {
    void api<ReportPage>('/admin/reports?limit=1&status=NEW').then(setReports).catch(() => setErr(true));
  }, []);
  // Vazifalar ikkilamchi: yiqilsa navbatlar baribir ko'rinadi, shuning uchun xato e'lon qilinmaydi.
  // Har biriktirish, yopish va qarordan keyin qayta o'qiladi (qaror berilgan ishni server o'zi yopadi).
  const reloadTasks = useCallback(() => {
    void api<{ items: Task[] }>('/admin/tasks?open=1&limit=500')
      .then((r) => setTasks(new Map(r.items.map((x) => [`${x.entity}:${x.entityId}`, x])))).catch(() => {});
  }, []);
  const taskOf = useCallback((entity: TaskEntity, id: string) => tasks.get(`${entity}:${id}`) ?? null, [tasks]);
  const isMine = (entity: TaskEntity, id: string) => taskOf(entity, id)?.assignee?.id === me.id;
  const mineCount = [...tasks.values()].filter((x) => MOD.has(x.entity) && x.assignee?.id === me.id).length;
  const ctx: TaskCtx = { taskOf, mine, meId: me.id, reloadTasks };
  const goTab = (k: Tab, m: boolean) => router.replace(`${pathname}?tab=${k}${m ? '&mine=1' : ''}`, { scroll: false });

  useEffect(() => {
    // Har navbat alohida: biri yiqilsa qolgan bo'limlar ko'rinaveradi, xato esa bir marta e'lon qilinadi
    const fail = () => setErr(true);
    void api<Paged<OwnerListing>>('/admin/listings?status=PENDING_REVIEW&limit=100').then((r) => setListings(r.items)).catch(fail);
    void api<OrgRecord[]>('/admin/orgs?kyc=PENDING').then(setOrgs).catch(fail);
    // /admin/terminals hamma turni qamraydi (shahobcha ham shu yerda), /admin/sidings uning bir qismi edi
    void api<AdminTerminal[]>('/admin/terminals?claim=PENDING').then(setClaims).catch(fail);
    void api<AdminPremiumOrder[]>('/admin/premium?status=PENDING').then(setPrem).catch(fail);
    void api<AdminSubscription[]>('/admin/subscriptions?status=PENDING').then(setSubs).catch(fail);
    // Faqat yorliqdagi son uchun: to'liq ro'yxat, qidiruv va sahifalash ContactTab da.
    loadContactCount();
    loadReportCount();
    reloadTasks();
  }, [loadContactCount, loadReportCount, reloadTasks]);

  // mine rejimida massivli yorliqlar mijozda filtrlanadi (hammasi yuklangan); murojaat va shikoyat
  // sahifalangan, ularning soni xaritadan (menga biriktirilgan ochiq vazifalar), qatorlari joriy sahifada
  const only = <T extends { id: string }>(k: Tab, xs: T[] | null) => (mine ? xs?.filter((x) => isMine(ENTITY[k], x.id)) ?? null : xs);
  const vl = only('listings', listings), vo = only('kyc', orgs), vc = only('claims', claims), vp = only('premium', prem), vs = only('subscription', subs);
  const mineOf = (k: Tab) => [...tasks.values()].filter((x) => x.entity === ENTITY[k] && x.assignee?.id === me.id).length;
  const counts: Record<Tab, number | null> = {
    listings: vl?.length ?? null, kyc: vo?.length ?? null, claims: vc?.length ?? null, premium: vp?.length ?? null, subscription: vs?.length ?? null,
    contact: mine ? mineOf('contact') : msgs?.total ?? null, reports: mine ? mineOf('reports') : reports?.total ?? null,
  };
  const tabLabel = (k: Tab) => (k === 'premium' ? tp('admin.tab') : k === 'subscription' ? tsb('admin.tab') : k === 'contact' ? tp('messages.tab') : t(`tabs.${k}`));
  const emptyText = mine ? t('tasks.mineEmpty') : tab === 'premium' ? tp('admin.empty') : tab === 'subscription' ? tsb('admin.empty') : tab === 'contact' ? tp('messages.empty') : t('empty');

  // Qaror berilgan qator ro'yxatdan chiqadi, natija esa ro'yxat tepasida bir qator bo'lib qoladi;
  // vazifasi serverda yopiladi, xarita qayta o'qiladi (chip soni to'g'ri qolsin)
  const decided = (d: Decision) => { setFlash({ text: t(`decided.${d}`), tone: d === 'approved' ? 'ok' : 'bad' }); reloadTasks(); };
  const drop = <T extends { id: string }>(set: (f: (xs: T[] | null) => T[] | null) => void, id: string) => set((xs) => xs?.filter((x) => x.id !== id) ?? null);
  const tp2 = (k: Tab, id: string): TaskProps => ({ task: taskOf(ENTITY[k], id), onTaskChanged: reloadTasks });

  const loaded = counts[tab] !== null;
  const rows = tab === 'listings' ? vl?.map((l) => <ListingRow key={l.id} l={l} {...tp2('listings', l.id)} onDone={(d) => { drop(setListings, l.id); decided(d); }} />)
    : tab === 'kyc' ? vo?.map((o) => <OrgRow key={o.id} o={o} {...tp2('kyc', o.id)} onDone={(d) => { drop(setOrgs, o.id); decided(d); }} />)
    : tab === 'claims' ? vc?.map((x) => <TerminalClaimRow key={x.id} x={x} {...tp2('claims', x.id)} onDone={(d) => { drop(setClaims, x.id); decided(d); }} />)
    : tab === 'premium' ? vp?.map((o) => <PremiumRow key={o.id} o={o} {...tp2('premium', o.id)} onDone={(text) => { drop(setPrem, o.id); setFlash({ text, tone: 'ok' }); reloadTasks(); }} />)
    : tab === 'subscription' ? vs?.map((s) => <SubscriptionRow key={s.id} s={s} {...tp2('subscription', s.id)} onDone={(text) => { drop(setSubs, s.id); setFlash({ text, tone: 'ok' }); reloadTasks(); }} />)
    : null; // murojaatlar alohida komponentda: o'z qidiruvi va sahifalashi bor
  useHashRing(tab !== 'contact' && tab !== 'reports' && loaded);

  return (
    <>
      <PageHead title={t('nav.moderation')} lead={t('moderation.lead')} />

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k}
            onClick={() => { setFlash(null); goTab(k, mine); }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${tab === k ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`}>
            {tabLabel(k)}{counts[k] ? <span className={`ml-1.5 font-mono text-xs tabular-nums ${tab === k ? 'text-white/70' : 'text-muted'}`}>{counts[k]}</span> : null}
          </button>
        ))}
        {/* Menga biriktirilgan: yorliq emas, filtr; yorliqlar orasida yurganda saqlanadi (goTab) */}
        <button type="button" aria-pressed={mine} onClick={() => { setFlash(null); goTab(tab, !mine); }}
          className={`ml-auto rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${mine ? 'bg-teal text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`}>
          {t('tasks.mineCount', { n: mineCount })}
        </button>
      </div>

      {err ? <Notice tone="err">{tc('loadFailed')}</Notice> : null}
      {flash ? <p role="status" className={`mt-3 text-sm font-semibold ${flash.tone === 'ok' ? 'text-teal-ink' : 'text-red-700'}`}>{flash.text}</p> : null}

      {tab === 'contact' ? <ContactTab onChanged={loadContactCount} ctx={ctx} />
        : tab === 'reports' ? <ReportsTab onChanged={loadReportCount} ctx={ctx} />
        : !loaded ? <p className="mt-5 text-sm text-muted">{err ? tc('loadFailed') : tc('loading')}</p>
        : counts[tab] === 0 ? <div className={`${CARD} mt-5 border-dashed px-6 py-12 text-center text-sm text-muted`}>{emptyText}</div>
        : <ul className="mt-5 space-y-3">{rows}</ul>}
      {mine ? <p className="mt-3 text-xs text-muted">{t('tasks.decision.mine')}</p> : null}
      {tab === 'premium' || tab === 'contact' ? <p className="mt-3 text-xs text-muted">{tp(tab === 'premium' ? 'admin.lead' : 'messages.lead')}</p> : null}
      {tab === 'subscription' ? <p className="mt-3 text-xs text-muted">{tsb('admin.lead')}</p> : null}
      {tab === 'reports' ? <p className="mt-3 text-xs text-muted">{t('reports.lead')}</p> : null}
    </>
  );
}

/** Qator sarlavhasidagi biriktirish: vazifa holati yoki tugma; forma ota flex-wrap ning keyingi qatoriga tushadi. */
function RowTask({ entity, id, task, onTaskChanged }: { entity: TaskEntity; id: string } & TaskProps) {
  return <AssignTask entity={entity} entityId={id} task={task ?? null} onChanged={() => onTaskChanged?.()} />;
}

function ListingRow({ l, onDone, ...tk }: { l: OwnerListing; onDone: (d: Decision) => void } & TaskProps) {
  const t = useTranslations('admin.listing');
  const tr = useTranslations('region');
  const L = useListingLabels();
  const lang = useLang();
  return (
    <li id={l.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="ok">{L.kind[l.kind]}</Pill>
        {/* Sarlavha obyekt sahifasiga: shikoyat, yozishma va pul tarixi qaror oldidan o'sha yerda ko'riladi */}
        <Link href={`/admin/listings/${l.id}`} className="min-w-0 break-words font-semibold text-navy hover:underline">{l.title}</Link>
        <RowTask entity="Listing" id={l.id} {...tk} />
        <span className="ml-auto font-mono text-xs text-muted">{t('created')} {uzDateTime(l.createdAt, lang)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {l.owner.type === 'org' ? t('org') : LISTING_OWNER_LABELS[lang].person}: {l.owner.name} · {t('region')}: {tr.has(l.regionCode) ? tr(l.regionCode) : l.regionCode} · {t('price')}: <span className="font-mono">{l.priceTiyin != null ? `${som(l.priceTiyin, lang)}${l.priceUnit ? ` / ${L.priceUnit[l.priceUnit]}` : ''}` : t('onRequest')}</span> · <span className="font-mono">{l.photos.length}</span> {t('photos')}
        {l.year ? <> · <span className="font-mono">{l.year}</span></> : null}{l.condition ? ` · ${L.condition[l.condition]}` : ''}{l.model ? ` · ${l.model}` : ''}
      </p>
      {l.description ? <p className="mt-2 whitespace-pre-line break-words text-sm">{l.description}</p> : null}
      {l.photos.length ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {l.photos.slice(0, 6).map((p) => <img key={p} src={p} alt="" loading="lazy" decoding="async" className="h-20 w-28 shrink-0 rounded-xl border border-line object-cover" />)}
        </div>
      ) : null}
      {l.contactPhone ? <p className="mt-2 font-mono text-xs text-muted">{t('contact')}: {l.contactPhone}</p> : null}
      {l.status === 'ACTIVE' ? <Link href={listingHref(l)} className="mt-2 inline-block text-sm text-teal-ink underline">{l.slug}</Link> : null}
      <Decide path={`/admin/listings/${l.id}/decide`} reasonKey="reason" requireReason onDone={onDone} />
    </li>
  );
}

function OrgRow({ o, onDone, ...tk }: { o: OrgRecord; onDone: (d: Decision) => void } & TaskProps) {
  const t = useTranslations('admin.org');
  const tr = useTranslations('region');
  const lang = useLang();
  const kinds = o.kinds?.length ? o.kinds : [o.kind];
  return (
    <li id={o.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/orgs/${o.id}`} className="min-w-0 break-words font-semibold text-navy hover:underline">{o.name}</Link>
        {kinds.map((k) => <Pill key={k} tone="ok">{ORG_KIND_LABELS[lang][k]}</Pill>)}
        <RowTask entity="Organization" id={o.id} {...tk} />
        {o.kycRequestedAt ? <span className="ml-auto font-mono text-xs text-muted">{t('requestedAt')} {uzDateTime(o.kycRequestedAt, lang)}</span> : null}
      </div>
      <p className="mt-1 font-mono text-sm">
        {t('stir')}: {o.stir ?? t('noStir')}{o.regionCode && tr.has(o.regionCode) ? <span className="text-muted"> · {t('region')}: {tr(o.regionCode)}</span> : null}
      </p>
      <p className="mt-1 break-words text-sm text-muted">{[o.phone, o.telegram, o.website, o.address].filter(Boolean).join(' · ') || '·'}</p>
      {o.description ? <p className="mt-2 text-sm">{o.description}</p> : null}
      {o.kycDocs?.length ? (<><p className="mt-2 text-xs text-muted">{t('docs')}</p><MessageFiles files={o.kycDocs} mine={false} /></>) : null}
      <Decide path={`/orgs/${o.id}/kyc/decide`} reasonKey="note" requireReason onDone={onDone} />
    </li>
  );
}

/** Terminal da'vosi: da'vogar tashkilot, obyektda ko'rsatilgan egasi va mas'ul shaxs, stansiya, ochiq sahifa; qaror POST /terminals/:id/claim/decide. */
function TerminalClaimRow({ x, onDone, ...task }: { x: AdminTerminal; onDone: (d: Decision) => void } & TaskProps) {
  const t = useTranslations('terminalsAdmin.admin');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  const tcl = useTranslations('claim');
  const lang = useLang();
  // Temir yo'l bo'lmagan obyektda (ROAD, MULTI) pasport yo'q: obyektning o'z raqami olinadi
  const contact = [x.rail?.contactName, x.rail?.contactPhone ?? x.phone].filter(Boolean).join(' · ');
  return (
    <li id={x.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="ok">{tk(x.kind)}</Pill>
        <Link href={`/admin/terminals/${x.id}`} className="min-w-0 break-words font-semibold text-navy hover:underline">{x.name}</Link>
        <span className="text-sm text-muted">{t('station')}: {stationName({ station: x.station, stationNameRaw: x.rail?.stationNameRaw ?? null })}{x.regionCode && tr.has(x.regionCode) ? ` · ${tr(x.regionCode)}` : ''}</span>
        <RowTask entity="Terminal" id={x.id} {...task} />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span><span className="text-muted">{t('claimant')}:</span> <span className="font-semibold">{x.claimOrgName ?? x.claimOrgId ?? '·'}</span></span>
        {x.claimOrgStir ? <span className="font-mono text-muted">{t('stir')}: {x.claimOrgStir}</span> : null}
        {x.claimOrgKyc ? <Pill tone={x.claimOrgKyc === 'VERIFIED' ? 'ok' : 'neutral'}>{KYC_STATUS_LABELS[lang][x.claimOrgKyc]}</Pill> : null}
      </p>
      {/* Egalikning eng arzon dalili: da'vogarning kod bilan tasdiqlangan raqami obyektdagi
          raqamga mosmi. Obyektda raqam bo'lmasa belgi chizilmaydi, "mos emas" ham emas. */}
      {x.claimantPhone ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span><span className="text-muted">{t('claimantPhone')}:</span> <span className="font-mono font-semibold">{x.claimantPhone}</span></span>
          {x.phoneMatch === null ? null : <Pill tone={x.phoneMatch ? 'ok' : 'warn'}>{t(x.phoneMatch ? 'phoneMatch' : 'phoneNoMatch')}</Pill>}
        </p>
      ) : null}
      {/*
       * Moderator javob beradigan savol bitta: da'vogar haqiqatan shu obyektning egasimi.
       * Shuning uchun obyektda ko'rsatilgan egasi va mas'ul shaxs raqami da'vogar yonida
       * turadi. Bu yo'l xom qatorni qaytaradi, ya'ni maydonlar javobda bor edi, chizilmasdi.
       */}
      {x.rail?.ownerNameRaw ? <p className="mt-1 text-sm"><span className="text-muted">{tcl('registryOwner')}:</span> <span className="font-semibold">{x.rail.ownerNameRaw}</span></p> : null}
      {contact ? <p className="mt-1 text-sm"><span className="text-muted">{tcl('cardContact')}:</span> <span className="font-mono font-semibold">{contact}</span></p> : null}
      {x.claimEvidence ? (
        <>
          <p className="mt-2 whitespace-pre-line break-words text-sm"><span className="text-muted">{t('claimNote')}: </span>{x.claimEvidence.note}</p>
          {x.claimEvidence.files.length ? (<><p className="mt-2 text-xs text-muted">{t('claimDocs')}</p><MessageFiles files={x.claimEvidence.files} mine={false} /></>) : null}
        </>
      ) : null}
      <Link href={`/terminals/${x.slug}`} className="mt-1 inline-block text-sm text-teal-ink underline">{t('open')}</Link>
      <Decide path={`/terminals/${x.id}/claim/decide`} reasonKey="reason" requireReason onDone={onDone} />
    </li>
  );
}

/**
 * Premium to'lovi (qo'lda): e'lon, tashkilot, oylar, summa.
 * Tasdiq -> PAID va premiumUntil uzayadi. Bekor qilish -> CANCELLED, e'lon o'zgarmaydi.
 *
 * Bekor qilish ilgari umuman yo'q edi: to'lamagan odamning buyurtmasi navbatda abadiy
 * qolib ketardi va operatorda ikki yo'l bo'lardi, pulsiz Premium berish yoki qatorni
 * umrbod ko'rib yurish. Sabab majburiy, chunki u auditga yoziladi.
 */
function PremiumRow({ o, onDone, ...tk }: { o: AdminPremiumOrder; onDone: (text: string) => void } & TaskProps) {
  const lang = useLang();
  const t = useTranslations('premium.admin');
  const ta = useTranslations('admin');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [reason, setReason] = useState<string | null>(null); // null = sabab maydoni yopiq
  async function confirm() {
    setBusy(true); setErr(false);
    try { const r = await post<{ premiumUntil: string }>(`/admin/premium/${o.id}/confirm`, {}); onDone(t('confirmed', { until: uzDateTime(r.premiumUntil, lang) })); }
    catch { setErr(true); setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setErr(false);
    try { await post(`/admin/premium/${o.id}/cancel`, { reason: reason?.trim() }); onDone(t('cancelled')); }
    catch { setErr(true); setBusy(false); }
  }
  return (
    <li id={o.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{o.listing.title}</span>
        <Pill tone="warn">{t(`status.${o.status}`)}</Pill>
        <RowTask entity="PremiumOrder" id={o.id} {...tk} />
        <span className="ml-auto font-mono text-xs text-muted">{t('created')} {uzDateTime(o.createdAt, lang)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t('org')}: <span className="text-ink">{o.listing.orgName ?? '·'}</span> · <span className="font-mono">{t('months', { n: o.months })}</span> · <span className="font-mono font-semibold text-navy">{som(o.amountTiyin, lang)}</span> · {t('until')}: <span className="font-mono">{o.listing.premiumUntil ? uzDateTime(o.listing.premiumUntil, lang) : t('noPremium')}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{o.id}</p>
      <div className="mt-3">
        {reason === null ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={confirm} className={BTN}>{busy ? t('confirming') : t('confirm')}</button>
            <button type="button" disabled={busy} onClick={() => setReason('')} className={BTN_DANGER}>{t('cancel')}</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
              placeholder={ta('reason')} className={`${INPUT} w-full sm:w-72`} />
            <ConfirmButton label={t('cancel')} confirm={ta('confirmReject')} onRun={cancel} disabled={busy || !reason.trim()} />
            <button type="button" onClick={() => setReason(null)} className={BTN_GHOST}>{ta('cancel')}</button>
          </div>
        )}
        {err ? <p role="alert" className="mt-2 text-sm text-red-700">{t('failed')}</p> : null}
      </div>
    </li>
  );
}

/**
 * Obuna to'lovi (qo'lda): foydalanuvchi, tashkilot, oylar, summa. Tasdiq -> ACTIVE va
 * muddat boshlanadi (faol obuna bo'lsa uzayadi). Bekor -> CANCELLED, obuna berilmaydi.
 * Premium qatori bilan bir xil shakl: operator ikkalasini bir xil o'qiydi, tashkilot
 * u yerda ham sarlavhada emas, tana paragrafida turadi.
 *
 * Tashkilot kerak, chunki jamoa bitta o'tkazma qiladi: operator ko'chirmadagi bitta
 * summani qaysi qatorlarga taqsimlashini shu bo'yicha ko'radi. Qatorlar serverda
 * tashkilot id si bo'yicha guruhlab keladi.
 */
function SubscriptionRow({ s, onDone, ...tk }: { s: AdminSubscription; onDone: (text: string) => void } & TaskProps) {
  const lang = useLang();
  const t = useTranslations('subscription.admin');
  const ta = useTranslations('admin');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [reason, setReason] = useState<string | null>(null); // null = sabab maydoni yopiq
  const [pay, setPay] = useState<{ som: string; ref: string } | null>(null); // null = tasdiq formasi yopiq
  const expectedSom = Math.round(s.amountTiyin / 100);
  const got = pay && pay.som.trim() !== '' ? Number(pay.som) : null;
  // Farq faqat ogohlantiradi: pul kelgani rost, kam kelgani alohida gap
  const diff = got != null && Number.isFinite(got) && got !== expectedSom;
  async function confirm() {
    setBusy(true); setErr(false);
    try {
      const r = await post<{ endsAt: string }>(`/admin/subscriptions/${s.id}/confirm`, {
        receivedSom: got != null && Number.isFinite(got) ? got : undefined,
        payRef: pay?.ref.trim() || undefined,
      });
      onDone(t('confirmed', { until: uzDateTime(r.endsAt, lang) }));
    } catch { setErr(true); setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setErr(false);
    try { await post(`/admin/subscriptions/${s.id}/cancel`, { reason: reason?.trim() }); onDone(t('cancelled')); }
    catch { setErr(true); setBusy(false); }
  }
  const who = s.user.fullName || s.user.phone || s.user.email || s.userId;
  return (
    <li id={s.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{who}</span>
        <Pill tone="warn">{t(`status.${s.status}`)}</Pill>
        <RowTask entity="Subscription" id={s.id} {...tk} />
        <span className="ml-auto font-mono text-xs text-muted">{t('created')} {uzDateTime(s.createdAt, lang)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t('org')}: <span className="text-ink">{s.orgName ?? '·'}</span> · {t('user')}: <span className="font-mono text-ink">{s.user.phone ?? s.user.email ?? '·'}</span> · <span className="font-mono">{t('months', { n: s.months })}</span> · <span className="font-mono font-semibold text-navy">{som(s.amountTiyin, lang)}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{s.no}</p>
      <div className="mt-3">
        {reason === null && pay === null ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => setPay({ som: String(expectedSom), ref: '' })} className={BTN}>{t('confirm')}</button>
            <button type="button" disabled={busy} onClick={() => setReason('')} className={BTN_DANGER}>{t('cancel')}</button>
          </div>
        ) : pay !== null ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <Labeled label={t('received')}>
                {/* maxLength: server 1 000 000 000 dan oshganini 400 bilan qaytaradi */}
                <input autoFocus inputMode="numeric" maxLength={10} value={pay.som} onChange={(e) => setPay({ ...pay, som: e.target.value.replace(/[^0-9]/g, '') })} className={`${INPUT} w-40 font-mono`} />
              </Labeled>
              <Labeled label={t('payRef')} className="min-w-0 flex-1">
                <input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} maxLength={200} className={INPUT} />
              </Labeled>
            </div>
            {diff ? <Notice tone="warn">{t('diff', { expected: som(s.amountTiyin, lang), got: som(Number(got) * 100, lang) })}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={confirm} className={BTN}>{busy ? t('confirming') : t('confirm')}</button>
              <button type="button" onClick={() => setPay(null)} className={BTN_GHOST}>{ta('cancel')}</button>
            </div>
          </div>
        ) : reason !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
              placeholder={ta('reason')} className={`${INPUT} w-full sm:w-72`} />
            <ConfirmButton label={t('cancel')} confirm={ta('confirmReject')} onRun={cancel} disabled={busy || !reason.trim()} />
            <button type="button" onClick={() => setReason(null)} className={BTN_GHOST}>{ta('cancel')}</button>
          </div>
        ) : null}
        {err ? <p role="alert" className="mt-2 text-sm text-red-700">{t('failed')}</p> : null}
      </div>
    </li>
  );
}

/**
 * Murojaat qutisi: qidiruv, sahifalash va o'chirish.
 *
 * Hal qilingani uchta ustun bilan belgilanadi: kim, qachon, nima qilingan. Alohida
 * holat maydoni yo'q, sana bo'sh bo'lishi "yangi" degani. Sukut filtr javobsizlar:
 * yorliqdagi son ham shuni sanaydi.
 */
function ContactTab({ onChanged, ctx }: { onChanged: () => void; ctx: TaskCtx }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tm = useTranslations('premium.messages');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  // Sukut: javobsizlar. Bo'sh qiymat useAdminList da tashlab yuboriladi, ya'ni filtrsiz
  const [handled, setHandled] = useState('0');
  const list = useAdminList<ContactPage['items'][number]>('/admin/contact/all', { q, handled, page });
  // ponytail: mine filtri faqat joriy sahifa ichida (server ids filtri yo'q), matn bilan aytiladi; kerak bo'lsa keyin ?ids=
  const items = list.data ? (ctx.mine ? list.data.items.filter((m) => ctx.taskOf('ContactMessage', m.id)?.assignee?.id === ctx.meId) : list.data.items) : [];
  useHashRing(!!list.data && !list.loading);

  async function remove(id: string) {
    setNote(null);
    try {
      await api(`/admin/contact/${id}`, { method: 'DELETE' });
      await list.reload();
      onChanged();
      ctx.reloadTasks();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  async function mark(id: string, on: boolean, why?: string) {
    setNote(null);
    try {
      await post(`/admin/contact/${id}/handled`, { handled: on, note: why });
      await list.reload();
      onChanged();
      ctx.reloadTasks();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  return (
    <>
      <Toolbar onSubmit={() => { setQ(qInput.trim()); setPage(1); }}>
        <Labeled label={tc('search')} className="w-72">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} className={INPUT} />
        </Labeled>
        <Labeled label={tm('filter')} className="w-48">
          <select value={handled} onChange={(e) => { setHandled(e.target.value); setPage(1); }} className={INPUT}>
            <option value="0">{tm('filterNew')}</option>
            <option value="1">{tm('filterHandled')}</option>
            <option value="">{tc('all')}</option>
          </select>
        </Labeled>
        <button type="submit" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal">{tc('apply')}</button>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {ctx.mine ? <p className="mt-3 text-xs text-muted">{t('tasks.pageOnly')}</p> : null}
      {list.loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {list.err ? <Notice tone="err">{errText(list.err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {list.data && !list.loading ? (
        items.length
          ? <ul className="mt-4 space-y-3">{items.map((m) => <ContactRow key={m.id} m={m} onDelete={remove} onMark={mark} task={ctx.taskOf('ContactMessage', m.id)} onTaskChanged={ctx.reloadTasks} />)}</ul>
          : <div className={`${CARD} mt-4 border-dashed px-6 py-12 text-center text-sm text-muted`}>{ctx.mine ? t('tasks.mineEmpty') : tm(handled === '0' ? 'emptyNew' : 'empty')}</div>
      ) : null}
      <Pager page={page} pages={list.pages} onPage={setPage} />
    </>
  );
}

/** Aloqa formasidan kelgan murojaat: javob telefon yoki email orqali, spam o'chiriladi. */
function ContactRow({ m, onDelete, onMark, ...tk }: {
  m: ContactPage['items'][number];
  onDelete: (id: string) => Promise<void>;
  onMark: (id: string, on: boolean, why?: string) => Promise<void>;
} & TaskProps) {
  const lang = useLang();
  const tc = useTranslations('admin.common');
  const t = useTranslations('premium.messages');
  const [why, setWhy] = useState('');
  return (
    <li id={m.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="ok">{t.has(`topic.${m.topic}`) ? t(`topic.${m.topic}`) : m.topic}</Pill>
        <span className="font-semibold">{m.name}</span>
        {/* Raqam ham, pochta ham foydalanuvchilar qidiruviga tushadi: u uchalasi bo'yicha qidiradi */}
        <Link href={`/admin/users?q=${encodeURIComponent(m.contact)}`} className="min-w-0 break-all font-mono text-sm text-teal-ink underline">{m.contact}</Link>
        {/* Hal qilingan murojaat navbatdan chiqqan: vazifa ochilmaydi (server 409 NOT_IN_QUEUE) */}
        {m.handledAt ? null : <RowTask entity="ContactMessage" id={m.id} {...tk} />}
        <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(m.createdAt, lang)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line break-words text-sm">{m.message}</p>
      {m.handledNote ? <p className="mt-2 rounded-xl bg-sand p-3 text-sm">{m.handledNote}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {m.handledAt ? (
          <>
            <Pill tone="ok">{t('handled')}</Pill>
            {/* Admin hisobi o'chirilgan bo'lsa ism topilmaydi, faqat sana qoladi */}
            <span className="text-xs text-muted">{m.handledBy?.fullName || m.handledBy?.phone || ''} {uzDateTime(m.handledAt, lang)}</span>
            <button type="button" className={`${BTN_GHOST} px-3 py-1 text-xs`} onClick={() => void onMark(m.id, false)}>{t('undo')}</button>
          </>
        ) : (
          <>
            <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} placeholder={t('note')} className={`${INPUT} w-full sm:w-72`} />
            <button type="button" className={`${BTN} px-3 py-1 text-xs`} onClick={() => void onMark(m.id, true, why.trim())}>{t('handle')}</button>
          </>
        )}
        <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => onDelete(m.id)} className={`${BTN_DANGER} px-3 py-1 text-xs`} />
      </div>
    </li>
  );
}

/**
 * Shikoyatlar: obyekt, sabab, matn va qaror.
 *
 * Sukut filtr yangilar; yorliqdagi son ham shuni sanaydi. Saralash tanlovi ataylab
 * yo'q: bu navbat, jadval emas - tartib doim yangisidan eskisiga.
 *
 * Obyektni yashirish tugmasi bu yerda YO'Q: har turning o'z ekrani va o'z amali bor.
 * Qator obyekt sahifasiga havola qiladi, qaror esa shikoyatning o'ziga tegishli.
 */
function ReportsTab({ onChanged, ctx }: { onChanged: () => void; ctx: TaskCtx }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tr = useTranslations('admin.reports');
  const lang = useLang();
  const [status, setStatus] = useState('NEW');
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState<Flash>(null);
  const list = useAdminList<ReportPage['items'][number]>('/admin/reports', { status, page });
  // ponytail: mine filtri faqat joriy sahifa ichida (ContactTab bilan bir xil sabab)
  const items = list.data ? (ctx.mine ? list.data.items.filter((r) => ctx.taskOf('Report', r.id)?.assignee?.id === ctx.meId) : list.data.items) : [];
  useHashRing(!!list.data && !list.loading);

  return (
    <>
      <Toolbar onSubmit={() => setPage(1)}>
        <Labeled label={tc('status')} className="w-48">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={INPUT}>
            {REPORT_STATUSES.map((s) => <option key={s} value={s}>{REPORT_STATUS_LABELS[lang][s]}</option>)}
            <option value="">{tc('all')}</option>
          </select>
        </Labeled>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>
      {flash ? <p role="status" className={`mt-3 text-sm font-semibold ${flash.tone === 'ok' ? 'text-teal-ink' : 'text-red-700'}`}>{flash.text}</p> : null}
      {ctx.mine ? <p className="mt-3 text-xs text-muted">{t('tasks.pageOnly')}</p> : null}
      {list.loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {list.err ? <Notice tone="err">{errText(list.err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {list.data && !list.loading ? (
        items.length
          ? <ul className="mt-4 space-y-3">{items.map((r) => (
              <ReportRow key={r.id} r={r} task={ctx.taskOf('Report', r.id)} onTaskChanged={ctx.reloadTasks} onDone={(d) => {
                setFlash({ text: tr(d === 'approved' ? 'doneResolved' : 'doneDismissed'), tone: d === 'approved' ? 'ok' : 'bad' });
                void list.reload();
                onChanged();
                ctx.reloadTasks();
              }} />
            ))}</ul>
          : <div className={`${CARD} mt-4 border-dashed px-6 py-12 text-center text-sm text-muted`}>{ctx.mine ? t('tasks.mineEmpty') : tr('empty')}</div>
      ) : null}
      <Pager page={page} pages={list.pages} onPage={setPage} />
    </>
  );
}

/** Bitta shikoyat: nima ustidan, nega, kim yozgan va qaror. */
function ReportRow({ r, onDone, ...tk }: { r: ReportPage['items'][number]; onDone: (d: Decision) => void } & TaskProps) {
  const lang = useLang();
  const tr = useTranslations('admin.reports');
  return (
    <li id={r.id} className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={r.status === 'NEW' ? 'warn' : r.status === 'RESOLVED' ? 'ok' : 'neutral'}>{REPORT_STATUS_LABELS[lang][r.status]}</Pill>
        <span className="text-xs font-semibold text-muted">{REPORT_TARGET_LABELS[lang][r.targetKind]}</span>
        {/* Nom va havola shikoyat yuborilgan paytdagi holicha: obyekt o'chsa ham qator o'qiladi */}
        <Link href={r.targetHref} className="min-w-0 break-words font-semibold text-teal-ink underline">{r.targetTitle}</Link>
        {/* Faqat yangi shikoyat navbatda: qaror berilganiga vazifa ochilmaydi */}
        {r.status === 'NEW' ? <RowTask entity="Report" id={r.id} {...tk} /> : null}
        <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(r.createdAt, lang)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{REPORT_REASON_LABELS[lang][r.reason]}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm">{r.text}</p>
      {/* Yuborgan odam: takroriy shikoyatchi ko'rinib tursin va kerak bo'lsa bog'lanish mumkin.
          Id bo'lsa to'g'ridan-to'g'ri obyekt sahifasi, bo'lmasa telefon bo'yicha qidiruv */}
      <p className="mt-2 text-xs text-muted">
        {tr('reporter')}:{' '}
        <Link href={r.reporterId ? `/admin/users/${r.reporterId}` : `/admin/users?q=${encodeURIComponent(r.reporter?.phone ?? '')}`} className="text-teal-ink underline">
          {r.reporter?.fullName || r.reporter?.phone || r.reporterId}
        </Link>
      </p>
      {r.status === 'NEW' ? (
        <Decide path={`/admin/reports/${r.id}/decide`} reasonKey="note" requireReason={false} yes={tr('decideYes')} no={tr('decideNo')} onDone={onDone} />
      ) : (
        <p className="mt-2 text-xs text-muted">
          {tr('resolvedBy')}: {r.resolvedBy?.fullName || r.resolvedBy?.phone || ''} {r.resolvedAt ? uzDateTime(r.resolvedAt, lang) : ''}
          {r.resolveNote ? ` · ${r.resolveNote}` : ''}
        </p>
      )}
    </li>
  );
}
