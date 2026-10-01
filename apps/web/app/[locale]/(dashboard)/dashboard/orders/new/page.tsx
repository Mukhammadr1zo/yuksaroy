'use client';
// Buyurtma vizardi (3.1): 1) yuk va yo'nalish → 2) terminal va slot → 3) xulosa va tasdiq.
// Narx serverda hisoblanadi; slot 10 daqiqaga ushlab turiladi; buyurtma Idempotency-Key bilan yuboriladi.
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OPERATIONS, SERVICE_CODES, type Operation, type ServiceCode } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import { num, som, stationName} from '@/lib/format';
import type { Hold, Order, QuoteOffer, QuoteResponse, Slot, TerminalDetail } from '@/lib/types';
import { CargoSearch, type CargoPick } from '@/components/catalog/CargoSearch';
import { StationSearch, type StationPick } from '@/components/catalog/StationSearch';
import { SlotGrid } from '@/components/order/SlotGrid';
import { SlaTimer } from '@/components/order/SlaTimer';
import { PriceLines, slotLabel } from '@/components/order/bits';

type Membership = { orgId: string; roles: string[]; isOwner: boolean; org: { id: string; kind: string; name: string } };
const EXTRAS: ServiceCode[] = SERVICE_CODES.filter((s) => s !== 'LOAD' && s !== 'UNLOAD');
const DRAFT = 'ys-order-draft';
const STEPS = ['cargo', 'terminal', 'summary'] as const;

export default function NewOrderPage() {
  const t = useTranslations('dashboard2.order');
  return <Suspense fallback={<div className="mx-auto max-w-4xl px-6 py-10 text-muted">{t('loading')}</div>}><Wizard /></Suspense>;
}

function Wizard() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard2.order');
  const ts = useTranslations('service');
  const ta = useTranslations('a11y');
  const [step, setStep] = useState(0);
  // Terminal sahifasidan kelgan bo'lsa (?terminal=slug) stansiya va terminal oldindan tanlanadi
  const preset = useSearchParams().get('terminal');
  const [orgs, setOrgs] = useState<Membership[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Tekshiruv yiqilganda fokus shu maydonlarga ko'chadi. Bu yerda effekt kerak emas:
  // xato aniq bitta maydonga tegishli va maydon allaqachon chizilgan.
  const stationBox = useRef<HTMLDivElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const wagonRef = useRef<HTMLInputElement>(null);

  // 1-qadam
  const [orgId, setOrgId] = useState('');
  const [operation, setOperation] = useState<Operation>('LOAD');
  const [station, setStation] = useState<StationPick | null>(null);
  const [cargo, setCargo] = useState<CargoPick | null>(null);
  const [weightT, setWeightT] = useState('62');
  const [wagons, setWagons] = useState('1');
  const [extras, setExtras] = useState<ServiceCode[]>([]);
  const [storageDays, setStorageDays] = useState('1');

  // 2-qadam
  const [offers, setOffers] = useState<QuoteOffer[]>([]);
  const [offer, setOffer] = useState<QuoteOffer | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);

  // 3-qadam
  const [note, setNote] = useState('');
  const [wagonNumbers, setWagonNumbers] = useState('');
  const idemKey = useRef<string | null>(null);

  const weightKg = Math.round(Number(weightT.replace(',', '.')) * 1000);

  useEffect(() => {
    api<Membership[]>('/orgs/mine')
      .then((ms) => {
        const shippers = ms.filter((m) => m.isOwner || m.roles.includes('CLIENT') || m.roles.includes('FORWARDER'));
        setOrgs(shippers);
        setOrgId((v) => v || shippers[0]?.orgId || '');
      })
      .catch(() => router.replace('/login'));
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if (d) { setOperation(d.operation ?? 'LOAD'); setStation(d.station ?? null); setCargo(d.cargo ?? null); setWeightT(d.weightT ?? '62'); setWagons(d.wagons ?? '1'); setExtras(d.extras ?? []); }
    } catch { /* draft o'qilmadi */ }
    if (preset) api<TerminalDetail>(`/terminals/${preset}`).then((t) => setStation(t.station)).catch(() => {});
  }, [router, preset]);

  // 1-qadam qoralamasi saqlanadi (yangilashda yo'qolmasin)
  useEffect(() => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ operation, station, cargo, weightT, wagons, extras })); } catch { /* private mode */ }
  }, [operation, station, cargo, weightT, wagons, extras]);

  const releaseHold = useCallback(async (id: string) => { try { await api(`/holds/${id}`, { method: 'DELETE' }); } catch { /* allaqachon bo'shagan */ } }, []);

  // Sahifadan chiqishda ushlab turilgan slot bo'shatiladi
  useEffect(() => {
    const h = hold?.id;
    if (!h) return;
    const onLeave = () => { void fetch(`/api/v1/holds/${h}`, { method: 'DELETE', credentials: 'include', keepalive: true }); };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [hold?.id, releaseHold]);

  async function toStep2(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!station) { setErr(t('err.selectStation')); stationBox.current?.querySelector('input')?.focus(); return; }
    if (!(weightKg > 0)) { setErr(t('err.enterWeight')); weightRef.current?.focus(); return; }
    setBusy(true);
    try {
      const r = await post<QuoteResponse>('/quote', {
        stationId: station.id, operation, cargoCode: cargo?.code, weightKg,
        wagonCount: Number(wagons) || 1, storageDays: extras.includes('STORAGE') ? Number(storageDays) || 1 : undefined, services: extras,
      });
      setOffers(r.offers);
      if (!r.offers.length) setErr(t('err.noOffers'));
      else {
        setOffer(null); setSlots([]); setStep(1);
        const p = preset ? r.offers.find((o) => o.terminal.slug === preset) : null;
        if (p) void pickOffer(p); // terminal sahifasidan kelgan bo'lsa slot jadvali darrov ochiladi
      }
    } catch (e) { setErr(msg(e, t)); } finally { setBusy(false); }
  }

  async function pickOffer(o: QuoteOffer) {
    setErr(null); setOffer(o); setSlots([]);
    if (hold) { await releaseHold(hold.id); setHold(null); }
    setBusy(true);
    try { setSlots(await api<Slot[]>(`/terminals/${o.terminal.id}/slots`)); }
    catch (e) { setErr(msg(e, t)); } finally { setBusy(false); }
  }

  async function pickSlot(s: Slot) {
    setErr(null); setBusy(true);
    try {
      if (hold) await releaseHold(hold.id);
      setHold(await post<Hold>(`/slots/${s.id}/hold`, orgId ? { orgId } : {}));
      await refreshSlots(); // ushlangan joy katakda darhol ko'rinsin
    } catch (e) { setErr(msg(e, t)); setHold(null); await refreshSlots(); } finally { setBusy(false); }
  }

  async function refreshSlots() {
    if (!offer) return;
    try { setSlots(await api<Slot[]>(`/terminals/${offer.terminal.id}/slots`)); } catch { /* keyingi urinishda */ }
  }

  async function extend() {
    if (!hold) return;
    setBusy(true);
    try { const r = await post<{ holdExpiresAt: string }>(`/holds/${hold.id}/extend`, {}); setHold({ ...hold, holdExpiresAt: r.holdExpiresAt }); }
    catch (e) { setErr(msg(e, t)); } finally { setBusy(false); }
  }

  const onHoldExpired = useCallback(() => { setHold(null); setErr(t('err.holdExpiredPick')); void refreshSlots(); }, [offer, t]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!offer || !hold) return;
    setErr(null); setBusy(true);
    idemKey.current ??= crypto.randomUUID();
    // Noto'g'ri vagon raqami jimgina tushib qolmasin: 8 raqam bo'lishi shart
    const wagonList = wagonNumbers.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    const badWagons = wagonList.filter((x) => !/^\d{8}$/.test(x));
    if (badWagons.length) { setBusy(false); setErr(t('err.wagonNumbers', { list: badWagons.join(', ') })); wagonRef.current?.focus(); return; }
    try {
      const order = await post<Order>('/orders', {
        orgId: orgId || undefined, bookingId: hold.id, operation, cargoCode: cargo?.code, weightKg,
        wagonCount: Number(wagons) || 1, storageDays: extras.includes('STORAGE') ? Number(storageDays) || 1 : undefined,
        services: extras, note: note.trim() || undefined,
        wagonNumbers: wagonList,
      }, { 'Idempotency-Key': idemKey.current });
      try { localStorage.removeItem(DRAFT); } catch { /* ignore */ }
      router.push(`/dashboard/orders/${order.no}`);
    } catch (e) {
      setErr(msg(e, t)); idemKey.current = null; setBusy(false);
      if (e instanceof ApiError && ['HOLD_EXPIRED', 'SLOT_FULL', 'SLOT_PAST'].includes(e.body?.code)) { setHold(null); await refreshSlots(); }
    }
  }

  const selectedSlot = useMemo(() => slots.find((s) => s.id === hold?.slotId) ?? null, [slots, hold]);

  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label={ta('breadcrumb')} className="font-mono text-xs text-muted"><Link href="/dashboard" className="hover:text-navy">{t('cabinet')}</Link> / {t('newTitle')}</nav>
      <h1 className="font-display mt-2 text-3xl font-bold">{t('newTitle')}</h1>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label={t('stepsAria')}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}
              className={`min-h-11 rounded-full px-4 py-1.5 text-sm font-semibold transition ${i === step ? 'bg-navy text-white' : i < step ? 'bg-teal-soft text-teal-ink hover:bg-teal-soft/80' : 'bg-line/60 text-muted'}`}
            >
              {i + 1}. {t(`step.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      {err ? <p role="alert" className="mt-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      {/* 1-qadam: yuk */}
      {step === 0 && (
        <form onSubmit={toStep2} className="mt-6 space-y-5 rounded-card border border-line bg-white p-6">
          {orgs.length > 1 ? (
            <label className="block text-sm font-semibold">{t('org')}
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full rounded-xl border border-field px-4 py-3 text-base font-normal">
                {orgs.map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
              </select>
            </label>
          ) : null}
          {orgs.length === 0 ? (
            <p className="rounded-xl bg-teal-soft p-4 text-sm text-teal-ink">{t('orgAuto')}</p>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('row.operation')}</legend>
            <div className="flex gap-2">
              {OPERATIONS.map((op) => (
                <label key={op} className={`flex-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal has-[:focus-visible]:outline-offset-2 cursor-pointer rounded-xl border px-4 py-3 text-center font-semibold ${operation === op ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white'}`}>
                  <input type="radio" name="op" className="sr-only" checked={operation === op} onChange={() => setOperation(op)} />{ts(op)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-semibold">{t('row.station')}
            <div ref={stationBox} className="mt-1 font-normal"><StationSearch value={station} onChange={setStation} /></div>
          </label>
          <label className="block text-sm font-semibold">{t('cargoOptional')}
            <div className="mt-1 font-normal"><CargoSearch value={cargo} onChange={setCargo} /></div>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-semibold">{t('weightT')}
              <input ref={weightRef} inputMode="decimal" required value={weightT} onChange={(e) => setWeightT(e.target.value)} className="mt-1 w-full rounded-xl border border-field px-4 py-3 font-mono text-base font-normal" />
            </label>
            <label className="block text-sm font-semibold">{t('wagonCount')}
              <input inputMode="numeric" value={wagons} onChange={(e) => setWagons(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-xl border border-field px-4 py-3 font-mono text-base font-normal" />
            </label>
            <label className="block text-sm font-semibold">{t('storage')}
              <input inputMode="numeric" disabled={!extras.includes('STORAGE')} value={storageDays} onChange={(e) => setStorageDays(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-xl border border-field px-4 py-3 font-mono text-base font-normal disabled:opacity-50" />
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('extras')}</legend>
            <div className="flex flex-wrap gap-2">
              {EXTRAS.map((s) => {
                const on = extras.includes(s);
                return (
                  <label key={s} className={`has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal has-[:focus-visible]:outline-offset-2 cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white'}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setExtras(on ? extras.filter((x) => x !== s) : [...extras, s])} />{ts(s)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Tashkilot talab qilinmaydi: yuqoridagi yozuv ham shuni aytadi va server
              birinchi buyurtmada uni foydalanuvchi nomi bilan o'zi ochadi
              (create-order.usecase.ts: shipperOrgId ??= createShipperOrg). Ilgari bu
              tugma tashkilotsiz odamga o'chirilgan edi, ya'ni yozuv va'da qilgan
              narsani tugma taqiqlab turardi. */}
          <button disabled={busy} className="rounded-full bg-navy px-6 py-3 font-semibold text-white transition hover:bg-navy-2 active:scale-[0.98] disabled:opacity-60">
            {busy ? t('calculating') : t('showTerminals')}
          </button>
        </form>
      )}

      {/* 2-qadam: terminal va slot */}
      {step === 1 && (
        <div className="mt-6 space-y-5">
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="text-lg font-bold">{t('terminalHeading')}</h2>
            <p className="mt-1 text-sm text-muted">{t(offers[0]?.nearby ? 'offersLeadNearby' : 'offersLead', { station: station?.nameUz ?? '', count: offers.length })}</p>
            <ul className="mt-4 grid gap-2">
              {offers.map((o) => (
                <li key={o.terminal.id}>
                  <button
                    type="button" onClick={() => pickOffer(o)} aria-pressed={offer?.terminal.id === o.terminal.id}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition ${offer?.terminal.id === o.terminal.id ? 'border-teal bg-teal-soft' : 'border-line hover:bg-sand'}`}
                  >
                    <span className="min-w-0 wrap-anywhere">
                      <span className="font-semibold">{o.terminal.name}</span>
                      <span className="block text-xs text-muted">{stationName(o.terminal)}{o.terminal.is24h ? ' · 24/7' : ''}{o.missing.length ? ` · ${t('missingTariff', { services: o.missing.map((m) => ts(m)).join(', ') })}` : ''}</span>
                    </span>
                    <span className="shrink-0 font-mono font-semibold tabular-nums">{som(o.totalTiyin, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {offer ? (
            <section className="rounded-card border border-line bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{t('row.slot')}</h2>
                {hold ? (
                  <span className="flex items-center gap-3 rounded-full bg-amber-soft px-4 py-1.5">
                    <span className="text-xs font-semibold text-amber-ink">{t('holding')}</span>
                    <SlaTimer until={hold.holdExpiresAt} onExpire={onHoldExpired} />
                    <button type="button" onClick={extend} disabled={busy} className="text-xs font-semibold text-navy underline">{t('extend')}</button>
                  </span>
                ) : null}
              </div>
              <div className="mt-4"><SlotGrid slots={slots} selectedId={hold?.slotId ?? null} onSelect={pickSlot} busy={busy} /></div>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setStep(0)} className="rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-sand">{t('back')}</button>
                <button type="button" disabled={!hold || busy} onClick={() => setStep(2)} className="rounded-full bg-navy px-6 py-2.5 font-semibold text-white transition hover:bg-navy-2 active:scale-[0.98] disabled:opacity-50">{t('next')}</button>
              </div>
            </section>
          ) : null}
        </div>
      )}

      {/* 3-qadam: xulosa */}
      {step === 2 && offer && hold ? (
        <div className="mt-6 grid gap-5 md:grid-cols-[1.4fr_1fr] md:items-start">
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="text-lg font-bold">{t('extraInfo')}</h2>
            <label className="mt-4 block text-sm font-semibold">{t('wagonNumbers')}
              <input ref={wagonRef} value={wagonNumbers} onChange={(e) => setWagonNumbers(e.target.value)} placeholder="62031845 62031846" className="mt-1 w-full rounded-xl border border-field px-4 py-3 font-mono text-base font-normal" />
            </label>
            <label className="mt-4 block text-sm font-semibold">{t('noteOptional')}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border border-field px-4 py-3 text-base font-normal" />
            </label>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-sand">{t('back')}</button>
              <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98] disabled:opacity-60">
                {busy ? t('sending') : t('placeOrder')}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">{t('submitHint')}</p>
          </section>

          {/* Telefonda hisob formadan yuqorida: tasdiq tugmasi jami summadan keyin ko'rinsin */}
          <aside className="rounded-card border border-line bg-white p-6 max-md:order-first">
            <h2 className="text-lg font-bold">{offer.terminal.name}</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('row.operation')}</dt><dd>{ts(operation)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('row.cargo')}</dt><dd className="text-right">{cargo?.name ?? t('notSpecified')}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('row.weight')}</dt><dd className="font-mono">{num(weightKg / 1000, locale)} t</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('row.wagons')}</dt><dd className="font-mono">{wagons}</dd></div>
              {selectedSlot ? <div className="flex justify-between gap-4"><dt className="text-muted">{t('row.time')}</dt><dd className="text-right">{slotLabel(selectedSlot.startsAt, selectedSlot.endsAt, locale)}</dd></div> : null}
            </dl>
            <div className="mt-4 border-t border-line pt-2">
              <PriceLines items={offer.lines} subtotalTiyin={offer.subtotalTiyin} commissionPct={offer.commissionPct} commissionTiyin={offer.commissionTiyin} commissionPayer={offer.commissionPayer} totalTiyin={offer.totalTiyin} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              {t('holdingShort')} <SlaTimer until={hold.holdExpiresAt} onExpire={onHoldExpired} />
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function msg(e: unknown, t: ReturnType<typeof useTranslations<'dashboard2.order'>>) {
  const code = e instanceof ApiError ? e.body?.code : null;
  return code && t.has(`err.${code}`) ? t(`err.${code}`) : t('err.generic');
}
