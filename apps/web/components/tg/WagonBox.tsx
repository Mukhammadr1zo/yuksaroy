'use client';
/**
 * Mini App vagon qidiruvi: bitta raqam, bitta javob.
 *
 * Qoidalar saytdagi WagonSearch bilan bir xil (kvota /wagon/me dan keladi, 402 obuna
 * devori, xato kodlari o'zgarmaydi), lekin partiya yo'q: telefon klaviaturasida odam
 * baribir bitta raqam yozadi va 20 qatorli ro'yxat kichik ekranda o'qilmaydi.
 * Sayt komponenti ko'chirilmadi: u keng ustun uchun chizilgan.
 *
 * Kirish: Mini App'da odam allaqachon Telegram orqali kirgan, shuning uchun 401 faqat
 * sessiya tugaganda keladi. Kirish sahifasi o'rniga relogin tugmasi ko'rsatiladi:
 * /tg ichida login formasi yo'q.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MagnifyingGlassIcon, TrainRegionalIcon } from '@phosphor-icons/react';
import { normalizeWagonNo } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import { num, uzDate, uzDateTime, uzToday } from '@/lib/format';
import type { WagonEvent, WagonMe, WagonResult } from '@/lib/types-wagon';
import { haptic, useTg } from './TgProvider';
import { BTN, CARD, Empty, Err, INPUT, Row } from './bits';

type Code = 'WAGON_NO_INVALID' | 'WAGON_NOT_CONFIGURED' | 'WAGON_UPSTREAM' | 'RATE_LIMITED' | 'generic';
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
  const [text, setText] = useState('');
  const [st, setSt] = useState<St>({ s: 'idle' });
  const [me, setMe] = useState<WagonMe | null>(null);

  useEffect(() => {
    api<WagonMe>('/wagon/me')
      .then((m) => { setMe(m); if (!m.configured) setSt({ s: 'err', code: 'WAGON_NOT_CONFIGURED' }); })
      .catch(() => {});
  }, []);

  // Raqam serverdagi qoida bo'yicha tekshiriladi: 7 yoki 8 raqam, oradagi belgilar tashlanadi
  const no = normalizeWagonNo(text);
  const busy = st.s === 'busy';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!no) { setSt({ s: 'err', code: 'WAGON_NO_INVALID' }); return; }
    haptic();
    setSt({ s: 'busy' });
    try {
      // Server 10 soniya kutadi, brauzer sal ko'proq: undan keyin "hozir qidirib bo'lmadi"
      const r = await api<WagonResult>('/wagon/search', { method: 'POST', body: JSON.stringify({ no }), signal: AbortSignal.timeout(15_000) });
      setSt({ s: 'result', r });
    } catch (err) {
      setSt(errState(err));
    }
    // Kvota ham, oxirgi qidirganlarim ham o'zgardi: bitta arzon so'rov
    api<WagonMe>('/wagon/me').then(setMe).catch(() => {});
  }

  return (
    <div>
      <form onSubmit={submit}>
        <label htmlFor="tg-wagon-no" className="text-sm font-semibold">{t('label')}</label>
        <input
          id="tg-wagon-no" value={text} disabled={busy} onChange={(e) => setText(e.target.value)}
          inputMode="numeric" enterKeyHint="search" autoComplete="off" placeholder={t('ph')}
          className={`${INPUT} mt-2 min-h-12 font-mono text-lg tabular-nums tracking-wider`}
        />
        <button type="submit" disabled={busy || !no} className={`${BTN} mt-3 gap-2`}>
          <MagnifyingGlassIcon size={18} aria-hidden="true" />
          {busy ? t('searching') : t('submit')}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">{t('hint')}</p>

      {me ? (
        <p className="mt-2 text-sm text-muted">
          {me.subscriber ? t('quotaSub') : t('quotaFree', { left: me.remainingFree })}
          {/* Bepul qidiruv tugagan: odam devorga urilmasdan oldin obunaga yo'l ko'rsin */}
          {!me.subscriber && me.remainingFree === 0 ? <> <Link href="/tg/subscription" className="font-semibold text-teal-ink underline">{t('subscribeCta')}</Link></> : null}
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

      {me && me.recent.length ? (
        <section className="mt-5">
          <h2 className="text-sm font-bold">{t('recent')}</h2>
          {/* Bosilganda faqat maydonga yoziladi: qidiruvni odamning o'zi boshlasin,
              chunki 6 soatdan eski raqam yangi qidiruv sifatida kvotadan yeydi */}
          <div className="tg-strip -mx-4 mt-2 px-4">
            {me.recent.map((x) => (
              <button
                key={x.wagonNo} type="button" onClick={() => { haptic(); setText(x.wagonNo); }}
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

/** Xatodan holat: saytdagi bilan bir xil kodlar, yangisi o'ylab topilmaydi. */
function errState(e: unknown): St {
  // Kutish tugadi yoki so'rov uzildi: ikkalasi ham "manba javob bermadi"
  if (e instanceof DOMException) return { s: 'err', code: 'WAGON_UPSTREAM' };
  const status = e instanceof ApiError ? e.status : 0;
  if (status === 401) return { s: 'guest' };
  if (status === 402) return { s: 'subscribe', priceSom: (e as ApiError).body?.priceSom };
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
