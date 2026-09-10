'use client';
// So'rov yuborish: kirish talab qilinadi (telefon esa hammaga ochiq, PhoneLink da).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, hasSession, post } from '@/lib/api';
import { Link } from '@/i18n/navigation';

type Org = { orgId: string; org: { name: string } };

export function ListingContact({ listingId, next }: { listingId: string; next: string }) {
  const t = useTranslations('listing.detail');
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [orgId, setOrgId] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'err' | 'short'>('idle');

  useEffect(() => {
    (async () => {
      if (!hasSession()) return setAuthed(false);
      const me = await api('/auth/me').catch(() => null);
      setAuthed(me !== null);
      if (!me) return;
      const o = await api<Org[]>('/orgs/mine').catch(() => [] as Org[]);
      setOrgs(o);
      setOrgId(o[0]?.orgId ?? '');
    })();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (msg.trim().length < 5) return setState('short');
    setState('busy');
    try {
      await post(`/listings/${listingId}/inquiries`, { message: msg.trim(), orgId: orgId || undefined });
      setState('sent');
    } catch { setState('err'); }
  }

  if (authed === undefined) return <p className="text-sm text-muted">{t('loading')}</p>;
  if (!authed) {
    return (
      <>
        <Link href={`/login?next=${next}`} className="block rounded-full bg-teal px-6 py-3 text-center font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('ask')}</Link>
        <p className="mt-2 text-xs text-muted">{t('loginToContact')}. {t('loginNote')}</p>
      </>
    );
  }
  if (state === 'sent') return <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{t('inquiry.sent')}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="w-full rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('ask')}</button>;
  return (
    <form onSubmit={send} className="space-y-2">
      <label className="block text-xs text-muted" htmlFor="inq-msg">{t('inquiry.label')}</label>
      <textarea id="inq-msg" value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={1000} placeholder={t('inquiry.placeholder')} className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25" />
      {orgs.length ? (
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label={t('inquiry.org')} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">{t('inquiry.personal')}</option>
          {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.org.name}</option>)}
        </select>
      ) : null}
      <button disabled={state === 'busy'} className="w-full rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink disabled:opacity-60">{state === 'busy' ? t('inquiry.sending') : t('inquiry.send')}</button>
      {state === 'err' ? <p className="text-xs text-amber-ink">{t('inquiry.err')}</p> : state === 'short' ? <p className="text-xs text-amber-ink">{t('inquiry.short')}</p> : null}
    </form>
  );
}
