'use client';
// Bron: 1) yuk (operatsiya, stansiya, yuk, vazn, vagon) -> /quote, 2) 14 kunlik slot jadvali -> hold, 3) xulosa -> POST /orders (Idempotency-Key).
// MainButton qadamlarni yuritadi. Tashkilot: birinchi CLIENT/FORWARDER yoki egalik; bo'lmasa nom bilan SHIPPER tashkilot yaratiladi.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { OPERATIONS, type Operation } from '@yuksaroy/domain';
import { useRouter } from '@/i18n/navigation';
import { ApiError, api, authHeaders, post } from '@/lib/api';
import { som } from '@/lib/format';
import type { Hold, Order, QuoteOffer, QuoteResponse, Slot, TerminalDetail } from '@/lib/types';
import type { Membership } from '@/lib/types-kabinet';
import { CargoSearch, type CargoPick } from '@/components/catalog/CargoSearch';
import { StationSearch, type StationPick } from '@/components/catalog/StationSearch';
import { SlotGrid } from '@/components/order/SlotGrid';
import { SlaTimer } from '@/components/order/SlaTimer';
import { PriceLines, slotLabel } from '@/components/order/bits';
import { haptic, useClosingConfirmation, useMainButton } from '@/components/tg/TgProvider';
import { CARD, CHIP, Err, INPUT, Row, Skeleton } from '@/components/tg/bits';

const STEPS = ['cargo', 'slot', 'confirm'] as const;
const shipper = (m: Membership) => m.isOwner || m.roles.includes('CLIENT') || m.roles.includes('FORWARDER');

export default function TgBookPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('tg.book');
  const locale = useLocale();
  const tc = useTranslations('tg.common');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [terminal, setTerminal] = useState<TerminalDetail | null>(null);
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<Operation>('UNLOAD');
  const [station, setStation] = useState<StationPick | null>(null);
  const [cargo, setCargo] = useState<CargoPick | null>(null);
  const [weightT, setWeightT] = useState('62');
  const [wagons, setWagons] = useState('1');
  const [offers, setOffers] = useState<QuoteOffer[]>([]);
  const [offer, setOffer] = useState<QuoteOffer | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [note, setNote] = useState('');
  const [wagonNumbers, setWagonNumbers] = useState('');
  const idemKey = useRef<string | null>(null);
  const weightKg = Math.round(Number(weightT.replace(',', '.')) * 1000);
  useClosingConfirmation(step > 0);

  useEffect(() => {
    api<TerminalDetail>(`/terminals/${slug}`).then((x) => { setTerminal(x); setStation(x.station); }).catch(() => setErr(t('err.STATION')));
    api<Membership[]>('/orgs/mine').then((ms) => { const s = ms.filter(shipper); setOrgs(s); setOrgId(s[0]?.orgId ?? ''); }).catch(() => setOrgs([]));
  }, [slug, t]);

  // API kodi tarjimada bo'lsa shu, bo'lmasa umumiy matn
  const fail = (e: unknown) => { const code = e instanceof ApiError ? String(e.body?.code ?? '') : ''; setErr(code && t.has(`err.${code}`) ? t(`err.${code}`) : tc('failed')); };

  const releaseHold = useCallback(async (id: string) => { try { await api(`/holds/${id}`, { method: 'DELETE' }); } catch { /* allaqachon bo'shagan */ } }, []);
  const refreshSlots = useCallback(async (o: QuoteOffer | null = offer) => { if (o) setSlots(await api<Slot[]>(`/terminals/${o.terminal.id}/slots`).catch(() => [])); }, [offer]);

  async function toSlots() {
    setErr(null);
    if (!station) return setErr(t('err.STATION'));
    if (!(weightKg > 0)) return setErr(t('err.WEIGHT'));
    setBusy(true);
    try {
      const r = await post<QuoteResponse>('/quote', { stationId: station.id, operation, cargoCode: cargo?.code, weightKg, wagonCount: Number(wagons) || 1, services: [] });
      const mine = r.offers.find((o) => o.terminal.slug === slug) ?? null;
      setOffers(r.offers);
      if (!mine && !r.offers.length) return setErr(t('noOffer'));
      haptic();
      await pickOffer(mine ?? r.offers[0]!);
      setStep(1);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function pickOffer(o: QuoteOffer) {
    setOffer(o); setSlots([]);
    if (hold) { await releaseHold(hold.id); setHold(null); }
    await refreshSlots(o);
  }
  async function pickSlot(s: Slot) {
    setErr(null); setBusy(true);
    try {
      if (hold) await releaseHold(hold.id);
      setHold(await post<Hold>(`/slots/${s.id}/hold`, orgId ? { orgId } : {}));
      haptic();
      await refreshSlots();
    } catch (e) { fail(e); setHold(null); await refreshSlots(); } finally { setBusy(false); }
  }
  async function extend() {
    if (!hold) return;
    setBusy(true);
    try { const r = await post<{ holdExpiresAt: string }>(`/holds/${hold.id}/extend`, {}); setHold({ ...hold, holdExpiresAt: r.holdExpiresAt }); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  const onHoldExpired = useCallback(() => { setHold(null); setErr(t('err.HOLD_EXPIRED')); void refreshSlots(); }, [refreshSlots, t]);

  async function submit() {
    if (!offer || !hold) return;
    setErr(null); setBusy(true);
    // Noto'g'ri vagon raqami jimgina tushib qolmasin
    const wagonList = wagonNumbers.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    const badWagons = wagonList.filter((x) => !/^\d{8}$/.test(x));
    if (badWagons.length) { setBusy(false); return setErr(t('err.wagonNumbers', { list: badWagons.join(', ') })); }
    idemKey.current ??= crypto.randomUUID();
    try {
      const o = await post<Order>('/orders', {
        orgId: orgId || undefined, bookingId: hold.id, operation, cargoCode: cargo?.code, weightKg, wagonCount: Number(wagons) || 1, note: note.trim() || undefined,
        wagonNumbers: wagonList,
      }, { 'Idempotency-Key': idemKey.current });
      haptic('medium');
      router.replace(`/tg/orders/${o.no}`);
    } catch (e) {
      fail(e); idemKey.current = null; setBusy(false);
      if (e instanceof ApiError && ['HOLD_EXPIRED', 'SLOT_FULL', 'SLOT_PAST'].includes(e.body?.code)) { setHold(null); await refreshSlots(); }
    }
  }

  // Sahifadan chiqishda ushlab turilgan slot bo'shatiladi
  useEffect(() => {
    const h = hold?.id;
    if (!h) return;
    const onLeave = () => { void fetch(`/api/v1/holds/${h}`, { method: 'DELETE', credentials: 'include', keepalive: true, headers: authHeaders() }); };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [hold?.id]);

  const main = step === 0 ? { text: busy ? t('quoting') : t('quote'), onClick: () => void toSlots(), disabled: !orgs }
    : step === 1 ? { text: t('next'), onClick: () => { haptic(); setStep(2); }, disabled: !hold }
    : { text: busy ? t('sending') : t('submit'), onClick: () => void submit(), disabled: !hold };
  useMainButton({ ...main, busy });
  const selectedSlot = useMemo(() => slots.find((s) => s.id === hold?.slotId) ?? null, [slots, hold]);

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-4">
      <p className="text-xs text-muted">{terminal?.name ?? '…'}</p>
      <h1 className="font-display mt-0.5 text-xl font-bold">{t('title')}</h1>
      <ol className="mt-3 flex gap-1.5" aria-label={t('title')}>
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={`w-full rounded-full px-2 py-1.5 text-xs font-semibold ${i === step ? 'bg-navy text-white' : i < step ? 'bg-teal-soft text-teal-ink' : 'bg-line/60 text-muted'}`}>{i + 1}. {t(`steps.${s}`)}</button>
          </li>
        ))}
      </ol>
      {err ? <div className="mt-3"><Err>{err}</Err></div> : null}

      {step === 0 ? (
        <form onSubmit={(e) => { e.preventDefault(); void toSlots(); }} className="mt-4 space-y-4">
          {orgs === null ? <Skeleton n={1} h="h-12" /> : orgs.length === 0 ? (
            <p className={`${CARD} p-4 text-sm`}>{t('orgAuto')}</p>
          ) : orgs.length > 1 ? (
            <label className="block text-sm font-semibold">{t('org')}
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`${INPUT} mt-1 font-normal`}>{orgs.map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}</select>
            </label>
          ) : null}
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">{t('operation')}</legend>
            <div className="grid grid-cols-2 gap-2">{OPERATIONS.map((op) => <button key={op} type="button" aria-pressed={operation === op} onClick={() => { haptic(); setOperation(op); }} className={CHIP(operation === op)}>{t(op)}</button>)}</div>
          </fieldset>
          <label className="block text-sm font-semibold">{t('station')}<div className="mt-1 font-normal"><StationSearch value={station} onChange={setStation} inputClassName={INPUT} hideCode /></div></label>
          <label className="block text-sm font-semibold">{t('cargo')}<div className="mt-1 font-normal"><CargoSearch value={cargo} onChange={setCargo} inputClassName={INPUT} /></div></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">{t('weight')}<input inputMode="decimal" value={weightT} onChange={(e) => setWeightT(e.target.value)} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
            <label className="block text-sm font-semibold">{t('wagons')}<input inputMode="numeric" value={wagons} onChange={(e) => setWagons(e.target.value.replace(/\D/g, ''))} className={`${INPUT} mt-1 font-mono font-normal`} /></label>
          </div>
          <button type="submit" className="sr-only">{t('quote')}</button>
        </form>
      ) : null}

      {step === 1 && offer ? (
        <div className="mt-4 space-y-3">
          <div className={`${CARD} p-4`}>
            <div className="flex items-baseline justify-between gap-3"><p className="min-w-0 truncate font-bold">{offer.terminal.name}</p><span className="font-mono font-semibold tabular-nums">{som(offer.totalTiyin, locale)}</span></div>
            {offers.length > 1 ? (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-teal-ink">{t('otherOffers')} ({offers.length - 1})</summary>
                <ul className="mt-2 space-y-1">{offers.filter((o) => o.terminal.id !== offer.terminal.id).map((o) => <li key={o.terminal.id}><button type="button" onClick={() => void pickOffer(o)} className="flex w-full min-h-11 items-center justify-between rounded-xl border border-line px-3 text-left"><span className="min-w-0 truncate">{o.terminal.name}</span><span className="font-mono tabular-nums">{som(o.totalTiyin, locale)}</span></button></li>)}</ul>
              </details>
            ) : null}
          </div>
          <div className={`${CARD} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{t('slot')}</h2>
              {hold ? <span className="flex items-center gap-2 rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber-ink">{t('held')} <SlaTimer until={hold.holdExpiresAt} onExpire={onHoldExpired} /><button type="button" onClick={extend} disabled={busy} className="underline">{t('extend')}</button></span> : null}
            </div>
            <div className="mt-3"><SlotGrid slots={slots} selectedId={hold?.slotId ?? null} onSelect={pickSlot} busy={busy} /></div>
          </div>
        </div>
      ) : null}

      {step === 2 && offer && hold ? (
        <div className="mt-4 space-y-3">
          <div className={`${CARD} p-4`}>
            <h2 className="font-bold">{offer.terminal.name}</h2>
            <dl className="mt-2">
              <Row k={t('operation')} v={t(operation)} />
              <Row k={t('summary.cargo')} v={cargo?.name ?? t('summary.noCargo')} />
              <Row k={t('summary.weight')} v={`${(weightKg / 1000).toLocaleString('ru-RU')} t`} mono />
              <Row k={t('summary.wagons')} v={wagons} mono />
              {selectedSlot ? <Row k={t('summary.time')} v={slotLabel(selectedSlot.startsAt, selectedSlot.endsAt)} /> : null}
            </dl>
            <div className="mt-2 border-t border-line pt-1"><PriceLines items={offer.lines} subtotalTiyin={offer.subtotalTiyin} commissionPct={offer.commissionPct} commissionTiyin={offer.commissionTiyin} commissionPayer={offer.commissionPayer} totalTiyin={offer.totalTiyin} /></div>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">{t('held')}: <SlaTimer until={hold.holdExpiresAt} onExpire={onHoldExpired} /></p>
          </div>
          <label className="block text-sm font-semibold">{t('wagonNumbers')}<input value={wagonNumbers} onChange={(e) => setWagonNumbers(e.target.value)} placeholder="62031845 62031846" className={`${INPUT} mt-1 font-mono font-normal`} /></label>
          <label className="block text-sm font-semibold">{t('note')}<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={`${INPUT} mt-1 font-normal`} /></label>
          <p className="text-xs text-muted">{t('slaNote')}</p>
        </div>
      ) : null}
    </main>
  );
}
