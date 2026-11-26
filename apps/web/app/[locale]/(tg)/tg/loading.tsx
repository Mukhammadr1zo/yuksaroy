'use client';
// Server sahifalariga (qidiruv, xarita, terminal, e'lon) o'tishda darhol ko'rinadigan skelet: bosilgan zahoti javob bor.
// main emas, div: kirish animatsiyasi faqat haqiqiy sahifada bir marta o'ynaydi. Client: matn qobiqdagi next-intl provayderidan,
// server so'rovi tilini o'qimaydi (statik render buzilmaydi).
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/tg/bits';

export default function TgLoading() {
  const t = useTranslations('tg.common');
  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-4" role="status">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-7 w-44 animate-pulse rounded-lg bg-line/60" />
      <div className="mt-4"><Skeleton n={4} h="h-24" /></div>
    </div>
  );
}
