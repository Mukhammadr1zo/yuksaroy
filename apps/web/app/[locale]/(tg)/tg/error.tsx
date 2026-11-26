'use client';
// Mini App sahifasidagi kutilmagan xato: oq ekran yoki sayt ko'rinishi o'rniga qisqa xabar, qayta urinish va bosh sahifa.
// Tab paneli qobiqda qoladi, foydalanuvchi boshqa bo'limga ham o'ta oladi.
import { useTranslations } from 'next-intl';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { haptic } from '@/components/tg/TgProvider';
import { BTN, BTN_GHOST } from '@/components/tg/bits';

// unstable_retry (Next 16.2): server ma'lumotini qayta so'raydi. reset() faqat qayta chizadi va server xatosida o'sha xato qaytib kelardi.
export default function TgError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const t = useTranslations('tg.state');
  return (
    <main id="main" className="mx-auto flex max-w-md flex-col items-center px-6 pb-8 pt-16 text-center">
      <WarningCircleIcon size={48} weight="duotone" className="text-amber" aria-hidden="true" />
      <h1 className="font-display mt-4 text-xl font-bold">{t('title')}</h1>
      <p role="alert" className="mt-2 max-w-[34ch] text-sm text-muted">{t('body')}</p>
      <div className="mt-6 w-full max-w-xs space-y-2">
        <button type="button" onClick={() => { haptic(); unstable_retry(); }} className={BTN}>{t('retry')}</button>
        <Link href="/tg" onClick={() => haptic()} className={BTN_GHOST}>{t('home')}</Link>
      </div>
    </main>
  );
}
