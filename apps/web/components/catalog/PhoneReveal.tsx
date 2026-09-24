'use client';
/**
 * Telefon raqami. Ilgari raqam sahifada ochiq turardi: e'londa hammaga, reestrda
 * kirgan foydalanuvchiga. Endi u obunachiga, bosilganda, GET /contacts/:kind/:id
 * orqali keladi. Sahifaning o'zi keshlangan va cookie'siz, shuning uchun raqam
 * faqat brauzerdan olinadi.
 *
 * 401: kirish kerak, 402: obuna kerak, 429: kunlik chegara tugagan. Ochilganini
 * server o'zi sanaydi: kim ochgani auditga, soni esa egasining ko'rsatkichlariga
 * o'sha yerda yoziladi.
 *
 * Raqam ochilgandan keyin "ishlamadimi" havolasi turadi: u murojaat formasini mavzu va
 * obyekt belgisi bilan oldindan to'ldirib ochadi (forma platforma adminlariga ketadi).
 *
 * Boshlang'ich holat server va brauzerda bir xil (idle): sessiya faqat brauzerda
 * bilinadi, uni birinchi chizishda o'qish gidratsiya nomuvofiqligi berardi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LockSimpleIcon, PhoneIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { PLATFORM_DEFAULTS } from '@yuksaroy/domain';
import { ApiError, api, hasSession, tgTokens } from '@/lib/api';
import { num } from '@/lib/format';

type Kind = 'listing' | 'terminal' | 'org' | 'service' | 'request' | 'offer';
type State =
  | { s: 'idle' } | { s: 'busy' } | { s: 'phone'; phone: string }
  // 429 da used va limit har doim teng, shuning uchun bitta son saqlanadi
  | { s: 'login' } | { s: 'subscribe'; priceSom: number; dailyLimit: number; freeTotal: number } | { s: 'limit'; limit: number } | { s: 'none' } | { s: 'err' };

export function PhoneReveal({ kind, targetId, next }: { kind: Kind; targetId: string; next: string }) {
  const t = useTranslations('subscription.reveal');
  const locale = useLocale();
  const [st, setSt] = useState<State>({ s: 'idle' });
  // Nusxalash holati shu yerda: hook shox ichida chaqirilmaydi
  const [copied, setCopied] = useState(false);
  // Mehmonga darrov nima qilish kerakligi ko'rinsin: bosib, keyin bilib o'tirmasin
  useEffect(() => { if (!hasSession()) setSt({ s: 'login' }); }, []);

  async function reveal() {
    setSt({ s: 'busy' });
    try {
      const r = await api<{ phone: string | null }>(`/contacts/${kind}/${encodeURIComponent(targetId)}`);
      setSt(r.phone ? { s: 'phone', phone: r.phone } : { s: 'none' });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      // JSON bo'lmagan javobda tana null keladi: sonlar sukut sozlamaga tayanadi,
      // devor raqamsiz qolib komponent yiqilmasin
      const b = (e instanceof ApiError ? (e.body as { priceSom?: number; dailyLimit?: number; limit?: number; freeTotal?: number } | null) : null) ?? {};
      setSt(
        status === 401 ? { s: 'login' }
          : status === 402 ? { s: 'subscribe', priceSom: b.priceSom ?? PLATFORM_DEFAULTS.subscriptionMonthSom, dailyLimit: b.dailyLimit ?? PLATFORM_DEFAULTS.phoneRevealDaily, freeTotal: b.freeTotal ?? 0 }
            : status === 429 ? { s: 'limit', limit: b.limit ?? PLATFORM_DEFAULTS.phoneRevealDaily }
              : status === 404 ? { s: 'none' } : { s: 'err' });
    }
  }

  const hint = 'inline-flex flex-wrap items-center gap-1.5 text-sm text-muted';
  const cta = 'font-semibold text-teal-ink underline underline-offset-4 hover:text-navy';

  if (st.s === 'phone') {
    // Obyekt belgisi kind va targetId dan olinadi, next dan emas: bitta chaqiruv joyida
    // next obyekt sahifasi emas. Raqamning o'zi matnga qo'yilmaydi: u brauzer tarixida qolmasin.
    // span, div emas: chaqiruv joylaridan biri <p> ichida turadi (tg/ListingView).
    const report = `/contact?topic=badphone&text=${encodeURIComponent(t('badPhoneText', { ref: `${kind}/${targetId}` }))}`;
    return (
      <span className="inline-flex flex-col items-start gap-1">
        {/* flex-wrap: tor ustunlarda (kompaniya kartasi, do'kon yon ustuni) raqam va tugma bir qatorga sig'maydi */}
        <span className="inline-flex flex-wrap items-center gap-2">
          <a href={`tel:${st.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-navy hover:text-teal-ink">
            <PhoneIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />{st.phone}
          </a>
          {/* Xavfsiz bo'lmagan ulanishda nusxalash ishlamaydi: raqamning o'zi ko'rinib turaveradi */}
          <button
            type="button"
            onClick={async () => { try { await navigator.clipboard.writeText(st.phone); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}
            className="rounded-full border border-line px-2 py-0.5 text-xs text-muted transition hover:border-teal hover:text-teal-ink"
          >{copied ? t('copied') : t('copy')}</button>
        </span>
        <Link href={report} className="text-xs text-muted underline underline-offset-4 hover:text-teal-ink">{t('badPhone')}</Link>
      </span>
    );
  }
  if (st.s === 'login') return <p className={hint}><LockSimpleIcon size={14} aria-hidden="true" />{t('login')} <Link href={`/login?next=${encodeURIComponent(next)}`} className={cta}>{t('loginCta')}</Link></p>;
  if (st.s === 'subscribe') {
    // Telegram Mini App da kabinet cookie'si yo'q: /dashboard u yerda kirish sahifasiga qaytaradi,
    // shuning uchun Mini App o'z obuna sahifasiga boradi (karta bir xil)
    // To'rt qator: nima ochiladi, qancha turadi, nimasi bepul, va bepul oyna
    // tugagani (oyna yoqilgan bo'lsa). Bitta qator bilan odam qaror qila olmasdi
    // va narxni izlab ketardi.
    return (
      <span className="block text-sm text-muted">
        {st.freeTotal > 0 ? <span className="mb-0.5 block">{t('subscribeFreeUsed', { n: st.freeTotal })}</span> : null}
        <span className={hint}><LockSimpleIcon size={14} aria-hidden="true" />{t('subscribeWhat')}</span>
        <span className="mt-0.5 block">{t('subscribePrice', { price: num(st.priceSom, locale), n: st.dailyLimit })}</span>
        <span className="mt-0.5 block">{t('subscribeChat')}</span>
        <Link href={tgTokens() !== null ? '/tg/subscription' : '/dashboard/subscription'} className={`${cta} mt-1 inline-block`}>{t('subscribeCta')}</Link>
      </span>
    );
  }
  if (st.s === 'limit') return <p className={hint}>{t('limitCount', { n: st.limit })}</p>;
  if (st.s === 'none') return <p className={hint}>{t('none')}</p>;
  if (st.s === 'err') return <p className={hint}>{t('err')} <button type="button" onClick={reveal} className={cta}>{t('retry')}</button></p>;
  return (
    <button
      type="button" onClick={reveal} disabled={st.s === 'busy'}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:border-teal hover:text-teal-ink disabled:opacity-60"
    >
      <PhoneIcon size={16} aria-hidden="true" />{st.s === 'busy' ? t('loading') : t('show')}
    </button>
  );
}
