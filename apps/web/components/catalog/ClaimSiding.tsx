'use client';
// "Egasi bo'lsangiz da'vo qiling": tashkilot tanlanadi va POST /sidings/:id/claim yuboriladi. Faqat kirganlarga chiziladi.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { AttachmentButton, AttachmentChips, useAttachments } from '@/components/chat/Attachments';

type Org = { orgId: string; org: { name: string } };

export function ClaimSiding({ sidingId }: { sidingId: string }) {
  const t = useTranslations('claim');
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'already' | 'err'>('idle');
  const at = useAttachments();
  const [note, setNote] = useState('');
  // Moderator "meniki" degan gapni nimaga qarab tekshirishini bilishi kerak
  const tooShort = note.trim().length < 10;

  useEffect(() => {
    api<Org[]>('/orgs/mine').then((o) => { setOrgs(o); setOrgId(o[0]?.orgId ?? ''); }).catch(() => setOrgs([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      await post(`/sidings/${sidingId}/claim`, { ...(orgId ? { orgId } : {}), note: note.trim(), files: at.files });
      setState('sent');
    } catch (err: any) { setState(err?.body?.code === 'SIDING_ALREADY_CLAIMED' ? 'already' : 'err'); }
  }

  if (!orgs) return <p className="text-sm text-muted">...</p>;
  if (state === 'sent') return <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{t('sent')}</p>;
  return (
    <form onSubmit={submit} className="space-y-2">
      {orgs.length ? (
        <>
          <label className="block text-xs text-muted" htmlFor="claim-org">{t('org')}</label>
          <select id="claim-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
            {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.org.name}</option>)}
          </select>
        </>
      ) : <p className="text-xs text-muted">{t('noOrgAuto')}</p>}
      <label className="block text-xs text-muted" htmlFor="claim-why">{t('why')}</label>
      <textarea id="claim-why" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} required
        placeholder={t('whyPlaceholder')} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
      {note.length > 0 && tooShort ? <p className="text-xs text-amber-ink">{t('whyShort')}</p> : null}

      <p className="text-xs text-muted"><span className="font-semibold text-ink">{t('docs')}.</span> {t('docsHint')}</p>
      <AttachmentChips files={at.files} onRemove={at.remove} />
      <AttachmentButton busy={at.busy} disabled={state === 'busy'} onPick={at.add} />
      {at.err ? <p role="alert" className="text-xs text-amber-ink">{at.err}</p> : null}

      <button disabled={state === 'busy' || at.busy > 0 || tooShort} className="w-full rounded-full bg-navy px-6 py-3 font-semibold text-white transition hover:bg-navy-2 disabled:opacity-60">{state === 'busy' ? t('sending') : t('submit')}</button>
      {state === 'already' ? <p className="text-xs text-amber-ink">{t('already')}</p> : state === 'err' ? <p className="text-xs text-amber-ink">{t('err')}</p> : null}
    </form>
  );
}
