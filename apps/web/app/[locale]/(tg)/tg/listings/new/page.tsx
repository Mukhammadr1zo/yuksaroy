'use client';
// Tez e'lon: TRUCK shaxsan (orgId yo'q), faqat majburiy maydonlar + ixtiyoriy narx va kamera rasmi (input capture). Temir yo'l turlari to'liq saytga.
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrainIcon, TruckIcon } from '@phosphor-icons/react';
import { LISTING_LABELS, PRICE_UNITS_FOR, REGIONS, TRUCK_TYPES, type ListingStatus, type PriceUnit, type RegionCode } from '@yuksaroy/domain';
import { useRouter } from '@/i18n/navigation';
import { ApiError, post } from '@/lib/api';
import type { OwnerListing } from '@/lib/types-kabinet';
import { uploadOne } from '@/components/kabinet/PhotoUpload';
import { haptic, useClosingConfirmation, useMainButton, useTg } from '@/components/tg/TgProvider';
import { CARD, CHIP, Err, INPUT, PhoneCard, useLang } from '@/components/tg/bits';

export default function TgNewListingPage() {
  const t = useTranslations('tg.listings');
  const tf = useTranslations('tg.listings.form');
  const tc = useTranslations('tg.common');
  const tr = useTranslations('region');
  const lang = useLang();
  const L = LISTING_LABELS[lang];
  const { tg, me, needsPhone } = useTg();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'TRUCK' | null>(null);
  const [title, setTitle] = useState('');
  const [truckType, setTruckType] = useState('');
  const [tonnage, setTonnage] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [regions, setRegions] = useState<RegionCode[]>([]);
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<PriceUnit>('PER_KM');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<ListingStatus | null>(null);
  const dirty = !!(title || truckType || tonnage || regionCode);
  useClosingConfirmation(dirty && !done);
  const serviceRegions = regionCode ? [regionCode as RegionCode, ...regions.filter((r) => r !== regionCode)] : regions;
  const valid = title.trim().length >= 3 && !!truckType && Number(tonnage) >= 1 && Number(tonnage) <= 100 && !!regionCode;

  async function pick(f: File | undefined) {
    if (!f) return;
    setUploading(true); setErr(null);
    const r = await uploadOne(f).catch((): { url?: string; code?: string } => ({ code: 'UPLOAD' }));
    setUploading(false);
    if (file.current) file.current.value = '';
    if (r.url) setPhotos((p) => [...p, r.url!]); else setErr(tf('err.UPLOAD'));
  }
  async function submit() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    try {
      const l = await post<OwnerListing>('/listings', {
        kind: 'TRUCK', title: title.trim(), truckType, tonnage: Number(tonnage), regionCode, serviceRegions, photos,
        priceTiyin: price ? Math.round(Number(price) * 100) : null, priceUnit: price ? unit : null, contactPhone: me?.phone ?? null,
      });
      const p = await post<OwnerListing>(`/listings/${l.id}/publish`, {});
      haptic('medium'); setDone(p.status);
      window.setTimeout(() => router.replace('/tg/listings'), 1500);
    } catch (e) { const code = e instanceof ApiError ? String(e.body?.code ?? '') : ''; setErr(code && tf.has(`err.${code}`) ? tf(`err.${code}`) : tc('failed')); setBusy(false); }
  }
  useMainButton({ text: busy ? tf('sending') : tf('submit'), onClick: () => void submit(), show: kind === 'TRUCK' && !done, disabled: !valid, busy });
  const openSite = () => { haptic(); tg?.openLink(`${window.location.origin}/dashboard/listings/new`); };

  if (done) return <main className="mx-auto max-w-md px-4 py-10 text-center"><p className="rounded-card border border-teal/30 bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{tf(done === 'ACTIVE' ? 'done.ACTIVE' : 'done.PENDING_REVIEW')}</p></main>;

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-4">
      <h1 className="font-display text-xl font-bold">{t('new')}</h1>
      {!kind ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">{t('kindTitle')}</p>
          <button type="button" onClick={() => { haptic(); setKind('TRUCK'); }} className={`${CARD} flex w-full items-center gap-3 p-4 text-left active:bg-sand`}>
            <TruckIcon size={28} weight="duotone" className="shrink-0 text-teal" aria-hidden="true" />
            <span><span className="block font-bold">{t('truck')}</span><span className="block text-xs text-muted">{t('truckHint')}</span></span>
          </button>
          <button type="button" onClick={openSite} className={`${CARD} flex w-full items-center gap-3 p-4 text-left active:bg-sand`}>
            <TrainIcon size={28} weight="duotone" className="shrink-0 text-navy" aria-hidden="true" />
            <span><span className="block font-bold">{L.kind.SHUNTING_LOCO} · {L.kind.ELECTRIC_LOCO} · {L.kind.WAGON}</span><span className="block text-xs text-muted">{t('railHint')}</span></span>
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-4 space-y-4">
          {needsPhone ? <PhoneCard /> : null}
          <label className="block text-sm font-semibold">{tf('title')}<input value={title} required minLength={3} maxLength={120} placeholder={tf('titlePh')} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} mt-1 font-normal`} /></label>
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <label className="block text-sm font-semibold">{tf('truckType')}
              <select value={truckType} required onChange={(e) => setTruckType(e.target.value)} className={`${INPUT} mt-1 font-normal`}><option value="">·</option>{TRUCK_TYPES.map((w) => <option key={w} value={w}>{L.truckType[w]}</option>)}</select>
            </label>
            <label className="block text-sm font-semibold">{tf('tonnage')}<input inputMode="numeric" required value={tonnage} onChange={(e) => setTonnage(e.target.value.replace(/\D/g, '').slice(0, 3))} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
          </div>
          <label className="block text-sm font-semibold">{tf('region')}
            <select value={regionCode} required onChange={(e) => setRegionCode(e.target.value)} className={`${INPUT} mt-1 font-normal`}><option value="">{tf('regionPick')}</option>{REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}</select>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">{tf('serviceRegions')}</legend>
            <p className="mb-1.5 text-xs text-muted">{tf('serviceRegionsHint')}</p>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => { const on = serviceRegions.includes(r); const base = r === regionCode; return <button key={r} type="button" aria-pressed={on} disabled={base} onClick={() => { haptic(); setRegions(on ? regions.filter((x) => x !== r) : [...regions, r]); }} className={`${CHIP(on)} min-h-10 px-3 text-xs`}>{tr(r)}</button>; })}
            </div>
          </fieldset>
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <label className="block text-sm font-semibold">{tf('price')}<input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
            <label className="block text-sm font-semibold">{tf('unit')}
              <select value={unit} onChange={(e) => setUnit(e.target.value as PriceUnit)} className={`${INPUT} mt-1 font-normal`}>{PRICE_UNITS_FOR.TRUCK.map((u) => <option key={u} value={u}>{L.priceUnit[u]}</option>)}</select>
            </label>
          </div>
          <div>
            <p className="text-sm font-semibold">{tf('photos')}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p} className="relative h-20 w-24 overflow-hidden rounded-xl border border-line bg-sand">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label={tf('remove')} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs font-semibold text-red-700">x</button>
                </div>
              ))}
              <button type="button" disabled={uploading || photos.length >= 10} onClick={() => file.current?.click()} className="flex h-20 w-24 items-center justify-center rounded-xl border border-dashed border-line bg-white text-xs font-semibold text-muted disabled:opacity-60">{uploading ? tf('uploading') : tf('addPhoto')}</button>
            </div>
            <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0])} />
          </div>
          {err ? <Err>{err}</Err> : null}
          <button type="submit" className="sr-only">{tf('submit')}</button>
        </form>
      )}
    </main>
  );
}
