'use client';
// Terminal kabineti: uch bo'lim (Ma'lumot, Tariflar, Slotlar). Ma'lumot: POST/PATCH /terminals + PUT /terminals/:id/services.
// Faollashtirish: saqlash + PATCH { status: 'ACTIVE' }. Yangi terminal saqlangach o'z sahifasiga o'tadi (tariflar va slotlar id talab qiladi).
import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SERVICE_CODES, TERMINAL_KINDS, type ServiceCode, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { DAYS } from '@/lib/format';
import type { Passport, WeekHours } from '@/lib/types';
import type { Membership, MyTerminal } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_PRIMARY, CHIP, Field, INPUT, Notice, errText } from '@/components/kabinet/bits';
import { PhotoUpload } from '@/components/kabinet/PhotoUpload';
import { StationSearch, type StationPick } from '@/components/catalog/StationSearch';
import { MapPicker } from './MapPicker';
import { TariffsTab } from './TariffsTab';
import { SlotsTab } from './SlotsTab';
import { AnalyticsPanel } from '@/components/kabinet/AnalyticsPanel';
import { PhoneField } from '@/components/ui/fields';

type Tab = 'info' | 'tariffs' | 'slots' | 'stats';
const TABS: Tab[] = ['info', 'tariffs', 'slots', 'stats'];
const STATUS_TONE: Record<TerminalStatus, string> = { DRAFT: 'bg-line text-ink/70', ACTIVE: 'bg-teal text-white', HIDDEN: 'bg-amber-soft text-amber-ink' };

export function TerminalStatusPill({ status }: { status: TerminalStatus }) {
  const t = useTranslations('terminalsAdmin.status');
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>{t(status)}</span>;
}

/** Bo'limlar: yangi terminalda Tariflar va Slotlar ko'rinadi, lekin saqlanguncha yozib bo'lmaydi (terminalId null). */
export function TerminalEditor({ initial }: { initial?: MyTerminal }) {
  const t = useTranslations('terminalsAdmin');
  const ta = useTranslations('analytics');
  const [tab, setTab] = useState<Tab>('info');
  const uid = useId();
  const [term, setTerm] = useState<MyTerminal | null>(initial ?? null);
  const enabled = term?.services.filter((s) => s.isEnabled).map((s) => s.serviceCode) ?? [];
  return (
    <div>
      <div
        role="tablist" className="flex gap-2 overflow-x-auto no-scrollbar"
        onKeyDown={(e) => {
          // O'q tugmalari bilan yurish (roving tabIndex: faqat faol bo'lim Tab bilan olinadi)
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length]!;
          setTab(next);
          document.getElementById(`${uid}-${next}`)?.focus();
        }}
      >
        {TABS.map((k) => <button key={k} id={`${uid}-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls={`${uid}-panel`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} className={`shrink-0 ${CHIP(tab === k)}`}>{k === 'stats' ? ta('tab') : t(`tabs.${k}`)}</button>)}
      </div>
      {!term && tab !== 'info' ? <div className="mt-4"><Notice tone="warn">{t('form.unsavedTabs')}</Notice></div> : null}
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-${tab}`} className="mt-5">
        {tab === 'info' ? <TerminalForm initial={term ?? undefined} onSaved={setTerm} />
          : tab === 'tariffs' ? <TariffsTab terminalId={term?.id ?? null} services={enabled} />
          : tab === 'slots' ? <SlotsTab terminalId={term?.id ?? null} />
          : term ? <AnalyticsPanel path={`/terminals/${term.id}/analytics`} kind="terminal" /> : null}
      </div>
    </div>
  );
}

type Station = StationPick & { lat?: number | null; lng?: number | null };
type Crane = { type: string; capacityT: number | null };
type Draft = {
  orgId: string; station: Station | null; kind: TerminalKind; name: string; description: string; address: string; phone: string;
  lat: number | null; lng: number | null; is24h: boolean; hours: WeekHours; photos: string[];
  tracks: number | null; tracksLengthM: number | null; cranes: Crane[]; warehouseM2: number | null; openAreaM2: number | null;
  hasSvx: boolean; hasScale: boolean; scaleT: number | null; containerSlots: number | null; customsPost: boolean;
  services: Record<ServiceCode, { on: boolean; lead: number }>;
};
const WORK: [string, string][] = [['08:00', '18:00']];
const EMPTY: Draft = {
  orgId: '', station: null, kind: 'MULTI', name: '', description: '', address: '', phone: '', lat: null, lng: null, is24h: false,
  hours: { mon: WORK, tue: WORK, wed: WORK, thu: WORK, fri: WORK, sat: WORK, sun: [] }, photos: [],
  tracks: null, tracksLengthM: null, cranes: [], warehouseM2: null, openAreaM2: null, hasSvx: false, hasScale: false, scaleT: null, containerSlots: null, customsPost: false,
  services: Object.fromEntries(SERVICE_CODES.map((c) => [c, { on: c === 'LOAD' || c === 'UNLOAD', lead: 0 }])) as Draft['services'],
};
const fromTerminal = (x: MyTerminal): Draft => {
  const p: Passport = x.passport ?? {};
  return {
    orgId: x.orgId ?? '', station: x.station, kind: x.kind, name: x.name, description: x.description ?? '', address: x.address ?? '', phone: x.phone ?? '',
    lat: x.lat, lng: x.lng, is24h: x.is24h, hours: x.hours ?? EMPTY.hours, photos: x.photos,
    tracks: p.tracks ?? null, tracksLengthM: p.tracksLengthM ?? null, cranes: p.cranes ?? [], warehouseM2: p.warehouseM2 ?? null, openAreaM2: p.openAreaM2 ?? null,
    hasSvx: !!p.hasSvx, hasScale: !!p.hasScale, scaleT: p.scaleT ?? null, containerSlots: p.containerSlots ?? null, customsPost: !!p.customsPost,
    services: Object.fromEntries(SERVICE_CODES.map((c) => { const s = x.services.find((y) => y.serviceCode === c); return [c, { on: !!s?.isEnabled, lead: s?.leadTimeMin ?? 0 }]; })) as Draft['services'],
  };
};
const numOr = (v: string) => (v.trim() === '' ? null : Number(v));
const strOr = (v: string) => (v.trim() === '' ? null : v.trim());
const und = <T,>(v: T | null) => (v === null ? undefined : v);
const isTerminalOrg = (m: Membership) => (m.org.kinds?.length ? m.org.kinds : [m.org.kind]).includes('TERMINAL');

/** Yozuv tanasi (CreateTerminalDto / UpdateTerminalDto): bo'sh matn null bo'lib tozalaydi, pasportda faqat to'ldirilganlar. */
function toBody(d: Draft) {
  return {
    stationId: d.station?.id, kind: d.kind, name: d.name.trim(), description: strOr(d.description), address: strOr(d.address), phone: strOr(d.phone),
    lat: d.lat, lng: d.lng, is24h: d.is24h, hours: d.hours, photos: d.photos,
    passport: {
      tracks: und(d.tracks), tracksLengthM: und(d.tracksLengthM), warehouseM2: und(d.warehouseM2), openAreaM2: und(d.openAreaM2),
      cranes: d.cranes.filter((c) => c.type.trim()).map((c) => ({ type: c.type.trim(), capacityT: c.capacityT ?? 0 })),
      hasSvx: d.hasSvx, hasScale: d.hasScale, scaleT: d.hasScale ? und(d.scaleT) : undefined, containerSlots: und(d.containerSlots), customsPost: d.customsPost,
    },
  };
}

export function TerminalForm({ initial, onSaved }: { initial?: MyTerminal; onSaved: (t: MyTerminal) => void }) {
  const t = useTranslations('terminalsAdmin.form');
  const te = useTranslations('terminalsAdmin.form.err');
  const tc = useTranslations('kabinet.common');
  const tk = useTranslations('kind');
  const ts = useTranslations('service');
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial ? fromTerminal(initial) : EMPTY);
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [busy, setBusy] = useState<'save' | 'publish' | 'hide' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const id = initial?.id ?? null;
  const status = initial?.status ?? null;
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (id) return;
    api<Membership[]>('/orgs/mine').then((ms) => { const ts = ms.filter(isTerminalOrg); setOrgs(ts); setD((x) => ({ ...x, orgId: x.orgId || ts[0]?.orgId || '' })); }).catch(() => setOrgs([]));
  }, [id]);

  /** Saqlash: yangi bo'lsa POST, bo'lmasa PATCH; keyin xizmatlar PUT. Kerak bo'lsa holat alohida PATCH bilan. */
  async function save(nextStatus?: TerminalStatus): Promise<MyTerminal | null> {
    setNotice(null);
    const fail = (code: string) => { setNotice({ tone: 'err', text: te(code) }); return null; };
    if (!id && !d.orgId) return fail('ORG_REQUIRED');
    if (d.name.trim().length < 2) return fail('NAME_REQUIRED');
    // Stansiya faqat yangi obyektda majburiy: reestrdan kelgan qatorda stansiya
    // bog'lanmagan bo'lishi mumkin va egasi hech narsa saqlay olmasdi.
    // Bor stansiyani bu o'chirmaydi: stansiyani faqat topilgan qiymat yozadi,
    // topilmasa maydon UPDATE ga umuman tushmaydi.
    if (!id && !d.station) return fail('STATION_REQUIRED');
    const body = toBody(d);
    let rec = id ? await api<MyTerminal>(`/terminals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }) : await post<MyTerminal>('/terminals', { orgId: d.orgId, ...body });
    const services = SERVICE_CODES.map((c) => ({ serviceCode: c, isEnabled: d.services[c].on, leadTimeMin: d.services[c].lead }));
    rec = await api<MyTerminal>(`/terminals/${rec.id}/services`, { method: 'PUT', body: JSON.stringify({ services }) });
    if (nextStatus && rec.status !== nextStatus) rec = await api<MyTerminal>(`/terminals/${rec.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
    return rec;
  }

  async function run(kind: 'save' | 'publish' | 'hide') {
    setBusy(kind);
    try {
      const rec = await save(kind === 'publish' ? 'ACTIVE' : kind === 'hide' ? 'HIDDEN' : undefined);
      if (!rec) return;
      onSaved(rec);
      if (!id) { router.replace(`/dashboard/terminals/${rec.id}`); return; }
      setNotice({ tone: 'ok', text: t(kind === 'publish' ? 'published' : kind === 'hide' ? 'hidden' : 'saved') });
    } catch (e) { setNotice({ tone: 'err', text: errText(e, te, te.has, tc('failed')) }); } finally { setBusy(null); }
  }

  const point = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const stationPt = d.station?.lat != null && d.station?.lng != null ? { lat: d.station.lat, lng: d.station.lng } : null;
  const NUM = `${INPUT} font-mono`;

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void run('save'); }}>
      {status ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {t('currentStatus')}: <TerminalStatusPill status={status} />
          {status === 'ACTIVE' && initial ? <Link href={`/terminals/${initial.slug}`} className="font-semibold text-teal-ink underline">{t('openPublic')}</Link> : null}
          {initial?.orgName ? <span className="ml-auto">{t('field.org')}: <span className="font-semibold text-ink">{initial.orgName}</span></span> : null}
        </div>
      ) : null}

      {/* Asosiy */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.main')}</h2>
        {!id ? (
          orgs && orgs.length === 0 ? (
            <Notice tone="warn">{t('noOrg')} <Link href="/dashboard/organization" className="ml-1 font-semibold underline">{t('toOrg')}</Link></Notice>
          ) : (
            <Field label={t('field.org')} required hint={t('hint.org')}>
              <select className={INPUT} value={d.orgId} onChange={(e) => set({ orgId: e.target.value })} disabled={!orgs}>
                {(orgs ?? []).map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
              </select>
            </Field>
          )
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.name')} required>
            <input className={INPUT} value={d.name} minLength={2} maxLength={120} placeholder={t('placeholder.name')} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field group label={t('field.kind')} required>
            <div className="flex flex-wrap gap-2">
              {TERMINAL_KINDS.map((k) => <button key={k} type="button" aria-pressed={d.kind === k} className={CHIP(d.kind === k)} onClick={() => set({ kind: k })}>{tk(k)}</button>)}
            </div>
          </Field>
        </div>
        <Field label={t('field.description')}>
          <textarea className={`${INPUT} min-h-24`} value={d.description} maxLength={2000} placeholder={t('placeholder.description')} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label={t('field.phone')}>
          <PhoneField className={NUM} value={d.phone} placeholder={t('placeholder.phone')} onChange={(phone) => set({ phone })} />
        </Field>
      </section>

      {/* Joylashuv */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.place')}</h2>
        <Field group label={t('field.station')} required hint={t('hint.station')}>
          <StationSearch value={d.station} onChange={(s) => set({ station: s as Station | null })} ariaLabel={t('field.station')} inputClassName={INPUT} />
        </Field>
        <Field label={t('field.address')}>
          <input className={INPUT} value={d.address} maxLength={300} placeholder={t('placeholder.address')} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.lat')}>
            <input type="number" step="0.00001" min={-90} max={90} className={NUM} value={d.lat ?? ''} onChange={(e) => set({ lat: numOr(e.target.value) })} />
          </Field>
          <Field label={t('field.lng')}>
            <input type="number" step="0.00001" min={-180} max={180} className={NUM} value={d.lng ?? ''} onChange={(e) => set({ lng: numOr(e.target.value) })} />
          </Field>
        </div>
        <MapPicker point={point} fallback={stationPt} onPick={(p) => set(p)} />
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {t('hint.map')}
          {stationPt ? <button type="button" onClick={() => set(stationPt)} className="font-semibold text-teal-ink underline">{t('hint.fromStation')}</button> : null}
        </p>
      </section>

      {/* Ish vaqti */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.hours')}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={d.is24h} onChange={(e) => set({ is24h: e.target.checked })} className="h-4 w-4 accent-teal" />{t('field.is24h')}
        </label>
        {!d.is24h ? <><HoursEditor hours={d.hours} onChange={(h) => set({ hours: h })} /><p className="text-xs text-muted">{t('hint.hours')}</p></> : null}
      </section>

      {/* Pasport */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.passport')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('field.tracks')}><input type="number" min={0} className={NUM} value={d.tracks ?? ''} onChange={(e) => set({ tracks: numOr(e.target.value) })} /></Field>
          <Field label={t('field.tracksLengthM')}><input type="number" min={0} className={NUM} value={d.tracksLengthM ?? ''} onChange={(e) => set({ tracksLengthM: numOr(e.target.value) })} /></Field>
          <Field label={t('field.warehouseM2')}><input type="number" min={0} className={NUM} value={d.warehouseM2 ?? ''} onChange={(e) => set({ warehouseM2: numOr(e.target.value) })} /></Field>
          <Field label={t('field.openAreaM2')}><input type="number" min={0} className={NUM} value={d.openAreaM2 ?? ''} onChange={(e) => set({ openAreaM2: numOr(e.target.value) })} /></Field>
          <Field label={t('field.containerSlots')}><input type="number" min={0} className={NUM} value={d.containerSlots ?? ''} onChange={(e) => set({ containerSlots: numOr(e.target.value) })} /></Field>
          <Field label={t('field.scaleT')}><input type="number" min={0} className={NUM} value={d.scaleT ?? ''} disabled={!d.hasScale} onChange={(e) => set({ scaleT: numOr(e.target.value) })} /></Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.hasScale} onChange={(e) => set({ hasScale: e.target.checked })} className="h-4 w-4 accent-teal" />{t('field.hasScale')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.hasSvx} onChange={(e) => set({ hasSvx: e.target.checked })} className="h-4 w-4 accent-teal" />{t('field.hasSvx')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.customsPost} onChange={(e) => set({ customsPost: e.target.checked })} className="h-4 w-4 accent-teal" />{t('field.customsPost')}</label>
        </div>
        <Field group label={t('field.cranes')}>
          <ul className="space-y-2">
            {d.cranes.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input aria-label={t('field.craneType')} className={`${INPUT} sm:w-auto sm:flex-1`} value={c.type} maxLength={60} placeholder={t('placeholder.craneType')} onChange={(e) => set({ cranes: d.cranes.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })} />
                <input aria-label={t('field.craneCapacityT')} type="number" min={0} className={`${NUM} sm:w-32`} value={c.capacityT ?? ''} placeholder="t" onChange={(e) => set({ cranes: d.cranes.map((x, j) => (j === i ? { ...x, capacityT: numOr(e.target.value) } : x)) })} />
                <button type="button" onClick={() => set({ cranes: d.cranes.filter((_, j) => j !== i) })} className="text-sm text-red-700 underline">{t('remove')}</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => set({ cranes: [...d.cranes, { type: '', capacityT: null }] })} className={`${BTN_GHOST} mt-2`}>{t('addCrane')}</button>
        </Field>
      </section>

      {/* Xizmatlar */}
      <section className="space-y-3 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.services')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SERVICE_CODES.map((c) => {
            const s = d.services[c];
            const upd = (p: Partial<{ on: boolean; lead: number }>) => set({ services: { ...d.services, [c]: { ...s, ...p } } });
            return (
              <li key={c} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 transition ${s.on ? 'border-teal bg-teal-soft/40' : 'border-line bg-white'}`}>
                <label className="flex flex-1 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={s.on} onChange={(e) => upd({ on: e.target.checked })} className="h-4 w-4 accent-teal" />{ts(c)}</label>
                <label className="flex items-center gap-1.5 text-xs text-muted">{t('field.leadTime')}
                  <input type="number" min={0} max={10080} step={30} value={s.lead} disabled={!s.on} onChange={(e) => upd({ lead: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded-lg border border-field bg-white px-2 py-1 font-mono text-sm text-ink disabled:bg-sand disabled:text-muted" />
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">{t('hint.services')}</p>
      </section>

      {/* Rasmlar */}
      <section className="space-y-3 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.photos')}</h2>
        <PhotoUpload photos={d.photos} onChange={(p) => set({ photos: p })} />
        <p className="text-xs text-muted">{t('hint.photos')}</p>
      </section>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy !== null} className={BTN_GHOST}>{busy === 'save' ? tc('saving') : t('saveDraft')}</button>
        {status !== 'ACTIVE' ? <button type="button" disabled={busy !== null} onClick={() => run('publish')} className={BTN_PRIMARY}>{busy === 'publish' ? t('busy') : t('publish')}</button> : null}
        {status === 'ACTIVE' ? <button type="button" disabled={busy !== null} onClick={() => run('hide')} className={BTN_GHOST}>{busy === 'hide' ? t('busy') : t('unpublish')}</button> : null}
        <Link href="/dashboard/terminals" className="ml-auto text-sm text-muted underline hover:text-ink">{t('backToList')}</Link>
      </div>
    </form>
  );
}

const TIME = 'rounded-lg border border-field bg-white px-2 py-1 font-mono text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25';

/** Hafta kunlari: har kun ko'pi bilan ikkita oraliq, native time input. Bo'sh kun = dam olish. */
function HoursEditor({ hours, onChange }: { hours: WeekHours; onChange: (h: WeekHours) => void }) {
  const t = useTranslations('terminalsAdmin.form');
  const td = useTranslations('format.day');
  return (
    <ul className="space-y-2">
      {DAYS.map((day) => {
        const ranges = hours[day] ?? [];
        const setR = (r: [string, string][]) => onChange({ ...hours, [day]: r });
        return (
          <li key={day} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-10 font-mono text-xs font-semibold text-muted">{td(day)}</span>
            {ranges.length === 0 ? <span className="text-xs text-muted">{t('dayOff')}</span> : null}
            {ranges.map(([a, b], i) => (
              <span key={i} className="flex items-center gap-1">
                <input type="time" value={a} onChange={(e) => setR(ranges.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} className={TIME} />
                <span className="text-muted">-</span>
                <input type="time" value={b} onChange={(e) => setR(ranges.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} className={TIME} />
                <button type="button" aria-label={t('remove')} onClick={() => setR(ranges.filter((_, j) => j !== i))} className="px-1.5 text-xs font-semibold text-red-700">x</button>
              </span>
            ))}
            {ranges.length < 2 ? <button type="button" onClick={() => setR([...ranges, ranges.length ? ['14:00', '18:00'] : ['08:00', '18:00']])} className="text-xs font-semibold text-teal-ink underline">{t('addRange')}</button> : null}
          </li>
        );
      })}
    </ul>
  );
}
