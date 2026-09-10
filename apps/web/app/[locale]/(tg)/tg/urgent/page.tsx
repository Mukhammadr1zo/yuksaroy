'use client';
// Shoshilinch so'rov: tur plitkalari, viloyat, stansiya, vagon, tavsif, telefon (profil raqami oldindan) -> POST /urgent. Pastda mening so'rovlarim.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CraneIcon, QuestionIcon, TrainIcon, WrenchIcon } from '@phosphor-icons/react';
import { REGIONS, URGENT_KINDS, type UrgentKind } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { asList, type UrgentRequest } from '@/lib/types-urgent';
import { UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';
import { PhoneField } from '@/components/ui/fields';
import { haptic, useClosingConfirmation, useMainButton, useTg } from '@/components/tg/TgProvider';
import { CARD, Empty, Err, INPUT, PhoneCard, Skeleton } from '@/components/tg/bits';

const ICON: Record<UrgentKind, typeof TrainIcon> = { LOCO_CALL: TrainIcon, WAGON_REPAIR: WrenchIcon, CRANE: CraneIcon, OTHER: QuestionIcon };
type Draft = { kind: UrgentKind; regionCode: string; stationName: string; wagonCount: string; description: string; contactPhone: string };

export default function TgUrgentPage() {
  const t = useTranslations('tg.urgent');
  const tf = useTranslations('urgent.mine');
  const tc = useTranslations('tg.common');
  const tr = useTranslations('region');
  const L = useUrgentLabels();
  const { me, needsPhone } = useTg();
  const router = useRouter();
  const [d, setD] = useState<Draft>({ kind: 'LOCO_CALL', regionCode: '', stationName: '', wagonCount: '', description: '', contactPhone: '' });
  const [items, setItems] = useState<UrgentRequest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => { api<unknown>('/urgent?scope=mine').then((r) => setItems(asList<UrgentRequest>(r))).catch(() => setItems([])); }, []);
  useEffect(() => { if (me?.phone) setD((x) => ({ ...x, contactPhone: x.contactPhone || me.phone || '' })); }, [me?.phone]);
  const dirty = !!(d.regionCode || d.description || d.stationName);
  useClosingConfirmation(dirty);
  const valid = !!d.regionCode && d.description.trim().length >= 5 && d.contactPhone.trim().length >= 7;

  async function submit() {
    if (!valid) return;
    setBusy(true); setErr(null);
    try {
      const r = await post<UrgentRequest>('/urgent', { kind: d.kind, regionCode: d.regionCode, stationName: d.stationName.trim() || undefined, wagonCount: d.wagonCount ? Number(d.wagonCount) : undefined, description: d.description.trim(), contactPhone: d.contactPhone.trim() });
      haptic('medium');
      router.replace(`/tg/urgent/${r.id}`);
    } catch { setErr(tc('failed')); setBusy(false); }
  }
  useMainButton({ text: busy ? tf('form.sending') : tf('form.submit'), onClick: () => void submit(), disabled: !valid, busy });

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('lead')}</p>
      {needsPhone ? <div className="mt-3"><PhoneCard /></div> : null}

      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-4 space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{tf('form.kind')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {URGENT_KINDS.map((k) => { const Icon = ICON[k]; const on = d.kind === k; return (
              <button key={k} type="button" aria-pressed={on} onClick={() => { haptic(); set({ kind: k }); }} className={`flex min-h-[64px] items-center gap-2 rounded-card border p-3 text-left text-sm font-semibold ${on ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white'}`}>
                <Icon size={22} weight="duotone" aria-hidden="true" /><span>{L.kind[k]}</span>
              </button>
            ); })}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">{tf('form.region')}
          <select value={d.regionCode} required onChange={(e) => set({ regionCode: e.target.value })} className={`${INPUT} mt-1 font-normal`}>
            <option value="">{tf('form.regionPick')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <label className="block text-sm font-semibold">{tf('form.station')}<input value={d.stationName} maxLength={120} placeholder={tf('form.stationPh')} onChange={(e) => set({ stationName: e.target.value })} className={`${INPUT} mt-1 font-normal`} /></label>
          <label className="block text-sm font-semibold">{tf('form.wagons')}<input inputMode="numeric" value={d.wagonCount} onChange={(e) => set({ wagonCount: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
        </div>
        <label className="block text-sm font-semibold">{tf('form.description')}<textarea value={d.description} required maxLength={2000} rows={3} placeholder={tf('form.descriptionPh')} onChange={(e) => set({ description: e.target.value })} className={`${INPUT} mt-1 font-normal`} /></label>
        <label className="block text-sm font-semibold">{tf('form.phone')}<PhoneField required value={d.contactPhone} onChange={(contactPhone) => set({ contactPhone })} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
        {err ? <Err>{err}</Err> : null}
        <button type="submit" className="sr-only">{tf('form.submit')}</button>
      </form>

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between gap-3"><h2 className="text-sm font-bold">{t('mine')}</h2><Link href="/tg/urgent/offers" className="text-xs font-semibold text-teal-ink">{t('provider')}</Link></div>
        {!items ? <Skeleton n={2} h="h-16" /> : items.length === 0 ? <Empty>{tf('empty')}</Empty> : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={`/tg/urgent/${r.id}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{r.no}</span><UrgentStatusPill status={r.status} /><span className="ml-auto font-mono text-xs text-muted">{t('offersCount', { count: r.offersCount ?? r.offers?.length ?? 0 })}</span></div>
                  <p className="mt-1 truncate text-sm">{L.kind[r.kind] ?? r.kind} · {L.region(r.regionCode)}{r.stationName ? ` · ${r.stationName}` : ''}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">{uzDateTime(r.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
