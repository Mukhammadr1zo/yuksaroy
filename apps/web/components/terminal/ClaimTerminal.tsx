'use client';
// "Bu sizning terminalingizmi?": TERMINAL turidagi tashkilot tanlanadi va POST /terminals/:id/claim yuboriladi. Faqat kirganlarga chiziladi.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import type { Membership } from '@/lib/types-kabinet';

const isTerminalOrg = (m: Membership) => (m.org.kinds?.length ? m.org.kinds : [m.org.kind]).includes('TERMINAL');

export function ClaimTerminal({ terminalId }: { terminalId: string }) {
  const t = useTranslations('terminalsAdmin.claim');
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'already' | 'forbidden' | 'err'>('idle');

  useEffect(() => {
    api<Membership[]>('/orgs/mine').then((ms) => { const ts = ms.filter(isTerminalOrg); setOrgs(ts); setOrgId(ts[0]?.orgId ?? ''); }).catch(() => setOrgs([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    try { await post(`/terminals/${terminalId}/claim`, { orgId }); setState('sent'); }
    catch (err) {
      const code = err instanceof ApiError ? String(err.body?.code ?? '') : '';
      setState(code === 'TERMINAL_CLAIMED' ? 'already' : code === 'NOT_TERMINAL_ADMIN' ? 'forbidden' : 'err');
    }
  }

  if (!orgs) return <p className="text-sm text-muted">...</p>;
  if (!orgs.length) return <p className="text-sm">{t('noOrg')} <Link href="/dashboard/organization" className="font-semibold text-navy underline">{t('toOrg')}</Link></p>;
  if (state === 'sent') return <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{t('sent')}</p>;
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="block min-w-56 flex-1 text-xs text-muted">{t('org')}
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink">
          {orgs.map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
        </select>
      </label>
      <button disabled={state === 'busy'} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-2 disabled:opacity-60">{state === 'busy' ? t('sending') : t('submit')}</button>
      {state === 'already' || state === 'forbidden' || state === 'err' ? <p role="alert" className="basis-full text-xs font-semibold text-amber-ink">{t(state)}</p> : null}
    </form>
  );
}
