'use client';
// Xizmat profili formasi: yaratish (tur tanlanadi) yoki tahrirlash (tur o'zgarmaydi).
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { REGIONS, SERVICE_TYPES, type ServiceType } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import type { FieldErrors, ServiceProfileCard } from '@/lib/types-market';
import { PhoneField } from '@/components/ui/fields';
import { BTN_GHOST, BTN_PRIMARY, CHIP, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { PhotoUpload } from '@/components/kabinet/PhotoUpload';
import { useMarketLabels } from './bits';

type Draft = { serviceType: string; title: string; description: string; regions: string[]; experienceYears: string; priceNote: string; contactPhone: string; photos: string[] };

export function ProfileForm({ initial, taken, onSaved, onCancel }: { initial?: ServiceProfileCard | null; taken: string[]; onSaved: (p: ServiceProfileCard) => void; onCancel: () => void }) {
  const t = useTranslations('market.dash.profile');
  const te = useTranslations('market.err');
  const L = useMarketLabels();
  // Yaratishda hali band bo'lmagan birinchi tur tanlanadi
  const free = SERVICE_TYPES.filter((x) => !taken.includes(x));
  const [d, setD] = useState<Draft>({
    serviceType: initial?.serviceType ?? free[0] ?? '', title: initial?.title ?? '', description: initial?.description ?? '', regions: initial?.regions ?? [],
    experienceYears: initial?.experienceYears != null ? String(initial.experienceYears) : '', priceNote: initial?.priceNote ?? '', contactPhone: initial?.contactPhone ?? '',
    photos: initial?.photos ?? [],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const err = (k: string) => (errors[k] ? te(errors[k]!) : undefined);
  const toggle = (r: string) => set({ regions: d.regions.includes(r) ? d.regions.filter((x) => x !== r) : [...d.regions, r] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setTop(null); setErrors({});
    const local: FieldErrors = { ...(d.title.trim() ? {} : { title: 'REQUIRED' }), ...(d.description.trim() ? {} : { description: 'REQUIRED' }) };
    if (Object.keys(local).length) { setErrors(local); setBusy(false); return; }
    const body = {
      title: d.title.trim(), description: d.description.trim(), regions: d.regions,
      experienceYears: d.experienceYears === '' ? null : Number(d.experienceYears), priceNote: d.priceNote, contactPhone: d.contactPhone,
      photos: d.photos,
    };
    try {
      const saved = initial
        ? await api<ServiceProfileCard>(`/services/profiles/${initial.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await post<ServiceProfileCard>('/services/profiles', { ...body, serviceType: d.serviceType });
      onSaved(saved);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.body?.code ?? '') : '';
      if (code === 'VALIDATION' && e instanceof ApiError && e.body?.errors) setErrors(e.body.errors as FieldErrors);
      else setTop(code === 'PROFILE_EXISTS' ? t('PROFILE_EXISTS') : code === 'RATE_LIMITED' ? te('RATE_LIMITED') : te('generic'));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-card border border-line bg-white p-5">
      <Field label={t('serviceType')} required>
        <select className={INPUT} value={d.serviceType} disabled={!!initial} onChange={(e) => set({ serviceType: e.target.value })}>
          {(initial ? SERVICE_TYPES : free).map((x) => <option key={x} value={x}>{L.service[x as ServiceType]}</option>)}
        </select>
      </Field>
      <Field label={t('title')} required error={err('title')}><input className={INPUT} maxLength={120} placeholder={t('titlePh')} value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label={t('description')} required error={err('description')}><textarea className={INPUT} rows={5} maxLength={2000} placeholder={t('descriptionPh')} value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label={t('regions')} hint={t('regionsHint')} group>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={d.regions.includes(r)} className={CHIP(d.regions.includes(r))}>{L.region(r)}</button>)}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('experience')} error={err('experienceYears')}><input className={`${INPUT} font-mono`} type="number" min={0} max={60} inputMode="numeric" value={d.experienceYears} onChange={(e) => set({ experienceYears: e.target.value })} /></Field>
        <Field label={t('priceNote')} error={err('priceNote')} className="sm:col-span-2"><input className={INPUT} maxLength={120} placeholder={t('priceNotePh')} value={d.priceNote} onChange={(e) => set({ priceNote: e.target.value })} /></Field>
      </div>
      <Field label={t('phone')} hint={t('phoneHint')} error={err('contactPhone')}><PhoneField className={`${INPUT} font-mono`} value={d.contactPhone} onChange={(contactPhone) => set({ contactPhone })} /></Field>
      {/* Surat: guvohnoma, ofis, ish namunasi. Ishonch uchun, bezak uchun emas */}
      <Field label={t('photos')} hint={t('photosHint')} error={err('photos')} group><PhotoUpload photos={d.photos} onChange={(photos) => set({ photos })} /></Field>
      {top ? <Notice tone="err">{top}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? t('saving') : t('save')}</button>
        <button type="button" onClick={onCancel} className={BTN_GHOST}>{t('cancel')}</button>
      </div>
    </form>
  );
}
