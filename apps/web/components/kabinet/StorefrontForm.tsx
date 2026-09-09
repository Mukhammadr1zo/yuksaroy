'use client';
// Do'kon sozlamalari (Organization.storefront): PATCH /orgs/:id/storefront. Bo'sh rasm URL null bo'lib ketadi (o'chirish uchun, DTO '' ni qabul qilmaydi).
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Storefront } from '@/lib/types-urgent';
import { BTN_GHOST, BTN_NAVY, Field, INPUT, Notice } from './bits';
import { PhotoUpload } from './PhotoUpload';

type Draft = { tagline: string; about: string; logoUrl: string; coverUrl: string; showListings: boolean; showTerminals: boolean; contactTelegram: string; contactPhonePublic: boolean };
type Flag = 'showListings' | 'showTerminals' | 'contactPhonePublic';
const fromStore = (s: Storefront | null): Draft => ({
  tagline: s?.tagline ?? '', about: s?.about ?? '', logoUrl: s?.logoUrl ?? '', coverUrl: s?.coverUrl ?? '',
  showListings: s?.showListings ?? true, showTerminals: s?.showTerminals ?? true, contactTelegram: s?.contactTelegram ?? '', contactPhonePublic: s?.contactPhonePublic ?? false,
});

export function StorefrontForm({ orgId, slug, initial, disabled, onSaved }: { orgId: string; slug: string | null; initial: Storefront | null; disabled?: boolean; onSaved: () => void }) {
  const t = useTranslations('storefront');
  const tc = useTranslations('kabinet.common');
  const [d, setD] = useState<Draft>(() => fromStore(initial));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNote(null);
    try {
      const body = { ...d, tagline: d.tagline.trim(), about: d.about.trim(), contactTelegram: d.contactTelegram.trim().replace(/^@/, ''), logoUrl: d.logoUrl || null, coverUrl: d.coverUrl || null };
      await api(`/orgs/${orgId}/storefront`, { method: 'PATCH', body: JSON.stringify(body) });
      setNote({ tone: 'ok', text: tc('saved') }); onSaved();
    } catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(false); }
  }

  const flag = (k: Flag, label: string, hint?: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1 accent-teal" checked={d[k]} disabled={disabled} onChange={(e) => set({ [k]: e.target.checked })} />
      <span><span className="font-semibold">{label}</span>{hint ? <span className="block text-xs text-muted">{hint}</span> : null}</span>
    </label>
  );

  return (
    <form onSubmit={save} className="mt-4 space-y-4">
      <p className="text-sm text-muted">{t('lead')}</p>
      <p className="font-mono text-xs text-muted">
        {t('address')}: {slug ? <Link href={`/k/${slug}`} target="_blank" className="text-navy underline decoration-dotted hover:text-teal-ink">/k/{slug}</Link> : t('noSlug')}
      </p>
      <Field label={t('field.tagline')} hint={t('hint.tagline')}>
        <input className={INPUT} maxLength={160} value={d.tagline} disabled={disabled} onChange={(e) => set({ tagline: e.target.value })} />
      </Field>
      <Field label={t('field.about')}>
        <textarea className={`${INPUT} min-h-32`} maxLength={4000} value={d.about} disabled={disabled} onChange={(e) => set({ about: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field group label={t('field.logo')} hint={t('hint.logo')}>
          <PhotoUpload photos={d.logoUrl ? [d.logoUrl] : []} max={1} onChange={(p) => set({ logoUrl: p[0] ?? '' })} />
        </Field>
        <Field group label={t('field.cover')} hint={t('hint.cover')}>
          <PhotoUpload photos={d.coverUrl ? [d.coverUrl] : []} max={1} onChange={(p) => set({ coverUrl: p[0] ?? '' })} />
        </Field>
      </div>
      <Field label={t('field.contactTelegram')} hint={t('hint.telegram')}>
        <input className={INPUT} maxLength={80} value={d.contactTelegram} disabled={disabled} onChange={(e) => set({ contactTelegram: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        {flag('showTerminals', t('field.showTerminals'))}
        {flag('showListings', t('field.showListings'))}
        {flag('contactPhonePublic', t('field.contactPhonePublic'), t('hint.phonePublic'))}
      </div>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className={BTN_NAVY}>{busy ? tc('saving') : tc('save')}</button>
          {slug ? <Link href={`/k/${slug}`} target="_blank" className={BTN_GHOST}>{t('preview')}</Link> : null}
        </div>
      ) : null}
    </form>
  );
}
