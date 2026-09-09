'use client';
// Kabinet bosh sahifasi: profil, telefon bog'lash eslatmasi (Google orqali kirganlar), rolga mos plitkalar (faqat API sonlari) va tashkilotlar.
// Tashkilot yaratish va tahrirlash /dashboard/organization da.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som } from '@/lib/format';
import type { OrderCard, Page } from '@/lib/types';
import type { Me, Membership, MySiding, OrgRecord, OwnerListing, Inquiry } from '@/lib/types-kabinet';
import type { MineDocs, MyTerminalRow } from '@/lib/types-dashboard';
import { slotLabel } from '@/components/order/bits';
import { useLang } from '@/components/kabinet/bits';
import { KYC_STATUS_LABELS, ORG_KIND_LABELS, type OrgKind } from '@yuksaroy/domain';

export default function KabinetPage() {
  const router = useRouter();
  const t = useTranslations('kabinet');
  const lang = useLang();
  const [me, setMe] = useState<Me | null>(null);
  const [orgs, setOrgs] = useState<Membership[]>([]);

  useEffect(() => {
    Promise.all([api<Me>('/auth/me'), api<Membership[]>('/orgs/mine')])
      .then(([m, os]) => { setMe(m); setOrgs(os); })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!me) return <main className="p-8 text-muted">{t('common.loading')}</main>;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">{me.fullName || t('home.title')}</h1>
          <p className="truncate font-mono text-sm text-muted">
            {me.phone ?? me.email ?? t('home.noPhone')} · {me.telegramLinked ? t('home.telegramLinked') : t('home.telegramNot')}
          </p>
        </div>
        <button onClick={async () => { await post('/auth/logout', {}); router.replace('/'); }} className="shrink-0 text-sm text-muted underline hover:text-ink">{t('home.logout')}</button>
      </header>

      {me.phone === null ? (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/30 bg-amber-soft px-5 py-4">
          <div>
            <p className="font-semibold text-amber-ink">{t('home.phoneBanner.title')}</p>
            <p className="mt-0.5 text-sm text-amber-ink/80">{t('home.phoneBanner.body')}</p>
          </div>
          <Link href="/login?attach=1&next=/dashboard" className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white transition hover:bg-navy-2">{t('home.phoneBanner.cta')}</Link>
        </section>
      ) : null}

      <Tiles me={me} orgs={orgs} />

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t('home.orgs')}</h2>
          <Link href="/dashboard/organization" className="text-sm font-semibold text-teal-ink underline">{orgs.length ? t('home.manageOrgs') : t('home.createOrg')}</Link>
        </div>
        {orgs.length === 0 ? <p className="mt-2 text-sm text-muted">{t('home.noOrgs')}</p> : null}
        <ul className="mt-3 space-y-2">
          {orgs.map((m) => {
            const kinds = m.org.kinds?.length ? m.org.kinds : [m.org.kind];
            return (
              <li key={m.orgId} className="rounded-card border border-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.org.name}</span>
                  {kinds.map((k) => <span key={k} className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{ORG_KIND_LABELS[lang][k]}</span>)}
                </div>
                <p className="mt-1 font-mono text-xs text-muted">
                  STIR {m.org.stir ?? '·'} · KYC {KYC_STATUS_LABELS[lang][m.org.kycStatus]} · {t('home.roles')}: {m.roles.join(', ')}{m.isOwner ? ` · ${t('home.owner')}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

// ── Plitkalar: har son bitta qarorga xizmat qiladi va faqat API dan keladi ──

const SHIPPER: OrgKind[] = ['SHIPPER', 'FORWARDER', 'DECLARANT'];
const LISTER: OrgKind[] = ['ASSET_OWNER', 'LOCO_SERVICE', 'CARRIER'];

function Tiles({ me, orgs }: { me: Me; orgs: Membership[] }) {
  const t = useTranslations('dashboard2.home');
  const kinds = new Set(orgs.flatMap((m) => (m.org.kinds?.length ? m.org.kinds : [m.org.kind])));
  const isTerminal = kinds.has('TERMINAL');
  const isLister = LISTER.some((k) => kinds.has(k)) || me.personalRoles.length > 0;
  // Tashkiloti yo'q yangi foydalanuvchi mijoz ko'rinishini oladi: buyurtma asosiy yo'l
  const isShipper = SHIPPER.some((k) => kinds.has(k)) || (!isTerminal && !isLister);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isTerminal ? <TerminalTiles /> : null}
        {isShipper ? <ShipperTiles /> : null}
        {isLister ? <ListerTiles /> : null}
      </div>
      {me.isPlatformAdmin ? <AdminTiles /> : null}
    </section>
  );
}

/** value: undefined yuklanmoqda, null xato, son yoki matn tayyor. */
function Tile({ label, value, sub, href, warn }: { label: string; value: number | string | null | undefined; sub?: string; href: string; warn?: boolean }) {
  const t = useTranslations('dashboard2.home');
  const cls = warn ? 'border-amber/40 bg-amber-soft hover:border-amber' : 'border-line bg-white hover:border-teal';
  return (
    <Link href={href} className={`block rounded-card border p-4 transition ${cls}`}>
      <p className={`text-sm font-semibold ${warn ? 'text-amber-ink' : 'text-muted'}`}>{label}</p>
      <p className={`mt-1 tabular-nums ${typeof value === 'number' ? 'font-display text-3xl font-bold' : 'font-mono text-lg font-semibold'}`} aria-busy={value === undefined}>
        {value === undefined ? <span className="inline-block h-8 w-14 animate-pulse rounded bg-line align-middle" /> : value === null ? <span className="text-base font-normal text-muted">{t('unknown')}</span> : value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </Link>
  );
}

const OPEN = 'PENDING,CONFIRMED,IN_PROGRESS';

function ShipperTiles() {
  const t = useTranslations('dashboard2.home.shipper');
  const [orders, setOrders] = useState<Page<OrderCard> | null | undefined>();
  const [docs, setDocs] = useState<MineDocs | null | undefined>();
  useEffect(() => {
    api<Page<OrderCard>>(`/orders?scope=client&status=${OPEN}&limit=50`).then(setOrders).catch(() => setOrders(null));
    api<MineDocs>('/documents/mine?scope=client&limit=100').then(setDocs).catch(() => setDocs(null));
  }, []);
  const now = Date.now();
  const next = orders?.items.filter((o) => o.slot && new Date(o.slot.startsAt).getTime() > now).sort((a, b) => a.slot!.startsAt.localeCompare(b.slot!.startsAt))[0];
  const due = docs?.items.filter((d) => d.kind === 'INVOICE' && (d.status === 'ISSUED' || d.status === 'OVERDUE'));
  const dueSum = due?.reduce((a, d) => a + d.amountTiyin, 0) ?? 0;
  return (
    <>
      <Tile label={t('open')} value={orders === undefined ? undefined : orders === null ? null : orders.total} sub={orders ? t('openSub', { n: orders.items.filter((o) => o.status === 'PENDING').length }) : undefined} href="/dashboard/orders" />
      <Tile
        label={t('next')} href={next ? `/dashboard/orders/${next.no}` : '/dashboard/orders/new'}
        value={orders === undefined ? undefined : orders === null ? null : next ? slotLabel(next.slot!.startsAt, next.slot!.endsAt) : t('noNext')}
        sub={next ? `${next.no} · ${next.terminal.name}` : orders ? t('newOrder') : undefined}
      />
      <Tile label={t('invoices')} value={docs === undefined ? undefined : docs === null ? null : due!.length} sub={due ? (due.length ? t('invoicesSub', { sum: som(dueSum) }) : t('noInvoices')) : undefined} href="/dashboard/documents" />
    </>
  );
}

function TerminalTiles() {
  const t = useTranslations('dashboard2.home.terminal');
  const [pending, setPending] = useState<number | null | undefined>();
  const [terms, setTerms] = useState<MyTerminalRow[] | null | undefined>();
  useEffect(() => {
    api<{ terminals: number; byStatus: Record<string, number> }>('/orders/summary').then((s) => setPending(s.byStatus.PENDING ?? 0)).catch(() => setPending(null));
    api<MyTerminalRow[]>('/terminals/mine').then(setTerms).catch(() => setTerms(null));
  }, []);
  const free = terms?.reduce((a, x) => a + (x.freeToday ?? 0), 0);
  const noTariff = terms?.filter((x) => !x.tariffs?.length).length;
  return (
    <>
      <Tile label={t('pending')} value={pending} sub={pending ? t('pendingSub') : undefined} href="/dashboard/terminal" warn={!!pending} />
      <Tile label={t('free')} value={terms === undefined ? undefined : terms === null ? null : free} sub={terms ? t('freeSub', { n: terms.length }) : undefined} href="/dashboard/terminals" />
      <Tile label={t('noTariff')} value={terms === undefined ? undefined : terms === null ? null : noTariff} sub={terms ? (noTariff ? t('noTariffSub') : t('allTariffs')) : undefined} href="/dashboard/terminals" warn={!!noTariff} />
    </>
  );
}

function ListerTiles() {
  const t = useTranslations('dashboard2.home.lister');
  const [listings, setListings] = useState<OwnerListing[] | null | undefined>();
  const [inq, setInq] = useState<Inquiry[] | null | undefined>();
  useEffect(() => {
    api<OwnerListing[]>('/listings/mine').then(setListings).catch(() => setListings(null));
    api<Inquiry[]>('/inquiries?scope=owner').then(setInq).catch(() => setInq(null));
  }, []);
  const count = (s: string) => listings?.filter((l) => l.status === s).length ?? 0;
  return (
    <>
      <Tile label={t('active')} value={listings === undefined ? undefined : listings === null ? null : count('ACTIVE')} sub={listings ? t('activeSub', { n: count('PENDING_REVIEW') }) : undefined} href="/dashboard/listings" />
      <Tile label={t('inquiries')} value={inq === undefined ? undefined : inq === null ? null : inq.filter((i) => i.status === 'OPEN').length} sub={inq ? t('inquiriesSub') : undefined} href="/dashboard/inquiries" />
    </>
  );
}

function AdminTiles() {
  const t = useTranslations('dashboard2.home.admin');
  const [n, setN] = useState<Record<string, number | null | undefined>>({});
  useEffect(() => {
    const set = (k: string) => (v: number) => setN((x) => ({ ...x, [k]: v }));
    const fail = (k: string) => () => setN((x) => ({ ...x, [k]: null }));
    api<OwnerListing[]>('/admin/listings?status=PENDING_REVIEW').then((r) => set('listings')(r.length)).catch(fail('listings'));
    api<OrgRecord[]>('/admin/orgs?kyc=PENDING').then((r) => set('kyc')(r.length)).catch(fail('kyc'));
    api<{ items: MySiding[] }>('/admin/sidings?claim=PENDING').then((r) => set('sidings')(r.items.length)).catch(fail('sidings'));
    api<unknown[]>('/admin/terminals?claim=PENDING').then((r) => set('terminals')(r.length)).catch(fail('terminals'));
  }, []);
  return (
    <>
      <h3 className="mt-6 text-sm font-semibold text-muted">{t('title')}</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['listings', 'kyc', 'sidings', 'terminals'] as const).map((k) => <Tile key={k} label={t(k)} value={n[k]} href="/dashboard/admin" warn={!!n[k]} />)}
      </div>
    </>
  );
}
