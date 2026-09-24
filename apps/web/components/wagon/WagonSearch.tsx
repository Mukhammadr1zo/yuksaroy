'use client';
/**
 * Vagon qidiruvi: raqam kiritiladi, natija bitta karta: vagon hozir qayerda.
 * Harakat tarixi ko'rsatilmaydi: odamga kerak bo'lgani joriy joylashuv, qolgani shovqin.
 * Mehmonga forma yopiq: kirish havolasi. 402 obuna, 503 xizmat ulanmagan, topilmasa oddiy matn.
 * Stansiya nomlari upstream dan ruscha keladi va shundayligicha ko'rsatiladi: rasmiy nomlar.
 * Boshlang'ich holat server va brauzerda bir xil: sessiya faqat brauzerda bilinadi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LockSimpleIcon, MagnifyingGlassIcon, TrainIcon } from '@phosphor-icons/react';
import { WAGON } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api, hasSession } from '@/lib/api';
import { num, uzDate, uzDateTime, uzToday } from '@/lib/format';
import { BTN_PRIMARY, INPUT, Notice } from '@/components/kabinet/bits';
import type { WagonEvent, WagonMe, WagonQuota, WagonResult } from '@/lib/types-wagon';

type Err = 'WAGON_NO_INVALID' | 'WAGON_NOT_CONFIGURED' | 'WAGON_UPSTREAM' | 'RATE_LIMITED' | 'generic';
type State =
  | { s: 'idle' } | { s: 'guest' } | { s: 'busy' }
  // Narx devor javobidan keladi: odam uni izlab boshqa sahifaga ketmasin
  | { s: 'result'; r: WagonResult } | { s: 'subscribe'; priceSom?: number } | { s: 'err'; code: Err };

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
  const [no, setNo] = useState('');
  const [st, setSt] = useState<State>({ s: 'idle' });
  const [quota, setQuota] = useState<WagonQuota | null>(null);

  useEffect(() => {
    if (!hasSession()) { setSt({ s: 'guest' }); return; }
    api<WagonMe>('/wagon/me').then((m) => { setQuota(m); if (!m.configured) setSt({ s: 'err', code: 'WAGON_NOT_CONFIGURED' }); }).catch(() => {});
  }, []);

  const valid = no.length >= WAGON.noMinDigits && no.length <= WAGON.noMaxDigits;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setSt({ s: 'err', code: 'WAGON_NO_INVALID' }); return; }
    setSt({ s: 'busy' });
    try {
      // Server 10 soniya kutadi; brauzer undan sal ko'proq, keyin "hozir qidirib bo'lmadi"
      const r = await api<WagonResult>('/wagon/search', { method: 'POST', body: JSON.stringify({ no }), signal: AbortSignal.timeout(15_000) });
      setQuota(r.quota);
      setSt({ s: 'result', r });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'TimeoutError') { setSt({ s: 'err', code: 'WAGON_UPSTREAM' }); return; }
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 401) { setSt({ s: 'guest' }); return; }
      if (status === 402) { setSt({ s: 'subscribe', priceSom: (e as ApiError).body?.priceSom }); return; }
      setSt({ s: 'err', code: ERRS[status] ?? 'generic' });
    }
  }

  const guest = st.s === 'guest';
  const cta = 'font-semibold text-teal-ink underline underline-offset-4 hover:text-navy';

  return (
    <div className="min-w-0">
      <form onSubmit={submit} className="rounded-card border border-line bg-white p-5 md:p-6">
        <label htmlFor="wagon-no" className="block text-sm font-semibold">{t('label')}</label>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            id="wagon-no" value={no} disabled={guest || st.s === 'busy'}
            onChange={(e) => setNo(e.target.value.replace(/\D/g, '').slice(0, WAGON.noMaxDigits))}
            inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder={t('placeholder')}
            className={`${INPUT} min-w-0 flex-1 font-mono text-lg tabular-nums tracking-wider`}
          />
          <button type="submit" disabled={guest || st.s === 'busy' || !valid} className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
            <MagnifyingGlassIcon size={18} aria-hidden="true" />{st.s === 'busy' ? t('searching') : t('submit')}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{t('hint')}</p>
        {guest ? (
          <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <LockSimpleIcon size={14} aria-hidden="true" />{t('guest')} <Link href="/login?next=/wagon" className={cta}>{t('loginCta')}</Link>
          </p>
        ) : quota ? (
          <p className="mt-3 text-sm text-muted">
            {quota.subscriber ? t('quotaSub') : t('quotaFree', { left: Math.max(0, quota.freeTotal - quota.freeUsed) })}
            {/* Bepul qidiruv tugagan: odam devorga urilmasdan oldin obunaga yo'l ko'rsin */}
            {!quota.subscriber && quota.freeUsed >= quota.freeTotal ? <> <Link href="/dashboard/subscription" className={cta}>{t('subscribeCta')}</Link></> : null}
          </p>
        ) : null}
      </form>

      <div className="mt-5">
        {st.s === 'subscribe' ? (
          <Notice tone="warn">{t('subscribe')}{st.priceSom ? ` ${t('price', { price: num(st.priceSom, locale) })}` : ''} <Link href="/dashboard/subscription" className={cta}>{t('subscribeCta')}</Link></Notice>
        ) : st.s === 'err' ? (
          <Notice tone={st.code === 'WAGON_NOT_CONFIGURED' ? 'warn' : 'err'}>{t(`errors.${st.code}`)}</Notice>
        ) : st.s === 'result' ? (
          <Result r={st.r} locale={locale} />
        ) : null}
      </div>
    </div>
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
