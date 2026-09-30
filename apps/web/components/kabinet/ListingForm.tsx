'use client';
// E'lon formasi: 1) tur tanlash, 2) LISTING_RULES bo'yicha maydonlar. validateListing jonli: xatolar inline (urinishdan keyin), tavsiyalar amber.
// Qoralama: POST/PATCH /listings. E'lon berish: saqlash + POST /listings/:id/publish (tasdiqlangan tashkilot va telefoni tasdiqlangan haydovchi darhol ACTIVE).
// Egasi: TRUCK ni shaxsan (orgId yo'q) yoki tashkilot nomidan; temir yo'l turlari faqat tashkilot (ORG_REQUIRED). Egasi keyin o'zgarmaydi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Train, TrainRegional, TrainSimple, Truck } from '@phosphor-icons/react';
import {
  CONDITIONS, DEAL_KINDS, LISTING, LISTING_KINDS, LISTING_RULES, PRICE_UNITS_FOR, REGIONS, TRUCK_TYPES, WAGON_TYPES, validateListing,
  type ListingInput, type ListingKind, type ListingStatus, type PriceUnit, type RegionCode,
} from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import type { Membership, MyTerminal, OwnerListing } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_PRIMARY, CHIP, Field, INPUT, ListingStatusPill, Notice, useListingLabels } from './bits';
import { OpenCargoLink } from './OpenCargoLink';
import { PhotoUpload } from './PhotoUpload';
import { PhoneField } from '@/components/ui/fields';

const KIND_ICON = { SHUNTING_LOCO: Train, WAGON: TrainSimple, TRUCK: Truck } as const;

const EMPTY: Omit<ListingInput, 'kind'> = {
  deal: null, title: '', description: null, regionCode: 'UZ-TK', terminalId: null, priceTiyin: null, priceUnit: null, photos: [],
  year: null, condition: null, model: null, qty: 1, wagonType: null, capacityT: null, truckType: null, tonnage: null, fleetSize: null,
  serviceRegions: [], routes: [], contactPhone: null,
};

const fromListing = (l: OwnerListing): ListingInput => ({
  // Shahobcha ham terminal: obyekt turidan qat'i nazar bitta maydon
  kind: l.kind, deal: l.deal, title: l.title, description: l.description, regionCode: l.regionCode, terminalId: l.object?.id ?? null,
  priceTiyin: l.priceTiyin, priceUnit: l.priceUnit, photos: l.photos, year: l.year,
  condition: l.condition, model: l.model, qty: l.qty, wagonType: l.wagonType, capacityT: l.capacityT, truckType: l.truckType, tonnage: l.tonnage,
  fleetSize: l.fleetSize, serviceRegions: l.serviceRegions, routes: l.routes ?? [], contactPhone: l.contactPhone,
});

const numOr = (v: string) => (v.trim() === '' ? null : Number(v));
const strOr = (v: string) => (v.trim() === '' ? null : v);

export function ListingForm({ initial, presetKind }: { initial?: OwnerListing; presetKind?: ListingKind | null }) {
  const t = useTranslations('kabinet.form');
  const tc = useTranslations('kabinet.common');
  const tr = useTranslations('region');
  const L = useListingLabels();

  const [kind, setKind] = useState<ListingKind | null>(initial?.kind ?? presetKind ?? null);
  const [input, setInput] = useState<ListingInput>(initial ? fromListing(initial) : { kind: presetKind ?? 'WAGON', ...EMPTY });
  const [askPrice, setAskPrice] = useState(initial ? initial.priceTiyin == null : false);
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<ListingStatus | null>(initial?.status ?? null);
  const [orgId, setOrgId] = useState(initial?.orgId ?? '');
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [terminals, setTerminals] = useState<MyTerminal[]>([]);
  const [tried, setTried] = useState(false);
  // Har muvaffaqiyatsiz yuborishda oshadi. `tried` ning o'zi yetmaydi: u ikkinchi
  // urinishda ham `true` bo'lib qolaveradi va fokus effekti boshqa ishlamasdi.
  const [badTry, setBadTry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [serverErrors, setServerErrors] = useState<{ field: string; code: string }[]>([]);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: React.ReactNode } | null>(null);

  useEffect(() => {
    api<Membership[]>('/orgs/mine').then((ms) => { setOrgs(ms); if (!initial) setOrgId((v) => v || ms[0]?.orgId || ''); }).catch(() => setOrgs([]));
    api<MyTerminal[]>('/terminals/mine').then(setTerminals).catch(() => {});
  }, []);

  // Fokus xatolar CHIZILGANDAN keyin ko'chishi kerak, shuning uchun effekt: setState
  // darhol DOM ga tushmaydi va o'sha zahoti qidirsak aria-invalid hali yo'q bo'lardi.
  useEffect(() => {
    if (!badTry) return;
    const f = formRef.current;
    // Oddiy maydonga Field aria-invalid qo'yadi. Chip'lar guruhida (deal, condition,
    // hududlar) boshqaruv ko'p, shuning uchun u yerda belgi yo'q: xato matnidan
    // o'rab turgan yorliqqa chiqib, guruhdagi birinchi boshqaruv olinadi.
    const el = f?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? f?.querySelector('p[role="alert"]')?.closest('label,[role="group"]')?.querySelector<HTMLElement>('input,select,textarea,button');
    el?.focus();
  }, [badTry]);

  // Shahobcha /terminals/mine ichida keladi: ilgari /sidings/mine ham so'ralib, har biri ikki marta chiqardi
  const road = terminals.filter((x) => x.kind !== 'RAIL');
  const rail = terminals.filter((x) => x.kind === 'RAIL');

  // Egasi: tahrirda yozuvdan, yangi e'londa tanlovdan ('' = shaxsan)
  const person = initial ? initial.owner.type === 'person' : !orgId;
  const { errors, warnings } = useMemo(() => validateListing({ ...input, ownerType: person ? 'person' : 'org' }), [input, person]);
  const set = (patch: Partial<ListingInput>) => { setInput((i) => ({ ...i, ...patch })); setServerErrors([]); };
  const rules = kind ? LISTING_RULES[kind] : null;
  const isMust = (f: keyof ListingInput) => !!rules?.must.includes(f);
  const isShould = (f: keyof ListingInput) => !!rules?.should.includes(f);
  const fieldErr = (f: string) => {
    const e = (tried ? errors : []).find((x) => x.field === f) ?? serverErrors.find((x) => x.field === f);
    return e ? (t.has(`err.${e.code}`) ? t(`err.${e.code}`) : e.code) : undefined;
  };
  const rec = (f: keyof ListingInput) => (isShould(f) ? tc('recommended') : undefined);

  function pickKind(k: ListingKind) {
    setKind(k);
    setInput((i) => ({ ...i, kind: k, deal: k === 'TRUCK' ? null : i.deal, priceUnit: null, wagonType: k === 'WAGON' ? i.wagonType : null, truckType: k === 'TRUCK' ? i.truckType : null }));
    if (k !== 'TRUCK' && !orgId) setOrgId(orgs?.[0]?.orgId ?? ''); // temir yo'l: shaxsan bo'lmaydi
    setTried(false);
  }

  const truck = kind === 'TRUCK';
  const units: readonly PriceUnit[] = truck ? PRICE_UNITS_FOR.TRUCK : input.deal ? PRICE_UNITS_FOR[input.deal] : [...PRICE_UNITS_FOR.RENT, ...PRICE_UNITS_FOR.SALE];

  function apiErr(e: unknown): React.ReactNode {
    const body = e instanceof ApiError ? e.body : null;
    const code = String(body?.code ?? '');
    if (code === 'LISTING_INVALID' && Array.isArray(body?.errors)) setServerErrors(body.errors);
    return code && t.has(`err.${code}`) ? t(`err.${code}`) : tc('failed');
  }

  /** Saqlash: yangi bo'lsa POST (orgId bo'lsa tashkilot, bo'lmasa shaxsiy), bo'lmasa PATCH. Muvaffaqiyatda id qaytadi. */
  async function save(): Promise<OwnerListing | null> {
    setTried(true); setNotice(null);
    if (!id && !truck && !orgId) { setNotice({ tone: 'err', text: t('noOrg') }); return null; }
    if (errors.length) { setBadTry((n) => n + 1); return null; } // ro'yxat pastda, fokus birinchi nosoz maydonda
    const body = { ...input, priceTiyin: askPrice ? null : input.priceTiyin, priceUnit: askPrice ? null : input.priceUnit };
    const l = id ? await api<OwnerListing>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }) : await post<OwnerListing>('/listings', { ...(orgId ? { orgId } : {}), ...body });
    setId(l.id); setStatus(l.status);
    return l;
  }

  async function onSave() {
    setBusy('save');
    try { if (await save()) setNotice({ tone: 'ok', text: t('saved') }); }
    catch (e) { setNotice({ tone: 'err', text: apiErr(e) }); } finally { setBusy(null); }
  }

  async function onPublish() {
    setBusy('publish');
    try {
      const l = await save();
      if (!l) return;
      const p = await post<OwnerListing>(`/listings/${l.id}/publish`, {});
      setStatus(p.status);
      const key = p.status === 'ACTIVE' ? 'published.ACTIVE' : 'published.PENDING_REVIEW';
      setNotice({ tone: 'ok', text: <>{t(key)} <Link href="/dashboard/listings" className="ml-2 font-semibold underline">{t('backToList')}</Link> <OpenCargoLink l={p} /></> });
    } catch (e) { setNotice({ tone: 'err', text: apiErr(e) }); } finally { setBusy(null); }
  }

  // 1-qadam: tur
  if (!kind) {
    return (
      <section>
        <h2 className="text-lg font-bold">{t('pickKind')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {LISTING_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button key={k} type="button" onClick={() => pickKind(k)} className="flex items-start gap-4 rounded-card border border-line bg-white p-5 text-left transition hover:border-teal focus-visible:border-teal">
                <span className="rounded-xl bg-teal-soft p-3 text-teal-ink"><Icon size={28} weight="duotone" /></span>
                <span>
                  <span className="block font-display text-base font-bold">{L.kind[k]}</span>
                  <span className="mt-1 block text-sm text-muted">{t(`kindHint.${k}`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const Icon = KIND_ICON[kind];
  const canPublish = !status || ['DRAFT', 'REJECTED', 'ARCHIVED', 'EXPIRED'].includes(status);
  const objectValue = input.terminalId ?? '';

  return (
    <form ref={formRef} className="space-y-5" onSubmit={(e) => { e.preventDefault(); void onSave(); }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 rounded-full bg-teal-soft px-4 py-1.5 text-sm font-semibold text-teal-ink"><Icon size={18} weight="bold" /> {L.kind[kind]}</span>
        {!id ? <button type="button" onClick={() => setKind(null)} className="text-sm text-muted underline hover:text-ink">{t('changeKind')}</button> : null}
        {status ? <span className="ml-auto flex items-center gap-2 text-sm text-muted">{t('currentStatus')}: <ListingStatusPill status={status} /></span> : null}
      </div>

      {initial?.rejectReason && status === 'REJECTED' ? <Notice tone="err">{initial.rejectReason}</Notice> : null}

      {/* Asosiy */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.main')}</h2>
        {/* Kim nomidan: avto uchun shaxsan yoki tashkilot, temir yo'l uchun faqat tashkilot; tahrirda o'zgarmaydi */}
        {id ? (
          <p className="text-sm text-muted">{t('owner')}: <span className="font-semibold text-ink">{initial?.owner.type === 'org' ? initial.owner.name : t('ownerSelf')}</span></p>
        ) : truck ? (
          orgs?.length ? (
            <Field label={t('owner')} hint={t('ownerHint')}>
              <select className={INPUT} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">{t('ownerSelf')}</option>
                {orgs.map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
              </select>
            </Field>
          ) : orgs ? <p className="text-sm text-muted">{t('ownerPersonNote')}</p> : null
        ) : orgs && orgs.length === 0 ? (
          <Notice tone="warn">{t('noOrg')} <Link href="/dashboard/organization" className="ml-1 font-semibold underline">{t('createOrg')}</Link></Notice>
        ) : (
          <Field label={t('org')} required hint={t('orgRequired')} error={fieldErr('ownerType')}>
            <select className={INPUT} value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={!orgs}>
              {(orgs ?? []).map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('field.title')} required={isMust('title')} hint={t('hint.title')} error={fieldErr('title')}>
          <input className={INPUT} value={input.title} maxLength={140} placeholder={t('placeholder.title')} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        {!truck ? (
          <Field group label={t('field.deal')} required={isMust('deal')} error={fieldErr('deal')}>
            <div className="flex gap-2">
              {DEAL_KINDS.map((d) => (
                <button key={d} type="button" aria-pressed={input.deal === d} className={CHIP(input.deal === d)} onClick={() => set({ deal: d, priceUnit: null })}>{t(`deal.${d}`)}</button>
              ))}
            </div>
          </Field>
        ) : null}
        <Field label={t('field.description')} error={fieldErr('description')}>
          <textarea className={`${INPUT} min-h-28`} value={input.description ?? ''} maxLength={4000} placeholder={t('placeholder.description')} onChange={(e) => set({ description: strOr(e.target.value) })} />
        </Field>
      </section>

      {/* Texnik ma'lumot */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.specs')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === 'WAGON' ? (
            <Field label={t('field.wagonType')} required={isMust('wagonType')} error={fieldErr('wagonType')}>
              <select className={INPUT} value={input.wagonType ?? ''} onChange={(e) => set({ wagonType: strOr(e.target.value) })}>
                <option value="">{tc('none')}</option>
                {WAGON_TYPES.map((w) => <option key={w} value={w}>{L.wagonType[w]}</option>)}
              </select>
            </Field>
          ) : null}
          {truck ? (
            <Field label={t('field.truckType')} required={isMust('truckType')} error={fieldErr('truckType')}>
              <select className={INPUT} value={input.truckType ?? ''} onChange={(e) => set({ truckType: strOr(e.target.value) })}>
                <option value="">{tc('none')}</option>
                {TRUCK_TYPES.map((w) => <option key={w} value={w}>{L.truckType[w]}</option>)}
              </select>
            </Field>
          ) : null}
          {truck ? (
            <Field label={t('field.tonnage')} required={isMust('tonnage')} error={fieldErr('tonnage')}>
              <input type="number" min={1} max={100} className={`${INPUT} font-mono`} value={input.tonnage ?? ''} onChange={(e) => set({ tonnage: numOr(e.target.value) })} />
            </Field>
          ) : null}
          <Field label={t('field.model')} required={isMust('model')} recommended={rec('model')} error={fieldErr('model')}>
            <input className={INPUT} value={input.model ?? ''} maxLength={80} placeholder={t('placeholder.model')} onChange={(e) => set({ model: strOr(e.target.value) })} />
          </Field>
          <Field label={t('field.year')} required={isMust('year')} error={fieldErr('year')}>
            <input type="number" min={1950} max={new Date().getFullYear()} className={`${INPUT} font-mono`} value={input.year ?? ''} onChange={(e) => set({ year: numOr(e.target.value) })} />
          </Field>
          {!truck ? (
            <Field group label={t('field.condition')} required={isMust('condition')} error={fieldErr('condition')}>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button key={c} type="button" aria-pressed={input.condition === c} className={CHIP(input.condition === c)} onClick={() => set({ condition: c })}>{L.condition[c]}</button>
                ))}
              </div>
            </Field>
          ) : null}
          {!truck ? (
            <Field label={t('field.qty')} required={isMust('qty')} recommended={rec('qty')} error={fieldErr('qty')}>
              <input type="number" min={1} className={`${INPUT} font-mono`} value={input.qty} onChange={(e) => set({ qty: Number(e.target.value) || 1 })} />
            </Field>
          ) : null}
          {!truck ? (
            <Field label={t('field.capacityT')} required={isMust('capacityT')} recommended={rec('capacityT')} error={fieldErr('capacityT')}>
              <input type="number" min={1} className={`${INPUT} font-mono`} value={input.capacityT ?? ''} onChange={(e) => set({ capacityT: numOr(e.target.value) })} />
            </Field>
          ) : null}
          {truck ? (
            <Field label={t('field.fleetSize')} required={isMust('fleetSize')} recommended={rec('fleetSize')} error={fieldErr('fleetSize')}>
              <input type="number" min={1} className={`${INPUT} font-mono`} value={input.fleetSize ?? ''} onChange={(e) => set({ fleetSize: numOr(e.target.value) })} />
            </Field>
          ) : null}
        </div>
      </section>

      {/* Narx */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.price')}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={askPrice} onChange={(e) => { setAskPrice(e.target.checked); if (e.target.checked) set({ priceTiyin: null, priceUnit: null }); }} className="h-4 w-4 accent-teal" />
          {t('askPrice')}
        </label>
        {!askPrice ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('priceSom')} recommended={rec('priceTiyin')} error={fieldErr('priceTiyin')}>
              <input type="number" min={1} step={1} className={`${INPUT} font-mono`} value={input.priceTiyin == null ? '' : Math.round(input.priceTiyin / 100)} onChange={(e) => { const n = numOr(e.target.value); set({ priceTiyin: n == null ? null : Math.round(n * 100) }); }} />
            </Field>
            <Field label={t('field.priceUnit')} error={fieldErr('priceUnit')}>
              <select className={INPUT} value={input.priceUnit ?? ''} onChange={(e) => set({ priceUnit: (e.target.value || null) as PriceUnit | null })}>
                <option value="">{tc('none')}</option>
                {units.map((u) => <option key={u} value={u}>{L.priceUnit[u]}</option>)}
              </select>
            </Field>
          </div>
        ) : null}
      </section>

      {/* Joylashuv */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.place')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.regionCode')} required={isMust('regionCode')} hint={t('hint.regionCode')} error={fieldErr('regionCode')}>
            <select className={INPUT} value={input.regionCode} onChange={(e) => set({ regionCode: e.target.value as RegionCode })}>
              {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
            </select>
          </Field>
          {!truck ? (
            <Field label={t('field.terminalId')} recommended={rec('terminalId')} hint={t('hint.terminalId')} error={fieldErr('terminalId')}>
              {/* Shahobcha ham terminal, shuning uchun bitta qiymat; guruhlar faqat tanlashni osonlashtiradi */}
              <select className={INPUT} value={objectValue} onChange={(e) => set({ terminalId: e.target.value || null })}>
                <option value="">{t('objectNone')}</option>
                {/* Avto va temir yo'l alohida guruh: bitta ro'yxatda ular aralashib ketardi */}
                {road.length ? <optgroup label={t('objectTerminals')}>{road.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup> : null}
                {rail.length ? <optgroup label={t('objectSidings')}>{rail.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup> : null}
              </select>
            </Field>
          ) : null}
        </div>
      </section>

      {/* Avto: hududlar va yo'nalishlar */}
      {truck ? (
        <section className="space-y-4 rounded-card border border-line bg-white p-5">
          <h2 className="font-semibold">{t('section.coverage')}</h2>
          <Field group label={t('field.serviceRegions')} required={isMust('serviceRegions')} hint={t('hint.serviceRegions')} error={fieldErr('serviceRegions')}>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => {
                const on = input.serviceRegions.includes(r);
                return <button key={r} type="button" aria-pressed={on} className={CHIP(on)} onClick={() => set({ serviceRegions: on ? input.serviceRegions.filter((x) => x !== r) : [...input.serviceRegions, r] })}>{tr(r)}</button>;
              })}
            </div>
          </Field>
          <Field group label={t('field.routes')} recommended={rec('routes')} error={fieldErr('routes')}>
            <ul className="space-y-2">
              {input.routes.map((rt, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <select aria-label={t('routeFrom')} className={`${INPUT} sm:w-auto sm:flex-1`} value={rt.from} onChange={(e) => set({ routes: input.routes.map((x, j) => (j === i ? { ...x, from: e.target.value as RegionCode } : x)) })}>
                    {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
                  </select>
                  <span className="font-mono text-muted">&gt;</span>
                  <select aria-label={t('routeTo')} className={`${INPUT} sm:w-auto sm:flex-1`} value={rt.to} onChange={(e) => set({ routes: input.routes.map((x, j) => (j === i ? { ...x, to: e.target.value as RegionCode } : x)) })}>
                    {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
                  </select>
                  <button type="button" onClick={() => set({ routes: input.routes.filter((_, j) => j !== i) })} className="text-sm text-red-700 underline">{t('remove')}</button>
                </li>
              ))}
            </ul>
            {input.routes.length < LISTING.maxRoutes ? (
              <button type="button" onClick={() => set({ routes: [...input.routes, { from: input.regionCode, to: REGIONS.find((r) => r !== input.regionCode) ?? input.regionCode }] })} className={`${BTN_GHOST} mt-2`}>{t('addRoute')}</button>
            ) : null}
          </Field>
        </section>
      ) : null}

      {/* Rasmlar */}
      <section className="space-y-3 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">
          {t('section.photos')} {isMust('photos') ? <span aria-hidden className="text-amber">*</span> : isShould('photos') ? <span className="text-xs font-normal text-muted">{tc('recommended')}</span> : null}
        </h2>
        <PhotoUpload photos={input.photos} onChange={(p) => set({ photos: p })} error={fieldErr('photos')} />
        <p className="text-xs text-muted">{t('hint.photos', { max: LISTING.maxPhotos })}</p>
      </section>

      {/* Aloqa */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('section.contact')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.contactPhone')} hint={t('hint.contactPhone')} error={fieldErr('contactPhone')}>
            <PhoneField className={`${INPUT} font-mono`} value={input.contactPhone ?? ''} placeholder={t('placeholder.contactPhone')} onChange={(v) => set({ contactPhone: strOr(v) })} />
          </Field>
        </div>
      </section>

      {warnings.length ? (
        <Notice tone="warn">
          <p className="font-semibold">{t('warningsTitle')}</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => <li key={w.field}>{t('warningMissing', { field: t(`field.${w.field}`) })}</li>)}
          </ul>
        </Notice>
      ) : null}
      {tried && errors.length ? <Notice tone="err">{t('errorsTitle')}: {errors.map((e) => t(`field.${e.field}`)).join(', ')}</Notice> : null}
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy !== null} className={BTN_GHOST}>{busy === 'save' ? tc('saving') : t('saveDraft')}</button>
        {canPublish ? (
          <button type="button" disabled={busy !== null} onClick={onPublish} className={BTN_PRIMARY}>{busy === 'publish' ? t('busy') : t('publish')}</button>
        ) : null}
        <Link href="/dashboard/listings" className="ml-auto text-sm text-muted underline hover:text-ink">{t('backToList')}</Link>
      </div>
    </form>
  );
}
