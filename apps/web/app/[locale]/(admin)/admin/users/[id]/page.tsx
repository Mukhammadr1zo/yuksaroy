'use client';
/**
 * Foydalanuvchi obyekt sahifasi: ro'yxatdagi yon varaq shu yerga ko'chdi (havola ulashiladi,
 * paleta shu yerga olib keladi). Umumiy yorliqda hisob faktlari va ikkita xavfli amal
 * (bloklash operatorga, o'chirish egaga; ikkalasida sabab majburiy va auditga yoziladi).
 * Bog'liq da tashkilotlari, e'lonlari, so'rovlari, xizmat profillari; Pul da obunalari,
 * ochgan raqamlari, vagon qidiruvlari (shikoyat yoki qaytarish so'rovida to'laganmi,
 * suiiste'mol bormi); Tarix (hisob ustidagi amallar) va sarlavhada "Uning amallari".
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SERVICE_TYPE_LABELS, type ListingKind, type ListingStatus, type ServiceType } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { num, som, uzDate, uzDateTime } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { useLang, useListingLabels } from '@/components/kabinet/bits';
import { BTN_DANGER, BTN_GHOST, CARD, ConfirmButton, INPUT, Labeled, Notice, Pill, errText } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';
import { Fact, FACTS, ObjectPage, Section } from '@/components/admin/ObjectPage';
import { NotesTab } from '@/components/admin/NotesTab';
import { AuditFeed } from '@/components/admin/AuditFeed';

/** GET /admin/users/:id: har ro'yxat oxirgi 5 ta bilan chegaralangan, jami sonlar alohida. */
type Detail = {
  id: string; phone: string | null; email: string | null; fullName: string | null; isActive: boolean; createdAt: string; personalRoles: string[];
  locale: string; hasPassword: boolean; hasGoogle: boolean; lockedUntil: string | null; failedLogins: number;
  telegram: { username: string | null; linkedAt: string } | null;
  lastSeenAt: string | null; activeSessions: number; notesCount: number;
  orgs: { id: string; name: string; kyc: string; isOwner: boolean; roles: string[] }[];
  subscriptions: { id: string; no: string; status: string; grants: string[]; months: number; amountTiyin: number; endsAt: string | null; createdAt: string }[];
  listings: { id: string; title: string; kind: string; status: string; createdAt: string }[];
  listingsTotal: number; listingsActive: number;
  marketRequests: { id: string; no: string; board: string; status: string; createdAt: string }[];
  requestsTotal: number;
  serviceProfiles: { id: string; serviceType: string; title: string; status: string }[];
  wagonTotal: number; wagon30d: number; reveals: number;
};

const PATH = '/admin/users';
/** Rang koddan, matn lug'atdan: xom kod (ACTIVE, OPEN) uch tilda ham inglizcha chiqardi. Kalit yo'q bo'lsa kodning o'zi. */
const status = (s: string, label: string) => <Pill tone={s === 'ACTIVE' || s === 'OPEN' || s === 'DONE' ? 'ok' : s === 'PENDING' ? 'warn' : s === 'BLOCKED' || s === 'CANCELLED' ? 'bad' : 'neutral'}>{label}</Pill>;

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('admin');
  const to = useTranslations('admin.object');
  const trl = useTranslations('kabinet.org.role');
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [notes, setNotes] = useState<number | null>(null);

  const load = useCallback(() => { setErr(null); return api<Detail>(`${PATH}/${id}`).then(setD).catch(setErr); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const notFound = err instanceof ApiError && err.status === 404;

  return (
    <ObjectPage
      entity="User" id={id} back="/admin/users"
      title={d ? d.fullName || (d.phone ? phoneDisplay(d.phone) : t('users.noName')) : ''}
      subtitle={d?.personalRoles.length ? d.personalRoles.map((r) => (trl.has(r) ? trl(r) : r)).join(', ') : undefined}
      pills={d && !d.isActive ? <Pill tone="bad">{t('users.blocked')}</Pill> : null}
      loading={!d && !err} notFound={notFound} error={!notFound && err ? err : undefined} onRetry={() => void load()}
      tabs={d ? [
        { key: 'general', label: to('tabs.general'), render: () => <General d={d} reload={load} /> },
        { key: 'related', label: to('tabs.related'), count: d.orgs.length + d.listingsTotal + d.requestsTotal + d.serviceProfiles.length, render: () => <Related d={d} /> },
        { key: 'money', label: to('tabs.money'), render: () => <Money d={d} /> },
        { key: 'history', label: to('tabs.history'), render: () => <AuditFeed entity="User" entityId={d.id} /> },
        { key: 'notes', label: to('tabs.notes'), count: notes ?? d.notesCount, render: () => <NotesTab entity="User" entityId={d.id} onCount={setNotes} /> },
      ] : []}
    />
  );
}

/** Umumiy: hisob faktlari + bloklash/blokdan chiqarish (sabab) + o'chirish (ega, sabab). */
function General({ d, reload }: { d: Detail; reload: () => Promise<void> }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const td = useTranslations('admin.users.detail');
  // "faol" so'zi paleta blokida turadi (holat Pill lari uchun yozilgan): alohida kalit ochilmadi
  const tp = useTranslations('admin.palette');
  const locale = useLocale();
  const router = useRouter();
  const { isOwner } = useAdminMe();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const need = !reason.trim();

  // Sabab auditga yoziladi: ilgari blokda u umuman yuborilmasdi, o'chirishda esa
  // har doim "admin" deb ketardi, ya'ni jurnalda nima uchun ekani qolmasdi.
  async function block(next: boolean) {
    setBusy(true); setNote(null);
    try {
      await post(`${PATH}/${d.id}/block`, { block: next, reason: reason.trim() });
      setNote({ tone: 'ok', text: next ? t('users.blocked') : t('users.unblocked') });
      setReason('');
      await reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  async function remove() {
    setNote(null);
    try {
      await post(`${PATH}/${d.id}/delete`, { reason: reason.trim() });
      router.push('/admin/users');
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  const login = [d.hasPassword ? td('password') : null, d.hasGoogle ? td('google') : null].filter(Boolean).join(', ') || td('codeOnly');
  const locked = d.lockedUntil && new Date(d.lockedUntil) > new Date();

  return (
    <div className="space-y-6">
      <dl className={`${FACTS} sm:grid-cols-3 lg:grid-cols-4`}>
        <Fact k={tc('phone')} v={d.phone ? phoneDisplay(d.phone) : '-'} mono />
        <Fact k={tc('email')} v={d.email || '-'} />
        <Fact k={tc('status')} v={d.isActive ? <Pill tone="ok">{tp('active')}</Pill> : <Pill tone="bad">{t('users.blocked')}</Pill>} />
        <Fact k={tc('createdAt')} v={uzDate(d.createdAt, locale)} mono />
        <Fact k={td('lastSeen')} v={d.lastSeenAt ? uzDateTime(d.lastSeenAt, locale) : td('never')} mono />
        <Fact k={td('sessions')} v={num(d.activeSessions, locale)} mono />
        <Fact k={td('login')} v={login} />
        <Fact k={td('telegram')} v={d.telegram ? (d.telegram.username ? `@${d.telegram.username}` : uzDate(d.telegram.linkedAt, locale)) : td('noTelegram')} mono />
        <Fact k={td('locale')} v={d.locale} mono />
        {locked ? <Fact k={td('failed', { n: d.failedLogins })} v={td('locked', { until: uzDateTime(d.lockedUntil!, locale) })} mono /> : null}
      </dl>

      <section className={`${CARD} p-4`}>
        <Labeled label={t('users.blockReason')} className="sm:max-w-md">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={INPUT} />
        </Labeled>
        {need ? <p className="mt-1 text-[11px] text-muted">{t('reasonRequired')}</p> : null}
        {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || need} onClick={() => void block(d.isActive)} className={BTN_GHOST}>
            {d.isActive ? t('users.block') : t('users.unblock')}
          </button>
        </div>
        {isOwner ? (
          <>
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{t('users.deleteWarn')}</p>
            <div className="mt-2">
              <ConfirmButton label={tc('delete')} confirm={tc('confirm')} disabled={busy || need} onRun={remove} className={BTN_DANGER} />
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

/** Bog'liq: tashkilotlari, e'lonlari (5 + hammasi), so'rovlari (5), xizmat profillari. */
function Related({ d }: { d: Detail }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const td = useTranslations('admin.users.detail');
  const to = useTranslations('admin.object');
  const tk = useTranslations('kyc');
  const tm = useTranslations('admin.market');
  const locale = useLocale();
  const lang = useLang();
  const L = useListingLabels();
  const all = <Link href={`/admin/listings?ownerUserId=${d.id}&status=ACTIVE`} className="font-semibold text-teal-ink hover:underline">{to('related.all')}</Link>;
  return (
    <div className="space-y-6">
      <Section title={t('nav.orgs')} count={d.orgs.length}>
        {!d.orgs.length ? <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{t('users.noOrg')}</p> : (
          <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
            {d.orgs.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Link href={`/admin/orgs/${o.id}`} className="min-w-0 font-semibold text-teal-ink hover:underline wrap-anywhere">{o.name}</Link>
                {o.isOwner ? <Pill tone="ok">{t('users.owner')}</Pill> : null}
                <Pill tone={o.kyc === 'VERIFIED' ? 'ok' : o.kyc === 'PENDING' ? 'warn' : 'neutral'}>{tk.has(o.kyc) ? tk(o.kyc) : o.kyc}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('users.listings')} count={d.listingsTotal} aside={d.listingsTotal ? all : null}>
        <p className="mb-1 text-xs text-muted">{td('listingsActive', { n: num(d.listingsActive, locale) })}</p>
        {d.listings.length ? (
          <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
            {d.listings.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                <Link href={`/admin/listings/${l.id}`} className="min-w-0 flex-1 truncate text-teal-ink hover:underline">{l.title}</Link>
                <span className="font-mono text-[11px] text-muted">{L.kind[l.kind as ListingKind] ?? l.kind}</span>
                {status(l.status, L.status[l.status as ListingStatus] ?? l.status)}
              </li>
            ))}
          </ul>
        ) : <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{tc('none')}</p>}
      </Section>

      <Section title={td('requests')} count={d.requestsTotal}>
        {d.marketRequests.length ? (
          <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
            {d.marketRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                {/* So'rov obyekt sahifasi yo'q: raqam bo'yicha bozor ro'yxati ochiladi */}
                <Link href={`/admin/market?q=${encodeURIComponent(r.no)}`} className="font-mono text-xs text-teal-ink hover:underline">{r.no}</Link>
                <span className="font-mono text-[11px] text-muted">{tm.has(`board.${r.board}`) ? tm(`board.${r.board}`) : r.board}</span>
                {status(r.status, tm.has(`status.${r.status}`) ? tm(`status.${r.status}`) : r.status)}
                <span className="ml-auto font-mono text-[11px] text-muted">{uzDate(r.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{tc('none')}</p>}
      </Section>

      <Section title={td('services')} count={d.serviceProfiles.length}>
        {d.serviceProfiles.length ? (
          <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
            {d.serviceProfiles.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="font-mono text-[11px] text-muted">{SERVICE_TYPE_LABELS[lang][p.serviceType as ServiceType] ?? p.serviceType}</span>
                {status(p.status, tm.has(`profileStatus.${p.status}`) ? tm(`profileStatus.${p.status}`) : p.status)}
              </li>
            ))}
          </ul>
        ) : <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{tc('none')}</p>}
      </Section>
    </div>
  );
}

/** Pul: obunalari, ochgan raqamlari, vagon qidiruvlari. Bezak emas: shikoyat yoki qaytarish so'rovida shu qaraladi. */
function Money({ d }: { d: Detail }) {
  const t = useTranslations('admin');
  const td = useTranslations('admin.users.detail');
  const ts = useTranslations('admin.subs');
  const to = useTranslations('admin.object');
  const locale = useLocale();
  const phone = d.phone?.replace(/\D/g, '') ?? '';
  return (
    <div className="space-y-6">
      <dl className={`${FACTS} sm:grid-cols-2`}>
        <Fact k={td('reveals')} v={num(d.reveals, locale)} mono />
        <Fact k={td('wagon')} v={`${num(d.wagonTotal, locale)} (${td('wagon30', { n: num(d.wagon30d, locale) })})`} mono />
      </dl>
      {/* Son yonida qaror matni: ochilgan raqam va qidiruv soni shikoyat yoki qaytarish so'rovida o'qiladi */}
      <p className="text-xs text-muted">{to('money.userHint')}</p>
      <Section title={td('subscriptions')} count={d.subscriptions.length}
        aside={phone && d.subscriptions.length ? <Link href={`/admin/subscriptions?q=${phone}`} className="font-semibold text-teal-ink hover:underline">{ts('openAll')}</Link> : null}>
        {!d.subscriptions.length ? <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{td('noSubs')}</p> : (
          <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
            {d.subscriptions.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/subscriptions?open=${s.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-sand/60">
                  <span className="font-mono text-xs font-bold">{s.no}</span>
                  {status(s.status, ts.has(`status.${s.status}`) ? ts(`status.${s.status}`) : s.status)}
                  <span className="font-mono text-[11px] text-muted">{s.grants.map((g) => (t.has(`plans.grant.${g}`) ? t(`plans.grant.${g}`) : g)).join(' + ')} / {ts('months')}: {s.months}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums">{som(s.amountTiyin, locale)}</span>
                  {s.endsAt ? <span className="w-full font-mono text-[11px] text-muted sm:w-auto">{ts('endsAt')}: {uzDate(s.endsAt, locale)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
