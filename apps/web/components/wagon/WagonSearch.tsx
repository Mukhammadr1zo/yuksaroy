'use client';
/**
 * Vagon qidiruvi: bitta raqam yoki bir partiya raqam kiritiladi, natija joriy joylashuv.
 * Harakat tarixi ko'rsatilmaydi: odamga kerak bo'lgani joriy joylashuv, qolgani shovqin.
 * Mehmonga forma yopiq: kirish havolasi. 402 obuna, 503 xizmat ulanmagan, topilmasa oddiy matn.
 * Stansiya nomlari upstream dan ruscha keladi va shundayligicha ko'rsatiladi: rasmiy nomlar.
 * Boshlang'ich holat server va brauzerda bir xil: sessiya faqat brauzerda bilinadi.
 *
 * Partiya serverda emas, brauzerda: raqamlar ketma-ket mavjud yo'lga yuboriladi. Sabab -
 * serverda ham bitta foydalanuvchi navbat bilan ishlanadi, ya'ni yangi to'plam yo'li
 * tezlik bermasdi, birinchi xatoda to'xtash esa brauzerda soddaroq.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LockSimpleIcon, MagnifyingGlassIcon, TrainIcon } from '@phosphor-icons/react';
import { parseWagonNos } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api, hasSession } from '@/lib/api';
import { num, uzDate, uzDateTime, uzToday } from '@/lib/format';
import { BTN_PRIMARY, BTN_GHOST, INPUT, Notice } from '@/components/kabinet/bits';
import type { WagonEvent, WagonMe, WagonResult, WagonRow } from '@/lib/types-wagon';

type Err = 'WAGON_NO_INVALID' | 'WAGON_NOT_CONFIGURED' | 'WAGON_UPSTREAM' | 'RATE_LIMITED' | 'generic';
type State =
  | { s: 'idle' } | { s: 'guest' } | { s: 'busy' }
  // Narx devor javobidan keladi: odam uni izlab boshqa sahifaga ketmasin
  | { s: 'result'; r: WagonResult } | { s: 'subscribe'; priceSom?: number } | { s: 'err'; code: Err };

/** Bir joylashtirishda shuncha raqam: har biri alohida qidiruv, undan ortig'i kvotani birdan yeb qo'yardi. */
const BATCH_MAX = 20;
const ERRS: Record<number, Err> = { 400: 'WAGON_NO_INVALID', 429: 'RATE_LIMITED', 502: 'WAGON_UPSTREAM', 503: 'WAGON_NOT_CONFIGURED' };
const STATE_TONE: Record<WagonEvent['state'], string> = { loaded: 'bg-teal text-white', empty: 'bg-line text-ink', unknown: 'bg-sand text-muted' };

/**
 * Hodisa sanasi faqat kun ("2026-09-20"), soati yo'q: soat bilan chiqarilsa har qatorda uydirma
 * 05:00 turardi. Yil faqat boshqa yildagi qator uchun yoziladi, ro'yxatning ko'pi shu yildan.
 */
function dayLabel(d: string, locale: string): string {
  const y = d.slice(0, 4);
  return y === uzToday().slice(0, 4) ? uzDate(d, locale) : `${uzDate(d, locale)} ${y}`;
}

export function WagonSearch() {
  const t = useTranslations('wagon');
  const locale = useLocale();
  const [text, setText] = useState('');
  const [st, setSt] = useState<State>({ s: 'idle' });
  const [rows, setRows] = useState<WagonRow[]>([]);
  // Kvota va oxirgi qidirganlarim bitta javobdan keladi, shuning uchun bitta holatda
  const [me, setMe] = useState<WagonMe | null>(null);
  // To'xtatish tugmasi uchun: partiya yarim yo'lda uzilsa qolganlari qidirilmaydi
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hasSession()) { setSt({ s: 'guest' }); return; }
    api<WagonMe>('/wagon/me').then((m) => { setMe(m); if (!m.configured) setSt({ s: 'err', code: 'WAGON_NOT_CONFIGURED' }); }).catch(() => {});
  }, []);

  const parsed = parseWagonNos(text);
  const nos = parsed.ok.slice(0, BATCH_MAX);
  const valid = nos.length > 0;
  const busy = st.s === 'busy';
  const guest = st.s === 'guest';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setSt({ s: 'err', code: 'WAGON_NO_INVALID' }); return; }
    const ac = new AbortController();
    acRef.current = ac;
    // Hamma qator boshida chiziladi: keyin faqat indeks bo'yicha almashtiriladi, ya'ni
    // odam qaysi raqam navbatda turganini boshdanoq ko'radi
    const seed: WagonRow[] = [
      ...nos.map((no) => ({ no, s: 'wait' as const })),
      ...parsed.bad.map((no) => ({ no, s: 'invalid' as const })),
    ];
    setRows(seed);
    setSt({ s: 'busy' });
    let last: WagonResult | null = null;
    for (const [i, no] of nos.entries()) {
      if (ac.signal.aborted) break;
      setRows((p) => p.map((r, j) => (j === i ? { no, s: 'busy' } : r)));
      try {
        // Server 10 soniya kutadi; brauzer undan sal ko'proq, keyin "hozir qidirib bo'lmadi"
        const r = await api<WagonResult>('/wagon/search', {
          method: 'POST', body: JSON.stringify({ no }),
          signal: AbortSignal.any([ac.signal, AbortSignal.timeout(15_000)]),
        });
        last = r;
        // Har javobdan keyin hisoblagich kamayadi: odam sarfni ish davomida ko'rib turadi
        setMe((m) => (m ? { ...m, ...r.quota, remainingFree: Math.max(0, r.quota.freeTotal - r.quota.freeUsed) } : m));
        setRows((p) => p.map((x, j) => (j === i ? { no, s: 'done', r } : x)));
      } catch (err) {
        // Birinchi xatoda to'xtaydi: 402 obuna, 429 chegara, 502 manba. Urinib turish
        // qolgan 19 tasini ham yiqitardi, qolganlari "Qidirilmadi" bo'lib turadi
        applyErr(err);
        setRows((p) => p.map((x) => (x.s === 'wait' ? { no: x.no, s: 'skipped' } : x)));
        acRef.current = null;
        return;
      }
    }
    acRef.current = null;
    setRows((p) => p.map((x) => (x.s === 'wait' || x.s === 'busy' ? { no: x.no, s: 'skipped' } : x)));
    // Bitta raqam: eski katta karta. Ko'p raqam: ro'yxat, karta chizilmaydi
    setSt(nos.length === 1 && last ? { s: 'result', r: last } : { s: 'idle' });
    // Partiyadan keyin "oxirgi qidirganlarim" eskirdi: bitta arzon so'rov
    api<WagonMe>('/wagon/me').then(setMe).catch(() => {});
  }

  function applyErr(e: unknown) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      setSt(e.name === 'AbortError' ? { s: 'idle' } : { s: 'err', code: 'WAGON_UPSTREAM' });
      return;
    }
    const status = e instanceof ApiError ? e.status : 0;
    if (status === 401) { setSt({ s: 'guest' }); return; }
    if (status === 402) { setSt({ s: 'subscribe', priceSom: (e as ApiError).body?.priceSom }); return; }
    setSt({ s: 'err', code: ERRS[status] ?? 'generic' });
  }

  /** Oxirgi qidirganlardan raqam qo'shish: matn maydonining oxiriga, vergul bilan. */
  function addNos(add: string[]) {
    setText((p) => [...parseWagonNos(p).ok, ...add].filter((v, i, a) => a.indexOf(v) === i).join(', '));
  }

  const cta = 'font-semibold text-teal-ink underline underline-offset-4 hover:text-navy';
  const done = rows.filter((r) => r.s === 'done').length;

  return (
    <div className="min-w-0">
      <form onSubmit={submit} className="rounded-card border border-line bg-white p-5 md:p-6">
        <label htmlFor="wagon-no" className="block text-sm font-semibold">{t('label')}</label>
        <div className="mt-2 flex flex-wrap gap-3">
          <textarea
            id="wagon-no" value={text} disabled={guest || busy} rows={3}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off" placeholder={t('placeholder')}
            className={`${INPUT} min-w-0 flex-1 font-mono text-lg tabular-nums tracking-wider`}
          />
          <button type="submit" disabled={guest || busy || !valid} className={`${BTN_PRIMARY} inline-flex h-fit items-center gap-2`}>
            <MagnifyingGlassIcon size={18} aria-hidden="true" />
            {busy ? t('searching') : nos.length > 1 ? t('submitMany', { n: nos.length }) : t('submit')}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{t('hint')}</p>
        {parsed.ok.length > BATCH_MAX ? <p className="mt-2 text-xs text-amber-ink">{t('tooMany', { n: BATCH_MAX })}</p> : null}
        {/* Bepul qidiruv partiyaga yetmasligi OLDINDAN aytiladi: odam yarim yo'lda devorga urilmasin */}
        {me && !me.subscriber && nos.length > me.remainingFree ? (
          <p className="mt-2 text-xs text-amber-ink">{t('notEnoughFree', { n: nos.length, left: me.remainingFree })}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted">{t('costNote')} {t('freeRepeat')}</p>
        {guest ? (
          <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <LockSimpleIcon size={14} aria-hidden="true" />{t('guest')} <Link href="/login?next=/wagon" className={cta}>{t('loginCta')}</Link>
          </p>
        ) : me ? (
          <p className="mt-3 text-sm text-muted">
            {me.subscriber ? t('quotaSub') : t('quotaFree', { left: me.remainingFree })}
            {/* Bepul qidiruv tugagan: odam devorga urilmasdan oldin obunaga yo'l ko'rsin */}
            {!me.subscriber && me.remainingFree === 0 ? <> <Link href="/dashboard/subscription" className={cta}>{t('subscribeCta')}</Link></> : null}
          </p>
        ) : null}
      </form>

      {busy && nos.length > 1 ? (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span className="tabular-nums">{t('progress', { done, total: nos.length })}</span>
          <button type="button" onClick={() => acRef.current?.abort()} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{t('stop')}</button>
        </p>
      ) : null}

      <div className="mt-5">
        {st.s === 'subscribe' ? (
          <Notice tone="warn">{t('subscribe')}{st.priceSom ? ` ${t('price', { price: num(st.priceSom, locale) })}` : ''} <Link href="/dashboard/subscription" className={cta}>{t('subscribeCta')}</Link></Notice>
        ) : st.s === 'err' ? (
          <Notice tone={st.code === 'WAGON_NOT_CONFIGURED' ? 'warn' : 'err'}>{t(`errors.${st.code}`)}</Notice>
        ) : null}
      </div>

      {st.s === 'result' ? <div className="mt-5"><Result r={st.r} locale={locale} /></div> : null}

      {rows.length > 1 ? (
        <ul className="mt-5 rounded-card border border-line bg-white px-5 py-1 md:px-6">
          {rows.map((r) => <BatchRow key={r.no} row={r} locale={locale} />)}
        </ul>
      ) : null}

      {me && me.recent.length ? (
        <section className="mt-5 rounded-card border border-line bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{t('recent.title')}</h2>
            <button type="button" onClick={() => addNos(me.recent.map((r) => r.wagonNo))} className={cta}>{t('recent.addAll')}</button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {me.recent.map((r) => (
              <li key={r.wagonNo}>
                <button
                  type="button" onClick={() => addNos([r.wagonNo])}
                  className="rounded-full border border-line px-3 py-1 font-mono text-sm tabular-nums transition-colors duration-150 hover:border-teal"
                >
                  {r.wagonNo}{r.found ? '' : <span className="ml-1.5 font-sans text-xs text-muted">{t('recent.notFound')}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Partiyadagi bitta qator. Vagon holati (yuklangan/bo'sh) faqat topilgan qatorda bo'ladi. */
function BatchRow({ row, locale }: { row: WagonRow; locale: string }) {
  const t = useTranslations('wagon');
  const c = row.s === 'done' && row.r.found ? row.r.current : null;
  const tone = c ? STATE_TONE[c.state] : 'bg-sand text-muted';
  const badge = c ? t(`state.${c.state}`)
    : row.s === 'done' ? t('rowNotFound')
      : row.s === 'busy' ? t('searching')
        : row.s === 'skipped' ? t('rowSkipped')
          : row.s === 'invalid' ? t('rowInvalid')
            : t('rowWait');
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-0">
      <span className="font-mono font-semibold tabular-nums">{row.no}</span>
      <span className="min-w-0 flex-1 wrap-anywhere">{c ? (c.station ?? t('stationUnknown')) : ''}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{badge}</span>
      <span className="font-mono text-xs tabular-nums text-muted">{c ? dayLabel(c.date, locale) : ''}</span>
    </li>
  );
}

function Result({ r, locale }: { r: WagonResult; locale: string }) {
  const t = useTranslations('wagon');
  if (!r.found || !r.current) return <Notice tone="warn">{t('notFound', { no: r.wagonNo })}</Notice>;
  const c = r.current;
  return (
    <section className="rounded-card border border-teal/40 bg-teal-soft p-5 md:p-6">
        <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('current')} · {r.wagonNo}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <TrainIcon size={32} weight="duotone" className="shrink-0 text-teal" aria-hidden="true" />
          <h2 className="font-display min-w-0 text-2xl font-bold text-navy wrap-anywhere md:text-3xl">{c.station ?? t('stationUnknown')}</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_TONE[c.state]}`}>{t(`state.${c.state}`)}</span>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k={t('date')} v={dayLabel(c.date, locale)} mono />
        </dl>
      <p className="mt-4 text-xs text-muted">{t('fetchedAt', { at: uzDateTime(r.fetchedAt, locale) })}</p>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-2">
      <dt className="text-muted">{k}:</dt>
      <dd className={`min-w-0 font-semibold text-ink wrap-anywhere ${mono ? 'font-mono tabular-nums' : ''}`}>{v}</dd>
    </div>
  );
}
