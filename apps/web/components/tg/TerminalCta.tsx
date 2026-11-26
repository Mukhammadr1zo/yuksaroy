'use client';
// Terminal sahifasining mijoz qismi: telefon (PhoneReveal: veb bilan bir xil obuna qoidasi), "Slot band qilish" (MainButton ham), "Xaritada".
import { useLocale, useTranslations } from 'next-intl';
import { CaretRightIcon, MapTrifoldIcon } from '@phosphor-icons/react';
import { Link, useRouter } from '@/i18n/navigation';
import { PhoneReveal } from '@/components/catalog/PhoneReveal';
import { ChatLauncher } from '@/components/chat/ChatPanel';
import { haptic, useMainButton, useTg } from './TgProvider';
import { BTN, BTN_GHOST, CARD } from './bits';

export function TerminalCta({ id, slug, lat, lng, hasPhone, isDemo }: { id: string; slug: string; lat: number | null; lng: number | null; hasPhone: boolean; isDemo: boolean }) {
  const t = useTranslations('tg.terminal');
  const tr = useTranslations('terminal');
  const router = useRouter();
  const book = () => { haptic('medium'); router.push(`/tg/book/${slug}`); };
  // Namuna terminalda joy band qilinmaydi (egasi qarori, 2026-10-07): MainButton ham yashirin
  useMainButton({ text: t('book'), onClick: book, show: !isDemo });
  return (
    <div className="mt-3 space-y-2">
      {/* Ikki harakat bitta guruh: yonma-yon teng 48 px tugmalar (telefon ikkinchi darajali, bron asosiy); bittasi bo'lsa to'liq kenglik. Qoidalar tg.css da */}
      <div className="tg-cta empty:hidden">
        {/* Raqam obunachiga, bosilganda (veb sahifa bilan bir xil /contacts qoidasi): bepul ochilmaydi */}
        {hasPhone ? <div className="tg-phone"><PhoneReveal kind="terminal" targetId={id} next={`/tg/terminals/${slug}`} /></div> : null}
        {isDemo ? null : <button type="button" onClick={book} className={BTN.replace('min-h-11', 'min-h-12')}>{t('book')}</button>}
      </div>
      {hasPhone ? null : <p className="px-1 text-sm text-muted">{t('noPhone')}</p>}
      {isDemo ? <p className="rounded-xl border border-dashed border-line bg-sand px-3 py-2 text-sm text-muted">{tr('demoNoBook')}</p> : null}
      {lat != null && lng != null ? (
        <Link href={`/tg/map?cat=terminal&c=${lng},${lat}&z=12`} onClick={() => haptic()} className={BTN_GHOST}><MapTrifoldIcon size={18} className="mr-2" aria-hidden="true" />{t('map')}</Link>
      ) : null}
    </div>
  );
}

/**
 * Reestr shahobchasi (egasi tasdiqlamagan): bron va tarif yo'q, shuning uchun yo'l shu yerda tugamasin.
 * Telefon obunachiga (PhoneReveal), yozishma platformaga ketadi (ownerless: egasi yo'q, javobni platforma beradi).
 * ChatLauncher Mini App seansi bilan ishlaydi: u lib/api orqali Bearer token yuboradi.
 */
export function RegistryCta({ id, slug, name, point, hasPhone, isDemo, more }: {
  id: string; slug: string; name: string; point: { lat: number; lng: number } | null; hasPhone: boolean; isDemo: boolean; more: { n: number; href: string } | null;
}) {
  const t = useTranslations('tg.terminal');
  const tr = useTranslations('terminal');
  // Egasiz obyekt: javobni kim berishini yozish tugmasi ostida ko'rsatamiz (chat oynasidagi bilan bir xil matn)
  const tk = useTranslations('kabinet.chat');
  return (
    <div className="mt-3 space-y-2">
      <div className="tg-cta empty:hidden">
        {hasPhone ? <div className="tg-phone"><PhoneReveal kind="terminal" targetId={id} next={`/tg/terminals/${slug}`} /></div> : null}
        {/* Namunaning egasi yo'q va API yozishmani rad etadi (DEMO_TARGET): tugma o'rniga sababi */}
        {isDemo ? null : <ChatLauncher target={{ kind: 'terminal', slug, title: name, ownerless: true }} next={`/tg/terminals/${slug}`} />}
      </div>
      {hasPhone ? null : <p className="px-1 text-sm text-muted">{t('noPhone')}</p>}
      {isDemo ? <p className="rounded-xl border border-dashed border-line bg-sand px-3 py-2 text-sm text-muted">{tr('demoNoChat')}</p>
        : <p className="px-1 text-center text-xs text-muted">{tk('toPlatform')}</p>}
      {point ? (
        <Link href={`/tg/map?cat=terminal&c=${point.lng},${point.lat}&z=12`} onClick={() => haptic()} className={BTN_GHOST}><MapTrifoldIcon size={18} className="mr-2" aria-hidden="true" />{t('map')}</Link>
      ) : null}
      {more ? (
        <Link data-station-more href={more.href} onClick={() => haptic()} className={`${CARD} flex min-h-14 items-center justify-between gap-3 px-4 py-2 text-sm font-semibold active:bg-sand`}>
          <span>{t('sameStation', { count: more.n })}</span><CaretRightIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/** "Bu obyekt siznikimi?": da'vo saytda yuboriladi (kabinet cookie'si kerak), shuning uchun tashqi brauzerda ochiladi va buni oldindan aytamiz. */
export function ClaimOnSite({ slug }: { slug: string }) {
  const t = useTranslations('tg.terminal');
  const lang = useLocale();
  const { tg } = useTg();
  const open = () => { haptic(); const url = `${window.location.origin}${lang === 'uz' ? '' : `/${lang}`}/terminals/${slug}`; if (tg) tg.openLink(url); else window.open(url, '_blank', 'noopener'); };
  return (
    <section className={`${CARD} mt-4 p-4`}>
      <h2 className="text-sm font-bold">{t('claimTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('claimBody')}</p>
      <button type="button" onClick={open} className={`${BTN_GHOST} mt-3`}>{t('claimCta')}</button>
    </section>
  );
}
