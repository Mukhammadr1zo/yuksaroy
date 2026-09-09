'use client';
// "Egasi bo'lsangiz da'vo qiling": tashkilot tanlanadi va POST /sidings/:id/claim yuboriladi. Faqat kirganlarga chiziladi.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';

type Org = { orgId: string; org: { name: string } };

export function ClaimSiding({ sidingId }: { sidingId: string }) {
  const t = useTranslations('claim');
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'already' | 'err'>('idle');

  useEffect(() => {
    api<Org[]>('/orgs/mine').then((o) => { setOrgs(o); setOrgId(o[0]?.orgId ?? ''); }).catch(() => setOrgs([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      await post(`/sidings/${sidingId}/claim`, { orgId });
      setState('sent');
    } catch (err: any) { setState(err?.body?.code === 'SIDING_ALREADY_CLAIMED' ? 'already' : 'err'); }
  }

  if (!orgs) return <p className="text-sm text-muted">...</p>;
  if (!orgs.length) return <p className="text-sm text-muted">{t('noOrg')} <Link href="/dashboard/organization" className="font-semibold text-teal-ink underline">{t('toOrg')}</Link></p>;
  if (state === 'sent') return <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{t('sent')}</p>;
  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-xs text-muted" htmlFor="claim-org">{t('org')}</label>
      <select id="claim-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
        {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.org.name}</option>)}
      </select>
      <button disabled={state === 'busy'} className="w-full rounded-full bg-navy px-6 py-3 font-semibold text-white transition hover:bg-navy-2 disabled:opacity-60">{state === 'busy' ? t('sending') : t('submit')}</button>
      {state === 'already' ? <p className="text-xs text-amber-ink">{t('already')}</p> : state === 'err' ? <p className="text-xs text-amber-ink">{t('err')}</p> : null}
    </form>
  );
}
