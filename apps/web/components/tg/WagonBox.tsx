'use client';
/**
 * Mini App vagon qidiruvi: bitta yoki WAGON.batchMax (5) tagacha raqam.
 *
 * Qoidalar saytdagi WagonSearch bilan bir xil (kvota /wagon/me dan keladi, 402 obuna
 * devori, xato kodlari o'zgarmaydi, raqamlar ketma-ket mavjud yo'lga yuboriladi, birinchi
 * xatoda to'xtaydi). Telefonning raqam klaviaturasida vergul yo'q: shuning uchun raqam
 * "Qo'shish" tugmasi bilan ro'yxatga olinadi, nusxalangan ro'yxat esa o'zi bo'linadi.
 * Sayt komponenti ko'chirilmadi: u keng ustun uchun chizilgan.
 *
 * Kirish: Mini App'da odam allaqachon Telegram orqali kirgan, shuning uchun 401 faqat
 * sessiya tugaganda keladi. Kirish sahifasi o'rniga relogin tugmasi ko'rsatiladi:
 * /tg ichida login formasi yo'q.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { MagnifyingGlassIcon, PlusIcon, TrainRegionalIcon, XIcon } from '@phosphor-icons/react';
import { WAGON, parseWagonNos } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import { num, uzDate, uzDateTime, uzToday } from '@/lib/format';
import type { WagonEvent, WagonMe, WagonResult, WagonRow } from '@/lib/types-wagon';
import { haptic, useTg } from './TgProvider';
import { BTN, CARD, Empty, Err, INPUT, LoadError, Row } from './bits';

type Code = 'WAGON_NO_INVALID' | 'WAGON_NOT_CONFIGURED' | 'WAGON_UPSTREAM' | 'RATE_LIMITED' | 'WAGON_DAILY_LIMIT' | 'generic';
type St =
  | { s: 'idle' } | { s: 'busy' } | { s: 'guest' }
  | { s: 'result'; r: WagonResult }
  // Narx devor javobidan keladi: odam uni izlab boshqa ekranga ketmasin
  | { s: 'subscribe'; priceSom?: number }
  | { s: 'err'; code: Code };

const ERRS: Record<number, Code> = { 400: 'WAGON_NO_INVALID', 429: 'RATE_LIMITED', 502: 'WAGON_UPSTREAM', 503: 'WAGON_NOT_CONFIGURED' };
const TONE: Record<WagonEvent['state'], string> = { loaded: 'bg-teal text-white', empty: 'bg-line text-ink', unknown: 'bg-sand text-muted' };

/** Hodisa sanasida soat yo'q. Yil faqat boshqa yildagi sanaga yoziladi: ekran tor. */
const dayLabel = (d: string, locale: string) =>
  (d.slice(0, 4) === uzToday().slice(0, 4) ? uzDate(d, locale) : `${uzDate(d, locale)} ${d.slice(0, 4)}`);

export function WagonBox() {
  const t = useTranslations('tg.wagon');
  const tb = useTranslations('tg.boot');
  const locale = useLocale();
  const { relogin } = useTg();
  const router = useRouter();
  const sp = useSearchParams();
  // Qidiruvdan kelgan ?no= faqat bir marta ishlaydi: strict mode, qayta chizish va Orqaga pullik so'rovni takrorlamasin
  const auto = useRef(false);
  const [text, setText] = useState('');
  const [st, setSt] = useState<St>({ s: 'idle' });
  const [me, setMe] = useState<WagonMe | null>(null);
  // Kvota yuklanmasa jim qolmaydi: qayta urinish tugmasi (qidiruv o'zi kvotasiz ham ishlayveradi)
  const [meFailed, setMeFailed] = useState(false);

  const loadMe = useCallback(() => {
    setMeFailed(false);
    api<WagonMe>('/wagon/me')
      .then((m) => { setMe(m); if (!m.configured) setSt({ s: 'err', code: 'WAGON_NOT_CONFIGURED' }); })
      .catch(() => setMeFailed(true));
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);

  // Ro'yxatga olingan raqamlar (chiplar) va partiya natijasi
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<WagonRow[]>([]);

  // Maydondagi matn ham hisobga kiradi: odam bitta raqam yozib darhol "Qidirish" bossa ham ishlaydi
  const parsed = parseWagonNos(text);
  const all = uniq([...picked, ...parsed.ok]);
  const nos = all.slice(0, WAGON.batchMax);
  const busy = st.s === 'busy';
  const full = picked.length >= WAGON.batchMax;

  /** Maydondagi raqam(lar)ni ro'yxatga o'tkazadi. Noto'g'ri raqam maydonda qoladi: odam tuzatsin. */
  function add(more: string[] = parsed.ok) {
    if (!more.length) { if (text.trim()) setSt({ s: 'err', code: 'WAGON_NO_INVALID' }); return; }
    haptic();
    setPicked((p) => uniq([...p, ...more]).slice(0, WAGON.batchMax));
    setText(parsed.bad.join(' '));
    if (st.s === 'err') setSt({ s: 'idle' });
  }

  async function run(list: string[]) {
    if (!list.length) { setSt({ s: 'err', code: 'WAGON_NO_INVALID' }); return; }
    setSt({ s: 'busy' });
    setRows(list.length > 1 ? list.map((no) => ({ no, s: 'wait' as const })) : []);
    let last: WagonResult | null = null;
    for (const [i, no] of list.entries()) {
      if (list.length > 1) setRows((p) => p.map((r, j) => (j === i ? { no, s: 'busy' } : r)));
      try {
        // Server 10 soniya kutadi, brauzer sal ko'proq: undan keyin "hozir qidirib bo'lmadi"
        const r = await api<WagonResult>('/wagon/search', { method: 'POST', body: JSON.stringify({ no }), signal: AbortSignal.timeout(15_000) });
        last = r;
        if (list.length > 1) setRows((p) => p.map((x, j) => (j === i ? { no, s: 'done', r } : x)));
      } catch (err) {
        // Birinchi xatoda to'xtaydi (402 obuna, 429 chegara, 502 manba): qolganlari "qidirilmadi"
        setSt(errState(err));
        setRows((p) => p.map((x) => (x.s === 'wait' || x.s === 'busy' ? { no: x.no, s: 'skipped' } : x)));
        api<WagonMe>('/wagon/me').then(setMe).catch(() => {});
        return;
      }
    }
    // Bitta raqam: katta karta. Bir nechta: ixcham ro'yxat
    setSt(list.length === 1 && last ? { s: 'result', r: last } : { s: 'idle' });
    // Kvota ham, oxirgi qidirganlarim ham o'zgardi: bitta arzon so'rov
    api<WagonMe>('/wagon/me').then(setMe).catch(() => {});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nos.length) haptic();
    // Maydon qidiruv paytida disabled bo'ladi: fokusni oldindan qo'yib yuboramiz, aks holda tab paneli yashirin qolishi mumkin
    (document.activeElement as HTMLElement | null)?.blur();
    if (nos.length) { setPicked(nos); setText(''); }
    void run(nos);
  }

  // /tg/search dan raqam bilan kelinsa: ro'yxat to'ladi, qidiruv bir marta ishlaydi, ?no= URL dan olib tashlanadi
  useEffect(() => {
    const raw = sp.get('no');
    if (!raw || auto.current) return;
    auto.current = true;
    const list = parseWagonNos(raw).ok.slice(0, WAGON.batchMax);
    if (list.length) setPicked(list); else setText(raw);
    router.replace('/tg/wagon');
    void run(list);
  }, [sp]);

  const done = rows.filter((r) => r.s === 'done').length;

  return (
    <div>
      <form onSubmit={submit}>
        <label htmlFor="tg-wagon-no" className="text-sm font-semibold">{t('label')}</label>
        <div className="mt-2 flex gap-2">
          <input
            id="tg-wagon-no" value={text} disabled={busy || full} onChange={(e) => setText(e.target.value)}
            inputMode="numeric" enterKeyHint="search" autoComplete="off" placeholder={full ? t('full', { n: WAGON.batchMax }) : t('ph')}
            className={`${INPUT} min-h-12 min-w-0 flex-1 font-mono text-lg tabular-nums tracking-wider`}
          />
          {/* Ro'yxatga qo'shish: raqam klaviaturasida vergul yo'q, shuning uchun alohida tugma */}
          <button
            type="button" onClick={() => add()} disabled={busy || full || !parsed.ok.length} aria-label={t('add')}
            className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border border-teal px-3 text-sm font-semibold text-teal-ink active:scale-[0.97] disabled:border-line disabled:text-muted"
          >
            <PlusIcon size={18} weight="bold" aria-hidden="true" />{t('add')}
          </button>
        </div>
        {picked.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label={t('picked')}>
            {picked.map((x) => (
              <li key={x}>
                <button
                  type="button" disabled={busy} onClick={() => { haptic(); setPicked((p) => p.filter((y) => y !== x)); }}
                  aria-label={t('remove', { no: x })}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-teal-soft py-1 pl-3 pr-2 font-mono text-sm tabular-nums text-teal-ink"
                >
                  {x}<XIcon size={14} weight="bold" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {all.length > WAGON.batchMax ? <p className="mt-2 text-xs text-amber-ink">{t('tooMany', { n: WAGON.batchMax })}</p> : null}
        {me && !me.subscriber && nos.length > 1 && nos.length > me.remainingFree ? (
          <p className="mt-2 text-xs text-amber-ink">{t('notEnoughFree', { n: nos.length, left: me.remainingFree })}</p>
        ) : me && me.subscriber && nos.length > Math.max(0, me.dailyLimit - me.dailyUsed) ? (
          <p className="mt-2 text-xs text-amber-ink">{t('notEnoughDaily', { n: nos.length, left: Math.max(0, me.dailyLimit - me.dailyUsed) })}</p>
        ) : null}
        <button type="submit" disabled={busy || !nos.length} className={`${BTN} mt-3 gap-2`}>
          <MagnifyingGlassIcon size={18} aria-hidden="true" />
          {busy ? (rows.length > 1 ? t('progress', { done, total: rows.length }) : t('searching')) : nos.length > 1 ? t('submitMany', { n: nos.length }) : t('submit')}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">{t('hint', { n: WAGON.batchMax })}</p>

      {meFailed ? <div className="mt-3"><LoadError onRetry={loadMe} /></div> : me ? (
        <p className="mt-2 text-sm text-muted">
          {me.subscriber ? t('quotaSub', { left: Math.max(0, me.dailyLimit - me.dailyUsed), n: me.dailyLimit }) : t('quotaFree', { left: me.remainingFree })}
          {/* Bepul qidiruv tugagan: odam devorga urilmasdan oldin obunaga yo'l ko'rsin */}
          {!me.subscriber && me.remainingFree === 0 ? <> <Link href="/tg/subscription" className="inline-flex min-h-11 items-center font-semibold text-teal-ink underline">{t('subscribeCta')}</Link></> : null}
        </p>
      ) : null}

      {st.s === 'guest' ? (
        <section className={`${CARD} mt-4 border-amber/40 p-4`}>
          <p className="text-sm">{t('guest')}</p>
          <button type="button" onClick={() => { haptic(); void relogin(); }} className={`${BTN} mt-3`}>{tb('retry')}</button>
        </section>
      ) : st.s === 'subscribe' ? (
        <section className={`${CARD} mt-4 border-amber/40 p-4`}>
          <p className="text-sm">{t('subscribe')}{st.priceSom ? ` ${t('price', { price: num(st.priceSom, locale) })}` : ''}</p>
          <Link href="/tg/subscription" onClick={() => haptic()} className={`${BTN} mt-3`}>{t('subscribeCta')}</Link>
        </section>
      ) : st.s === 'err' ? (
        <div className="mt-4"><Err>{t(`errors.${st.code}`)}</Err></div>
      ) : st.s === 'result' ? (
        <div className="mt-4"><Result r={st.r} locale={locale} /></div>
      ) : null}

      {rows.length > 1 ? (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => <BatchRow key={r.no} row={r} locale={locale} />)}
        </ul>
      ) : null}

      {me && me.recent.length ? (
        <section className="mt-5">
          <h2 className="text-sm font-bold">{t('recent')}</h2>
          {/* Bosilganda faqat ro'yxatga qo'shiladi: qidiruvni odamning o'zi boshlasin,
              chunki 6 soatdan eski raqam yangi qidiruv sifatida kvotadan yeydi */}
          <div className="tg-strip -mx-4 mt-2 px-4">
            {me.recent.map((x) => (
              <button
                key={x.wagonNo} type="button" disabled={busy || full} onClick={() => add([x.wagonNo])}
                className="min-h-11 rounded-full border border-line bg-white px-4 font-mono text-sm tabular-nums active:scale-[0.97]"
              >
                {x.wagonNo}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Takrorsiz, tartib saqlanadi. Boshidagi nol farq qilmaydi: serverda 01234567 va 1234567 bitta vagon. */
function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((x) => { const k = x.replace(/^0+(?=\d)/, ''); return seen.has(k) ? false : (seen.add(k), true); });
}

/** Partiyadagi bitta qator: raqam, stansiya, holat. Topilmagan va to'xtatilgan qatorlar ham ko'rinadi. */
function BatchRow({ row, locale }: { row: WagonRow; locale: string }) {
  const t = useTranslations('tg.wagon');
  const c = row.s === 'done' && row.r.found ? row.r.current : null;
  const badge = c ? t(`state.${c.state}`)
    : row.s === 'done' ? t('rowNotFound')
      : row.s === 'busy' ? t('searching')
        : row.s === 'skipped' ? t('rowSkipped')
          : t('rowWait');
  return (
    <li className={`${CARD} p-3`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold tabular-nums">{row.no}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${c ? TONE[c.state] : 'bg-sand text-muted'}`}>{badge}</span>
      </div>
      {c ? (
        <p className="mt-1 flex items-baseline gap-2 text-sm">
          <span className="min-w-0 flex-1 break-words font-semibold">{c.station ?? t('stationUnknown')}</span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{dayLabel(c.date, locale)}</span>
        </p>
      ) : null}
    </li>
  );
}

/** Xatodan holat: saytdagi bilan bir xil kodlar, yangisi o'ylab topilmaydi. */
function errState(e: unknown): St {
  // Kutish tugadi yoki so'rov uzildi: ikkalasi ham "manba javob bermadi"
  if (e instanceof DOMException) return { s: 'err', code: 'WAGON_UPSTREAM' };
  const status = e instanceof ApiError ? e.status : 0;
  if (status === 401) return { s: 'guest' };
  if (status === 402) return { s: 'subscribe', priceSom: (e as ApiError).body?.priceSom };
  // Obunachining kunlik chegarasi ham 429, lekin matni boshqa: "bir soatdan keyin" emas, "ertaga"
  if (status === 429 && (e as ApiError).body?.code === 'WAGON_DAILY_LIMIT') return { s: 'err', code: 'WAGON_DAILY_LIMIT' };
  return { s: 'err', code: ERRS[status] ?? 'generic' };
}

/** Natija: stansiya, holati, ma'lumot vaqti. Harakat tarixi yo'q, saytdagidek. */
function Result({ r, locale }: { r: WagonResult; locale: string }) {
  const t = useTranslations('tg.wagon');
  if (!r.found || !r.current) return <Empty>{t('notFound', { no: r.wagonNo })}</Empty>;
  const c = r.current;
  return (
    <section className={`${CARD} border-teal/40 p-4`}>
      <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('current')} · {r.wagonNo}</p>
      <div className="mt-2 flex items-center gap-2">
        <TrainRegionalIcon size={28} weight="duotone" className="shrink-0 text-teal" aria-hidden="true" />
        <h2 className="font-display min-w-0 flex-1 break-words text-lg font-bold">{c.station ?? t('stationUnknown')}</h2>
      </div>
      <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${TONE[c.state]}`}>{t(`state.${c.state}`)}</span>
      <dl className="mt-1"><Row k={t('date')} v={dayLabel(c.date, locale)} mono /></dl>
      <p className="mt-2 text-xs text-muted">{t('fetchedAt', { at: uzDateTime(r.fetchedAt, locale) })}</p>
    </section>
  );
}
