'use client';
/**
 * Tashkilot obyekt sahifasi: ro'yxatdagi yon varaq shu yerga ko'chdi (havola ulashiladi,
 * paleta shu yerga olib keladi). Umumiy yorliqda tashkilot tasdig'i bloki (hujjatlar, qaror),
 * forma va a'zolar; Bog'liq da terminallari, e'lonlari, buyurtmalari; Pul faqat egaga;
 * Tarix va Izohlar. Yangi platforma admini AYNAN shu yerda emas, Jamoa ekranida tayinlanadi:
 * a'zo rollari faqat ko'rinadi, egalik belgisi o'zgartiriladi.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { KYC_STATUSES, type ClaimStatus, type OrderStatus, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import { num, som, uzDate, uzDateTime } from '@/lib/format';
import type { ClaimFile, OwnerListing } from '@/lib/types-kabinet';
import { phoneDisplay } from '@/components/ui/fields';
import { ListingStatusPill, useListingLabels } from '@/components/kabinet/bits';
import { StatusPill } from '@/components/order/bits';
import { MessageFiles } from '@/components/chat/Attachments';
import { BTN, BTN_GHOST, CARD, ConfirmButton, DataTable, INPUT, Labeled, Notice, Pill, Skeleton, errText, type Col } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';
import { Decide } from '@/components/admin/Decide';
import { Fact, FACTS, ObjectPage, RelatedTable, Section } from '@/components/admin/ObjectPage';
import { NotesTab } from '@/components/admin/NotesTab';
import { AuditFeed } from '@/components/admin/AuditFeed';

type Member = { id: string; phone: string | null; fullName: string | null; roles: string[]; isOwner: boolean; createdAt: string };
/** GET /admin/orgs/:id: barcha ustunlar + a'zolar + nimaga egalik qilishi + izohlar soni. */
type Detail = {
  id: string; name: string; slug: string | null; kind: string; kinds: string[]; stir: string | null; kycStatus: string;
  kycRequestedAt: string | null; kycNote: string | null; kycDocs: ClaimFile[] | null;
  phone: string | null; address: string | null; regionCode: string | null; description: string | null; telegram: string | null; website: string | null;
  isDemo: boolean; createdAt: string;
  counts: { terminals: number; listings: number; orders: number }; members: Member[]; notesCount: number;
};
type Form = { name: string; slug: string; stir: string; kycStatus: string; kycNote: string };
type MemberEdit = { roles: string[]; isOwner: boolean };
/** GET /admin/orgs/:id/money (faqat ega). */
type Money = {
  premium: { id: string; listingId: string; months: number; amountTiyin: number; status: string; paidAt: string | null }[];
  subscriptions: { id: string; no: string; status: string; amountTiyin: number; endsAt: string | null; user: { id: string; fullName: string | null; phone: string | null } }[];
  paidTotalTiyin: number;
  orders: { total: number; done: number; doneTiyin: number; commissionTiyin: number; lastAt: string | null };
};
/** GET /admin/catalog/terminals qatorining shu yerda kerak qismi. */
type TerminalRow = { id: string; name: string; slug: string; kind: TerminalKind; status: TerminalStatus; claimStatus: ClaimStatus; createdAt: string };
type OrderRow = { no: string; status: OrderStatus; createdAt: string; totalTiyin: number; terminal: { id: string; name: string } };

const kycTone = (s: string) => (s === 'VERIFIED' ? 'ok' : s === 'PENDING' ? 'warn' : s === 'REJECTED' ? 'bad' : 'neutral');
const payTone = (s: string) => (s === 'ACTIVE' || s === 'PAID' ? 'ok' : s === 'PENDING' ? 'warn' : 'neutral');
const toForm = (d: Detail): Form => ({ name: d.name, slug: d.slug ?? '', stir: d.stir ?? '', kycStatus: d.kycStatus, kycNote: d.kycNote ?? '' });

export default function OrgPage() {
  const { id } = useParams<{ id: string }>();
  const to = useTranslations('admin.object');
  const tt = useTranslations('admin.table');
  const tl = useTranslations('admin.listings');
  const tk = useTranslations('kyc');
  const tok = useTranslations('orgKind');
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [notes, setNotes] = useState<number | null>(null);

  // Qayta yuklashda eski tafsilot turadi: saqlashdan keyin forma va a'zolar sakramasin
  const load = useCallback(() => { setErr(null); return api<Detail>(`/admin/orgs/${id}`).then(setD).catch(setErr); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const notFound = err instanceof ApiError && err.status === 404;

  return (
    <ObjectPage
      entity="Organization" id={id} back="/admin/orgs"
      title={d?.name ?? ''}
      subtitle={d ? d.kinds.map((k) => (tok.has(k) ? tok(k) : k)).join(', ') : undefined}
      pills={d ? (
        <>
          <Pill tone={kycTone(d.kycStatus)}>{tk.has(d.kycStatus) ? tk(d.kycStatus) : d.kycStatus}</Pill>
          {d.isDemo ? <Pill tone="warn">{tl('demo')}</Pill> : null}
        </>
      ) : null}
      actions={d?.slug ? <Link href={`/k/${d.slug}`} target="_blank" className={`${BTN_GHOST} px-3 py-1.5 text-xs`}>{tt('storefront')}</Link> : null}
      loading={!d && !err} notFound={notFound} error={!notFound && err ? err : undefined} onRetry={() => void load()}
      tabs={d ? [
        { key: 'general', label: to('tabs.general'), render: () => <General d={d} reload={load} /> },
        { key: 'related', label: to('tabs.related'), count: d.counts.terminals + d.counts.listings + d.counts.orders, render: () => <Related d={d} /> },
        { key: 'money', label: to('tabs.money'), owner: true, render: () => <MoneyTab id={d.id} /> },
        { key: 'history', label: to('tabs.history'), render: () => <AuditFeed entity="Organization" entityId={d.id} /> },
        { key: 'notes', label: to('tabs.notes'), count: notes ?? d.notesCount, render: () => <NotesTab entity="Organization" entityId={d.id} onCount={setNotes} /> },
      ] : []}
    />
  );
}

/** Umumiy: tashkilot tasdig'i, forma, a'zolar, Saqlash / O'chirish (ega). */
function General({ d, reload }: { d: Detail; reload: () => Promise<void> }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  const trole = useTranslations('kabinet.org.role');
  const tk = useTranslations('kyc');
  const tok = useTranslations('orgKind');
  const tr = useTranslations('region');
  const locale = useLocale();
  const router = useRouter();
  const { isOwner } = useAdminMe();

  const [form, setForm] = useState<Form>(() => toForm(d));
  const [mem, setMem] = useState<Record<string, MemberEdit>>({});
  // Qayta yuklangan qator formaga: saqlangan qiymat asos, qo'lda belgilangan a'zolar tozalanadi
  useEffect(() => { setForm(toForm(d)); setMem(Object.fromEntries(d.members.map((m) => [m.id, { roles: m.roles, isOwner: m.isOwner }]))); }, [d]);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
  /** Rollar tartibi muhim emas: faqat to'plam o'zgarganini bilmoqchimiz. */
  const sameRoles = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  /** Qo'lda o'zgartirilgan a'zolar. */
  const dirtyMembers = d.members.filter((m) => { const e = mem[m.id]; return e && (e.isOwner !== m.isOwner || !sameRoles(e.roles, m.roles)); });
  const formDiff = Object.fromEntries(
    // ponytail: bo'sh STIR yuborilmaydi (DTO 9 raqam talab qiladi); STIR ni o'chirish bazadan
    (Object.keys(form) as (keyof Form)[]).filter((k) => form[k] !== toForm(d)[k] && !(k === 'stir' && !form[k])).map((k) => [k, form[k]]),
  );
  const dirty = Object.keys(formDiff).length > 0 || dirtyMembers.length > 0;

  async function save() {
    if (!dirty) return;
    setBusy(true); setNote(null);
    try {
      if (Object.keys(formDiff).length) await api(`/admin/orgs/${d.id}`, { method: 'PATCH', body: JSON.stringify(formDiff) });
      // A'zo rollari ham shu tugma bilan saqlanadi: ilgari katta "Saqlash" faqat tashkilot
      // maydonlarini yuborardi va belgilangan rollar jimgina yo'qolardi. Ketma-ket: birinchi xato to'xtatadi.
      for (const m of dirtyMembers) {
        await api(`/admin/orgs/${d.id}/members/${m.id}`, { method: 'PATCH', body: JSON.stringify(mem[m.id]) });
      }
      setNote({ tone: 'ok', text: tc('saved') });
      await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function removeOrg() {
    setNote(null);
    try {
      await api(`/admin/orgs/${d.id}`, { method: 'DELETE' });
      router.push('/admin/orgs');
    } catch (e) { fail(e); }
  }

  async function saveMember(userId: string) {
    setBusy(true); setNote(null);
    try {
      await api(`/admin/orgs/${d.id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(mem[userId]) });
      setNote({ tone: 'ok', text: tc('saved') });
      await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function removeMember(userId: string) {
    setNote(null);
    try {
      await api(`/admin/orgs/${d.id}/members/${userId}`, { method: 'DELETE' });
      setNote({ tone: 'ok', text: tc('deleted') });
      await reload();
    } catch (e) { fail(e); }
  }

  const contact = [d.telegram, d.website, d.address].filter(Boolean).join(' / ');

  return (
    <div className="space-y-6">
      <Section title={to('kyc.title')}>
        <div className={`${CARD} p-4`}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={kycTone(d.kycStatus)}>{tk.has(d.kycStatus) ? tk(d.kycStatus) : d.kycStatus}</Pill>
            {d.kycRequestedAt ? <span className="ml-auto font-mono text-xs text-muted">{to('kyc.requestedAt')}: {uzDateTime(d.kycRequestedAt, locale)}</span> : null}
          </div>
          {d.kycDocs?.length ? (<><p className="mt-2 text-xs text-muted">{to('kyc.docs')}</p><MessageFiles files={d.kycDocs} mine={false} /></>) : null}
          {d.kycStatus === 'PENDING' ? <Decide path={`/orgs/${d.id}/kyc/decide`} reasonKey="note" requireReason onDone={() => void reload()} /> : null}
        </div>
      </Section>

      <section className={`${CARD} grid gap-3 p-4 sm:grid-cols-2`}>
        <Labeled label={tc('name')} className="sm:col-span-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} className={INPUT} />
        </Labeled>
        <Labeled label={tc('slug')}>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} maxLength={80} pattern="[a-z0-9-]+" className={`${INPUT} font-mono`} />
        </Labeled>
        <Labeled label={t('orgs.stir')}>
          <input value={form.stir} onChange={(e) => setForm({ ...form, stir: e.target.value.replace(/\D/g, '').slice(0, 9) })} inputMode="numeric" className={`${INPUT} font-mono`} />
        </Labeled>
        <Labeled label={t('orgs.kyc')}>
          <select value={form.kycStatus} onChange={(e) => setForm({ ...form, kycStatus: e.target.value })} className={INPUT}>
            {KYC_STATUSES.map((s) => <option key={s} value={s}>{tk(s)}</option>)}
          </select>
        </Labeled>
        <Labeled label={t('orgs.kinds')}>
          <div className="flex flex-wrap gap-1 py-2">{d.kinds.map((k) => <Pill key={k}>{tok.has(k) ? tok(k) : k}</Pill>)}</div>
        </Labeled>
        <Labeled label={t('orgs.kycNote')} className="sm:col-span-2">
          <textarea value={form.kycNote} onChange={(e) => setForm({ ...form, kycNote: e.target.value })} maxLength={500} rows={2} className={INPUT} />
        </Labeled>
        {/* O'chirish muvaffaqiyati shu raqamlarga bog'liq: birortasi noldan katta bo'lsa ORG_IN_USE */}
        <p className="font-mono text-xs text-muted sm:col-span-2">
          {t('orgs.objects')}: {num(d.counts.terminals, locale)} / {t('nav.listings')}: {num(d.counts.listings, locale)} / {t('nav.orders')}: {num(d.counts.orders, locale)}
        </p>
      </section>

      {/* Aloqa ma'lumoti egasiniki (kabinetda tahrirlanadi): bu yerda faqat o'qiladi, qo'ng'iroq uchun */}
      <dl className={`${FACTS} sm:grid-cols-4`}>
        <Fact k={tc('phone')} v={d.phone ? phoneDisplay(d.phone) : <span className="text-muted">{tc('none')}</span>} mono />
        <Fact k={tc('region')} v={d.regionCode ? (tr.has(d.regionCode) ? tr(d.regionCode) : d.regionCode) : <span className="text-muted">{tc('none')}</span>} />
        <Fact k={t('org.contact')} v={contact || <span className="text-muted">{tc('none')}</span>} />
        <Fact k={tc('createdAt')} v={uzDate(d.createdAt, locale)} mono />
      </dl>

      <Section title={t('orgs.members')} count={d.members.length}>
        <div className="divide-y divide-line rounded-card border border-line bg-white">
          {d.members.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted">{tc('none')}</p> : null}
          {d.members.map((m) => {
            const e = mem[m.id] ?? { roles: m.roles, isOwner: m.isOwner };
            return (
              <div key={m.id} className="space-y-2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/users/${m.id}`} className={`text-sm hover:underline ${m.fullName ? 'font-semibold text-navy' : 'text-muted'}`}>{m.fullName || t('users.noName')}</Link>
                  <span className="font-mono text-xs text-muted">{m.phone ? phoneDisplay(m.phone) : m.id}</span>
                  <label className="ml-auto flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={e.isOwner} className="accent-teal" onChange={(ev) => setMem({ ...mem, [m.id]: { ...e, isOwner: ev.target.checked } })} />
                    {t('orgs.isOwner')}
                  </label>
                </div>
                {/* Rollar faqat ko'rinadi: ularni tashkilot egasi o'z kabinetida qo'yadi,
                    panel huquqi esa Jamoa ekranidan beriladi (u yerda o'zini qulflab qo'yishdan himoya bor) */}
                <p className="text-xs text-muted">{m.roles.map((r) => (trole.has(r) ? trole(r) : r)).join(', ') || tc('none')}</p>
                <div className="flex gap-1.5">
                  <button type="button" disabled={busy} onClick={() => void saveMember(m.id)} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{tc('save')}</button>
                  <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => removeMember(m.id)}
                    className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-60" />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <div className="flex flex-wrap items-start gap-3">
        {/* O'zgarish bo'lmasa o'chiq turadi: ilgari bosilardi-yu hech narsa bo'lmasdi */}
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className={BTN}>{tc('save')}</button>
        {isOwner ? (
          <div className="ml-auto flex flex-col items-end gap-1">
            <span className="text-xs text-muted">{t('orgs.deleteWarn')}</span>
            <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={removeOrg} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Bog'liq: uch mini jadval, har biri "Hammasi" bilan filtrli ro'yxatga. */
function Related({ d }: { d: Detail }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tt = useTranslations('admin.terminals');
  const to = useTranslations('admin.object');
  const tor = useTranslations('admin.orders');
  const tl = useTranslations('admin.listings');
  const ts = useTranslations('terminalsAdmin.status');
  const tcl = useTranslations('claimStatus');
  const tk = useTranslations('kind');
  const locale = useLocale();
  const L = useListingLabels();

  const terminalCols: Col<TerminalRow>[] = [
    { key: 'name', head: tc('name'), cell: (r) => <><div className="font-semibold text-navy">{r.name}</div><div className="font-mono text-[11px] text-muted">{r.slug}</div></> },
    { key: 'kind', head: tt('kind'), cell: (r) => tk(r.kind) },
    { key: 'status', head: tc('status'), cell: (r) => <Pill tone={r.status === 'ACTIVE' ? 'ok' : r.status === 'DRAFT' ? 'warn' : 'neutral'}>{ts(r.status)}</Pill> },
    { key: 'claim', head: tt('claim'), cell: (r) => <Pill tone={r.claimStatus === 'APPROVED' ? 'ok' : r.claimStatus === 'PENDING' ? 'warn' : r.claimStatus === 'REJECTED' ? 'bad' : 'neutral'}>{tcl(r.claimStatus)}</Pill> },
  ];
  const listingCols: Col<OwnerListing>[] = [
    { key: 'title', head: tc('name'), cell: (l) => <span className="font-semibold">{l.title}</span> },
    { key: 'kind', head: tl('kind'), cell: (l) => L.kind[l.kind] },
    { key: 'status', head: tc('status'), cell: (l) => <ListingStatusPill status={l.status} /> },
    { key: 'created', head: tc('createdAt'), num: true, cell: (l) => uzDate(l.createdAt, locale) },
  ];
  const orderCols: Col<OrderRow>[] = [
    { key: 'no', head: tor('no'), cell: (r) => <span className="font-mono font-bold">{r.no}</span> },
    { key: 'status', head: tc('status'), cell: (r) => <StatusPill status={r.status} /> },
    { key: 'terminal', head: tor('terminal'), cell: (r) => r.terminal.name },
    { key: 'total', head: tor('total'), num: true, cell: (r) => som(r.totalTiyin, locale) },
    { key: 'created', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
  ];

  return (
    <div className="space-y-6">
      <RelatedTable<TerminalRow> title={to('related.terminals')} path="/admin/catalog/terminals" filters={{ orgId: d.id }} cols={terminalCols} keyOf={(r) => r.id}
        href={(r) => `/admin/terminals/${r.id}`} all={`/admin/terminals?orgId=${d.id}`} />
      {/* status shart: API status bermasa tekshiruvdagilarni beradi, bu yerda esa saytdagi e'lonlar kerak */}
      <RelatedTable<OwnerListing> title={to('related.listings')} path="/admin/listings" filters={{ orgId: d.id, status: 'ACTIVE' }} cols={listingCols} keyOf={(l) => l.id}
        href={(l) => `/admin/listings/${l.id}`} all={`/admin/listings?orgId=${d.id}&status=ACTIVE`} />
      <RelatedTable<OrderRow> title={t('nav.orders')} path="/admin/orders" filters={{ orgId: d.id }} cols={orderCols} keyOf={(r) => r.no}
        href={(r) => `/admin/orders?open=${r.no}`} all={`/admin/orders?orgId=${d.id}`} />
    </div>
  );
}

/**
 * Pul (faqat ega, yorliqning o'zi operatorga chizilmaydi). Qaror: to'layotgan tashkilotga
 * tasdiq navbatida ustunlik, nizoda yumshoqlik, komissiya kiritilsa qancha to'laydi.
 */
function MoneyTab({ id }: { id: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  const ts = useTranslations('admin.subs');
  const tp = useTranslations('premium.admin');
  const locale = useLocale();
  const [m, setM] = useState<Money | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    let alive = true;
    api<Money>(`/admin/orgs/${id}/money`).then((x) => { if (alive) setM(x); }).catch((e) => { if (alive) setErr(e); });
    return () => { alive = false; };
  }, [id]);

  if (err) return <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice>;
  if (!m) return <div className={`${CARD} px-4 py-5`}><Skeleton rows={4} /></div>;

  const status = (s: string, label: string) => <Pill tone={payTone(s)}>{label}</Pill>;
  const premiumCols: Col<Money['premium'][number]>[] = [
    { key: 'listing', head: t('nav.listings'), cell: (r) => <Link href={`/admin/listings/${r.listingId}`} className="font-mono text-xs text-teal-ink hover:underline">{r.listingId}</Link> },
    { key: 'months', head: ts('months'), num: true, cell: (r) => num(r.months, locale) },
    { key: 'amount', head: ts('amount'), num: true, cell: (r) => som(r.amountTiyin, locale) },
    { key: 'status', head: tc('status'), cell: (r) => status(r.status, tp.has(`status.${r.status}`) ? tp(`status.${r.status}`) : r.status) },
    { key: 'paidAt', head: ts('paidAt'), num: true, cell: (r) => (r.paidAt ? uzDate(r.paidAt, locale) : '') },
  ];
  const subCols: Col<Money['subscriptions'][number]>[] = [
    { key: 'no', head: ts('no'), cell: (r) => <span className="font-mono font-bold">{r.no}</span> },
    { key: 'user', head: t('nav.users'), cell: (r) => <Link href={`/admin/users/${r.user.id}`} className="text-teal-ink hover:underline">{r.user.fullName || (r.user.phone ? phoneDisplay(r.user.phone) : r.user.id)}</Link> },
    { key: 'status', head: tc('status'), cell: (r) => status(r.status, ts.has(`status.${r.status}`) ? ts(`status.${r.status}`) : r.status) },
    { key: 'amount', head: ts('amount'), num: true, cell: (r) => som(r.amountTiyin, locale) },
    { key: 'endsAt', head: ts('endsAt'), num: true, cell: (r) => (r.endsAt ? uzDate(r.endsAt, locale) : '') },
  ];
  const empty = !m.premium.length && !m.subscriptions.length && !m.orders.total;

  return (
    <div className="space-y-6">
      {empty ? <p className={`${CARD} border-dashed px-6 py-8 text-center text-sm text-muted`}>{to('money.none')}</p> : null}
      <dl className={`${FACTS} sm:grid-cols-3 lg:grid-cols-5`}>
        <Fact k={to('money.paidTotal')} v={som(m.paidTotalTiyin, locale)} mono />
        <Fact k={to('money.ordersDone')} v={`${num(m.orders.done, locale)} / ${num(m.orders.total, locale)}`} mono />
        <Fact k={to('money.ordersDoneSum')} v={som(m.orders.doneTiyin, locale)} mono />
        <Fact k={to('money.commissionSum')} v={som(m.orders.commissionTiyin, locale)} mono />
        <Fact k={to('money.lastOrder')} v={m.orders.lastAt ? uzDate(m.orders.lastAt, locale) : <span className="text-muted">{tc('none')}</span>} mono />
      </dl>
      {/* Son yonida qaror matni: bu raqamlar bezak emas, tasdiq navbati va nizoda qanday yo'l tutishni aytadi */}
      <p className="text-xs text-muted">{to('money.orgHint')}</p>
      <Section title={to('money.premium')} count={m.premium.length}>
        <DataTable cols={premiumCols} rows={m.premium} keyOf={(r) => r.id} empty={to('money.none')} />
      </Section>
      <Section title={to('money.subs')} count={m.subscriptions.length}>
        <DataTable cols={subCols} rows={m.subscriptions} keyOf={(r) => r.id} empty={to('money.none')} href={(r) => `/admin/subscriptions?open=${r.id}`} />
      </Section>
    </div>
  );
}
