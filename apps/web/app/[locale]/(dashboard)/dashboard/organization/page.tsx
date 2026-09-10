'use client';
// Tashkilot: mening tashkilotlarim (egasi tahrirlaydi, a'zo ko'radi), KYC so'rovi, a'zo qo'shish, yangi tashkilot.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { KYC_STATUS_LABELS, ORG_KINDS, ORG_KIND_ROLES, REGIONS, type KycStatus, type OrgKind, type Role } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import type { Membership, OrgRecord } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_NAVY, BTN_PRIMARY, CHIP, Field, INPUT, Notice, errText, useLang } from '@/components/kabinet/bits';
import { StorefrontForm } from '@/components/kabinet/StorefrontForm';
import { PhoneField, phoneDisplay } from '@/components/ui/fields';

const KINDS = ORG_KINDS.filter((k) => k !== 'PLATFORM');
const KYC_TONE: Record<KycStatus, string> = { NONE: 'bg-line text-ink/70', PENDING: 'bg-amber-soft text-amber-ink', VERIFIED: 'bg-teal text-white', REJECTED: 'bg-red-50 text-red-700' };

type Draft = { name: string; kinds: OrgKind[]; description: string; telegram: string; website: string; phone: string; address: string; regionCode: string; stir: string };
const EMPTY: Draft = { name: '', kinds: [], description: '', telegram: '', website: '', phone: '', address: '', regionCode: '', stir: '' };
const fromOrg = (o: OrgRecord): Draft => ({
  name: o.name, kinds: o.kinds?.length ? o.kinds : [o.kind], description: o.description ?? '', telegram: o.telegram ?? '', website: o.website ?? '',
  phone: o.phone ?? '', address: o.address ?? '', regionCode: o.regionCode ?? '', stir: o.stir ?? '',
});
/** Bo'sh STIR va viloyat yuborilmaydi (DTO ularni tekshiradi), qolganlari tozalash uchun bo'sh ketadi. */
const toBody = (d: Draft) => ({ ...d, name: d.name.trim(), stir: d.stir || undefined, regionCode: d.regionCode || undefined });

export default function OrgPage() {
  const t = useTranslations('kabinet.org');
  const tc = useTranslations('kabinet.common');
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [err, setErr] = useState(false);

  const load = () => api<Membership[]>('/orgs/mine').then(setOrgs).catch(() => setErr(true));
  useEffect(() => { void load(); }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>
      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}
      {!orgs && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      <div className="mt-6 space-y-6">
        {orgs?.map((m) => <OrgCard key={m.orgId} m={m} onChange={load} />)}
        <NewOrgForm onCreated={load} />
      </div>
    </main>
  );
}

function OrgFields({ d, set, disabled }: { d: Draft; set: (p: Partial<Draft>) => void; disabled?: boolean }) {
  const t = useTranslations('kabinet.org');
  const tr = useTranslations('region');
  const tk = useTranslations('orgKind');
  return (
    <>
      <Field label={t('field.name')} required>
        <input className={INPUT} value={d.name} minLength={2} maxLength={120} required disabled={disabled} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field group label={t('field.kinds')} required hint={t('hint.kinds')}>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const on = d.kinds.includes(k);
            return <button key={k} type="button" disabled={disabled} aria-pressed={on} className={CHIP(on)} onClick={() => set({ kinds: on ? d.kinds.filter((x) => x !== k) : [...d.kinds, k] })}>{tk.has(k) ? tk(k) : k}</button>;
          })}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('field.stir')} hint={t('hint.stir')}>
          <input className={`${INPUT} font-mono`} inputMode="numeric" value={d.stir} disabled={disabled} onChange={(e) => set({ stir: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
        </Field>
        <Field label={t('field.regionCode')}>
          <select className={INPUT} value={d.regionCode} disabled={disabled} onChange={(e) => set({ regionCode: e.target.value })}>
            <option value="">{t('regionNone')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
          </select>
        </Field>
        <Field label={t('field.phone')}>
          <PhoneField className={`${INPUT} font-mono`} value={d.phone} disabled={disabled} onChange={(phone) => set({ phone })} />
        </Field>
        <Field label={t('field.telegram')} hint={t('hint.telegram')}>
          <input className={INPUT} value={d.telegram} maxLength={80} disabled={disabled} onChange={(e) => set({ telegram: e.target.value })} />
        </Field>
        <Field label={t('field.website')}>
          <input className={INPUT} type="url" value={d.website} maxLength={200} disabled={disabled} onChange={(e) => set({ website: e.target.value })} />
        </Field>
        <Field label={t('field.address')}>
          <input className={INPUT} value={d.address} maxLength={300} disabled={disabled} onChange={(e) => set({ address: e.target.value })} />
        </Field>
      </div>
      <Field label={t('field.description')}>
        <textarea className={`${INPUT} min-h-24`} value={d.description} maxLength={2000} disabled={disabled} onChange={(e) => set({ description: e.target.value })} />
      </Field>
    </>
  );
}

function OrgCard({ m, onChange }: { m: Membership; onChange: () => void }) {
  const t = useTranslations('kabinet.org');
  const tc = useTranslations('kabinet.common');
  const te = useTranslations('kabinet.org.err');
  const lang = useLang();
  const o = m.org;
  const [d, setD] = useState<Draft>(() => fromOrg(o));
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [invite, setInvite] = useState<{ phone: string; roles: Role[] }>({ phone: '', roles: [] });
  // Ma'lumotlar | Do'kon (/k/[slug]) yorliqlari
  const ts = useTranslations('storefront.tab');
  const [tab, setTab] = useState<'info' | 'shop'>('info');
  useEffect(() => { setD(fromOrg(o)); }, [o]);

  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const fail = (e: unknown) => setNote({ tone: 'err', text: errText(e, te, te.has, tc('failed')) });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy('save'); setNote(null);
    try { await api(`/orgs/${o.id}`, { method: 'PATCH', body: JSON.stringify(toBody(d)) }); setNote({ tone: 'ok', text: tc('saved') }); onChange(); }
    catch (er) { fail(er); } finally { setBusy(null); }
  }
  async function kycRequest() {
    setBusy('kyc'); setNote(null);
    try { await post(`/orgs/${o.id}/kyc/request`, {}); onChange(); }
    catch (er) { fail(er); } finally { setBusy(null); }
  }
  async function addMember(e: React.FormEvent) {
    e.preventDefault(); setBusy('invite'); setNote(null);
    try { const added = phoneDisplay(invite.phone); await post(`/orgs/${o.id}/members`, invite); setInvite({ phone: '', roles: [] }); setNote({ tone: 'ok', text: `${t('members.invited')} ${added}` }); }
    catch (er) {
      const allowed = er instanceof ApiError && Array.isArray(er.body?.allowed) ? ` (${er.body.allowed.join(', ')})` : '';
      setNote({ tone: 'err', text: errText(er, te, te.has, tc('failed')) + allowed });
    } finally { setBusy(null); }
  }

  // Taklif qilinadigan rollar: tanlangan turlar ruxsat berganlari (PLATFORM rollari yo'q)
  const roles = [...new Set(d.kinds.flatMap((k) => ORG_KIND_ROLES[k]))].filter((r) => !r.startsWith('PLATFORM'));
  const canKyc = m.isOwner && (o.kycStatus === 'NONE' || o.kycStatus === 'REJECTED');

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{o.name}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${KYC_TONE[o.kycStatus]}`}>{KYC_STATUS_LABELS[lang][o.kycStatus]}</span>
        <span className="ml-auto font-mono text-xs text-muted">{t('yourRoles')}: {m.roles.map((r) => (t.has(`role.${r}`) ? t(`role.${r}`) : r)).join(', ')}{m.isOwner ? ` · ${t('owner')}` : ''}</span>
      </div>
      {!m.isOwner ? <p className="mt-2 text-sm text-muted">{t('readOnly')}</p> : null}
      <div className="mt-4 flex gap-2">
        {(['info', 'shop'] as const).map((k) => <button key={k} type="button" aria-pressed={tab === k} className={CHIP(tab === k)} onClick={() => setTab(k)}>{ts(k)}</button>)}
      </div>
      {tab === 'shop' ? <StorefrontForm key={o.id} orgId={o.id} slug={o.slug} initial={o.storefront ?? null} disabled={!m.isOwner} onSaved={onChange} /> : (<>

      <form onSubmit={save} className="mt-4 space-y-4">
        <OrgFields d={d} set={set} disabled={!m.isOwner} />
        {m.isOwner ? <button type="submit" disabled={busy !== null || !d.kinds.length || d.name.trim().length < 2} className={BTN_NAVY}>{busy === 'save' ? tc('saving') : tc('save')}</button> : null}
      </form>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="font-semibold">{t('kyc.title')}</h3>
        <p className="mt-1 text-sm text-muted">{t(`kyc.hint.${o.kycStatus}`)}</p>
        {o.kycRequestedAt ? <p className="mt-1 font-mono text-xs text-muted">{t('kyc.requestedAt')}: {uzDateTime(o.kycRequestedAt, lang)}</p> : null}
        {o.kycNote ? <p className="mt-2 rounded-xl bg-sand p-3 text-sm"><span className="text-muted">{t('kyc.note')}: </span>{o.kycNote}</p> : null}
        {canKyc ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy !== null || !o.stir} onClick={kycRequest} className={BTN_PRIMARY}>{busy === 'kyc' ? tc('saving') : t('kyc.request')}</button>
            {!o.stir ? <span className="text-sm text-amber-ink">{t('kyc.needStir')}</span> : null}
          </div>
        ) : null}
      </div>

      {m.isOwner ? (
        <form onSubmit={addMember} className="mt-6 border-t border-line pt-4">
          <h3 className="font-semibold">{t('members.title')}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field label={t('members.phone')} required>
              <PhoneField className={`${INPUT} font-mono`} required value={invite.phone} onChange={(phone) => setInvite({ ...invite, phone })} />
            </Field>
            <Field group label={t('members.roles')} required>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => {
                  const on = invite.roles.includes(r);
                  return <button key={r} type="button" aria-pressed={on} className={CHIP(on)} onClick={() => setInvite({ ...invite, roles: on ? invite.roles.filter((x) => x !== r) : [...invite.roles, r] })}>{t.has(`role.${r}`) ? t(`role.${r}`) : r}</button>;
                })}
              </div>
            </Field>
          </div>
          <button type="submit" disabled={busy !== null || !invite.roles.length || !invite.phone.trim()} className={`${BTN_GHOST} mt-3`}>{busy === 'invite' ? tc('saving') : t('members.invite')}</button>
        </form>
      ) : null}
      </>)}

      {note ? <div className="mt-4"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
    </section>
  );
}

function NewOrgForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('kabinet.org');
  const tc = useTranslations('kabinet.common');
  const te = useTranslations('kabinet.org.err');
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNote(null);
    try {
      const b = toBody(d);
      await post('/orgs', { ...b, description: b.description || undefined, telegram: b.telegram || undefined, website: b.website || undefined, phone: b.phone || undefined, address: b.address || undefined });
      setD(EMPTY); setOpen(false); setNote({ tone: 'ok', text: t('created') }); onCreated();
    } catch (er) { setNote({ tone: 'err', text: errText(er, te, te.has, tc('failed')) }); } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div className="space-y-3">
        {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
        <button type="button" onClick={() => setOpen(true)} className={BTN_PRIMARY}>{t('new')}</button>
      </div>
    );
  }
  return (
    <form onSubmit={create} className="space-y-4 rounded-card border border-line bg-white p-5">
      <h2 className="text-lg font-bold">{t('new')}</h2>
      <OrgFields d={d} set={(p) => setD((x) => ({ ...x, ...p }))} />
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.kinds.length || d.name.trim().length < 2} className={BTN_NAVY}>{busy ? tc('saving') : t('create')}</button>
        <button type="button" onClick={() => setOpen(false)} className={BTN_GHOST}>{tc('cancel')}</button>
      </div>
    </form>
  );
}
