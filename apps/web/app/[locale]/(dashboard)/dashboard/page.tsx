'use client';
// "Hozir": kabinetning bosh sahifasi. Ilgari bu yerda ism, chiqish tugmasi va plitkalar bor edi;
// endi bitta savolga javob beradi: mendan nima kutilyapti. Bo'sh bo'lsa keyingi qadam taklif qilinadi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { uzDate } from '@/lib/format';
import type { Inquiry, Membership, OwnerListing } from '@/lib/types-kabinet';
import type { MineDocs } from '@/lib/types-dashboard';
import { useMe } from '@/components/site/useMe';

type Summary = { terminals: number; byStatus: Record<string, number> };
type Task = { key: string; count?: number; href: string; tone?: 'warn' };

const WEEK = 7 * 86_400_000;

export default function NowPage() {
  const t = useTranslations('kabinet.now');
  const tc = useTranslations('kabinet.common');
  const locale = useLocale();
  const me = useMe();
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      const [ms, inq, docs, listings] = await Promise.all([
        api<Membership[]>('/orgs/mine').catch(() => [] as Membership[]),
        api<Inquiry[]>('/inquiries?scope=owner').catch(() => [] as Inquiry[]),
        api<MineDocs>('/documents/mine?scope=client&limit=100').catch(() => ({ items: [], total: 0, page: 1, limit: 0 }) as MineDocs),
        api<{ items: OwnerListing[] }>('/listings/mine').catch(() => ({ items: [] })),
      ]);
      if (!alive) return;
      setOrgs(ms);
      const isTerminal = ms.some((m) => (m.org.kinds?.length ? m.org.kinds : [m.org.kind]).includes('TERMINAL'));
      const pending = isTerminal ? await api<Summary>('/orders/summary').then((s) => s.byStatus?.PENDING ?? 0).catch(() => 0) : 0;
      if (!alive) return;

      const now = Date.now();
      const list: Task[] = [];
      if (pending) list.push({ key: 'ordersToConfirm', count: pending, href: '/dashboard/orders', tone: 'warn' });
      const open = inq.filter((i) => i.status === 'OPEN').length;
      if (open) list.push({ key: 'inquiries', count: open, href: '/dashboard/inquiries' });
      const unpaid = docs.items.filter((d) => d.kind === 'INVOICE' && (d.status === 'ISSUED' || d.status === 'OVERDUE')).length;
      if (unpaid) list.push({ key: 'invoices', count: unpaid, href: '/dashboard/documents' });
      const expiring = listings.items.filter((l) => l.status === 'ACTIVE' && l.expiresAt && new Date(l.expiresAt).getTime() - now < WEEK).length;
      if (expiring) list.push({ key: 'expiring', count: expiring, href: '/dashboard/objects' });
      const drafts = listings.items.filter((l) => l.status === 'DRAFT').length;
      if (drafts) list.push({ key: 'drafts', count: drafts, href: '/dashboard/objects' });
      if (me.phone === null) list.push({ key: 'phone', href: '/login?attach=1&next=/dashboard', tone: 'warn' });
      if (ms.some((m) => m.isOwner && !m.org.stir)) list.push({ key: 'stir', href: '/dashboard/organization' });
      setTasks(list);
    })();
    return () => { alive = false; };
  }, [me]);

  if (me === undefined) return <p className="text-sm text-muted">{tc('loading')}</p>;
  if (me === null) return <p className="text-sm text-muted">{tc('loading')}</p>;

  const since = me.createdAt ? uzDate(me.createdAt, locale) : null;
  return (
    <>
      <h1 className="font-display text-2xl font-bold">{t('hello', { name: me.fullName?.split(/\s+/)[0] || t('friend') })}</h1>
      <p className="mt-1 text-sm text-muted">{tasks === null ? tc('loading') : tasks.length ? t('lead') : t('leadClear')}</p>

      {tasks && tasks.length ? (
        <ul className="mt-5 space-y-2">
          {tasks.map((x) => (
            <li key={x.key}>
              <Link href={x.href} className={`flex items-center gap-3 rounded-card border bg-white p-4 transition-colors duration-150 hover:border-teal ${x.tone === 'warn' ? 'border-amber/50' : 'border-line'}`}>
                {x.count ? <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-mono text-sm font-bold ${x.tone === 'warn' ? 'bg-amber-soft text-amber-ink' : 'bg-teal-soft text-teal-ink'}`}>{x.count}</span> : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(`task.${x.key}.title`, { count: x.count ?? 0 })}</span>
                  <span className="block text-sm text-muted">{t(`task.${x.key}.body`)}</span>
                </span>
                <ArrowRightIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {tasks && tasks.length === 0 ? (
        <div className="mt-5 rounded-card border border-dashed border-line bg-white p-8 text-center">
          <p className="font-semibold">{t('clear.title')}</p>
          <p className="mt-1 text-sm text-muted">{t('clear.body')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/terminals" className="rounded-full border border-line px-5 py-2 text-sm font-semibold hover:border-teal">{t('clear.browse')}</Link>
            <Link href="/dashboard/objects" className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-ink">{t('clear.objects')}</Link>
          </div>
        </div>
      ) : null}

      {orgs && orgs.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-white p-4 text-sm text-muted">
          {t('noOrg')} <Link href="/dashboard/organization" className="font-semibold text-teal-ink underline">{t('noOrgCta')}</Link>
        </p>
      ) : null}
      {since ? <p className="mt-6 font-mono text-xs text-muted">{t('since', { date: since })}</p> : null}
    </>
  );
}
