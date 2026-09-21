'use client';
/**
 * Telefon raqami. Ilgari raqam sahifada ochiq turardi: e'londa hammaga, reestrda
 * kirgan foydalanuvchiga. Endi u obunachiga, bosilganda, GET /contacts/:kind/:id
 * orqali keladi. Sahifaning o'zi keshlangan va cookie'siz, shuning uchun raqam
 * faqat brauzerdan olinadi.
 *
 * 401: kirish kerak, 402: obuna kerak, 429: kunlik chegara tugagan. Ochilgani
 * "contact" mayog'i bilan ham yuboriladi: egasining tahlil sahifasida "nechta
 * qo'ng'iroq" qatori shundan hisoblanadi (server auditi bu qatorni bermaydi).
 *
 * Boshlang'ich holat server va brauzerda bir xil (idle): sessiya faqat brauzerda
 * bilinadi, uni birinchi chizishda o'qish gidratsiya nomuvofiqligi berardi.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LockSimpleIcon, PhoneIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { ApiError, api, hasSession, post, tgTokens } from '@/lib/api';

type Kind = 'listing' | 'terminal' | 'siding' | 'org';
type State =
  | { s: 'idle' } | { s: 'busy' } | { s: 'phone'; phone: string }
  | { s: 'login' } | { s: 'subscribe' } | { s: 'limit' } | { s: 'none' } | { s: 'err' };

export function PhoneReveal({ kind, targetId, next }: { kind: Kind; targetId: string; next: string }) {
  const t = useTranslations('subscription.reveal');
  const [st, setSt] = useState<State>({ s: 'idle' });
  // Mehmonga darrov nima qilish kerakligi ko'rinsin: bosib, keyin bilib o'tirmasin
  useEffect(() => { if (!hasSession()) setSt({ s: 'login' }); }, []);

  async function reveal() {
    setSt({ s: 'busy' });
    try {
      const r = await api<{ phone: string | null }>(`/contacts/${kind}/${encodeURIComponent(targetId)}`);
      setSt(r.phone ? { s: 'phone', phone: r.phone } : { s: 'none' });
      if (r.phone) void post('/events/impressions', { items: [{ kind, targetId, surface: 'contact' }] }).catch(() => {});
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setSt(status === 401 ? { s: 'login' } : status === 402 ? { s: 'subscribe' } : status === 429 ? { s: 'limit' } : status === 404 ? { s: 'none' } : { s: 'err' });
    }
  }

  const hint = 'inline-flex flex-wrap items-center gap-1.5 text-sm text-muted';
  const cta = 'font-semibold text-teal-ink underline underline-offset-4 hover:text-navy';

  if (st.s === 'phone') {
    return (
      <a href={`tel:${st.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-navy hover:text-teal-ink">
        <PhoneIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />{st.phone}
      </a>
    );
  }
  if (st.s === 'login') return <p className={hint}><LockSimpleIcon size={14} aria-hidden="true" />{t('login')} <Link href={`/login?next=${next}`} className={cta}>{t('loginCta')}</Link></p>;
  if (st.s === 'subscribe') {
    // Telegram Mini App da kabinet cookie'si yo'q: /dashboard u yerda kirish sahifasiga qaytaradi.
    // Shuning uchun obuna sahifasi tashqi brauzerda ochiladi.
    const inTg = tgTokens() !== null;
    return (
      <p className={hint}>
        <LockSimpleIcon size={14} aria-hidden="true" />{t('subscribe')}{' '}
        {inTg
          ? <a href="https://yuksaroy.uz/dashboard/subscription" target="_blank" rel="noreferrer" className={cta}>{t('subscribeCta')}</a>
          : <Link href="/dashboard/subscription" className={cta}>{t('subscribeCta')}</Link>}
      </p>
    );
  }
  if (st.s === 'limit') return <p className={hint}>{t('limit')}</p>;
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
