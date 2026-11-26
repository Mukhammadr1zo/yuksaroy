'use client';
// Mini App ichidagi 404 (eskirgan havola, noto'g'ri start_param): saytning 404 sahifasi emas, ilova ko'rinishida qidiruv va bosh sahifa.
import { useTranslations } from 'next-intl';
import { LinkBreakIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { haptic } from '@/components/tg/TgProvider';
import { BTN, BTN_GHOST } from '@/components/tg/bits';

export default function TgNotFound() {
  const t = useTranslations('tg.state');
  return (
    <main id="main" className="mx-auto flex max-w-md flex-col items-center px-6 pb-8 pt-16 text-center">
      <LinkBreakIcon size={48} weight="duotone" className="text-muted" aria-hidden="true" />
      <h1 className="font-display mt-4 text-xl font-bold">{t('notFound')}</h1>
      <p className="mt-2 max-w-[34ch] text-sm text-muted">{t('notFoundBody')}</p>
      <div className="mt-6 w-full max-w-xs space-y-2">
        <Link href="/tg/search" onClick={() => haptic()} className={BTN}>{t('search')}</Link>
        <Link href="/tg" onClick={() => haptic()} className={BTN_GHOST}>{t('home')}</Link>
      </div>
    </main>
  );
}
