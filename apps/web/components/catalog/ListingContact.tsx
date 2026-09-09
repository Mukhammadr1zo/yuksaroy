'use client';
// Kirgan foydalanuvchi uchun: egasining telefoni va "Narx so'rash" formasi. Server komponent cookie bo'lsa shuni chizadi.
// Telefon brauzerdan olinadi: server fetch cookie yubormaydi, muddati o'tgan access esa /auth/me orqali yangilanadi (lib/api).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PhoneIcon } from '@phosphor-icons/react';
import { api, post } from '@/lib/api';

type Org = { orgId: string; org: { name: string } };

export function ListingContact({ slug, listingId }: { slug: string; listingId: string }) {
  const t = useTranslations('listing.detail');
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [orgId, setOrgId] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'err' | 'short'>('idle');

  useEffect(() => {
    (async () => {
      await api('/auth/me').catch(() => null);
      const [d, o] = await Promise.all([api<{ contactPhone: string | null }>(`/listings/${slug}`).catch(() => null), api<Org[]>('/orgs/mine').catch(() => [] as Org[])]);
      setPhone(d?.contactPhone ?? null);
      setOrgs(o);
      setOrgId(o[0]?.orgId ?? '');
    })();
  }, [slug]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (msg.trim().length < 5) return setState('short');
    setState('busy');
    try {
      await post(`/listings/${listingId}/inquiries`, { message: msg.trim(), orgId: orgId || undefined });
      setState('sent');
    } catch { setState('err'); }
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-mono text-sm">
        <PhoneIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
        {phone === undefined ? <span className="text-muted">{t('loading')}</span>
          : phone ? <a href={`tel:${phone}`} className="font-semibold text-navy hover:text-teal-ink">{phone}</a>
          : <span className="text-muted">{t('noPhone')}</span>}
      </p>
      {state === 'sent' ? <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{t('inquiry.sent')}</p> : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="w-full rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('ask')}</button>
      ) : (
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
      )}
    </div>
  );
}
