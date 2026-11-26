'use client';
/**
 * Ro'yxat tugmasi va to'lov formasi ostidagi bitta qator.
 *
 * Katakcha yo'q va bazaga hech narsa yozilmaydi: rozilik amalning o'zidan bilinadi.
 * Saqlanadigan ustun qo'shilsa u faqat hisobot uchun yashaydigan o'lik maydon bo'lardi,
 * va har bir versiya uchun yana bitta ustun kerak bo'lardi.
 *
 * Matn nav2 nomfazosida: hujjatlarning o'zi mijoz yukiga tushmasin (LegalPage izohiga qarang).
 */
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const A = 'font-semibold text-teal-ink hover:underline';

export function ConsentLine({ className = '' }: { className?: string }) {
  const t = useTranslations('nav2');
  const locale = useLocale();
  // Mini App ichida hujjat web view'ni almashtirmasin (Orqaga ilovaga qaytmasdi): Telegram brauzerida ochiladi.
  // Tekshiruv bosilganda: render paytida window yo'q (server), saytda esa Telegram obyekti yo'q
  const out = (path: string) => (e: React.MouseEvent) => {
    const w = window.Telegram?.WebApp;
    if (!w?.initData) return;
    e.preventDefault();
    w.openLink(`${window.location.origin}${locale === 'uz' ? '' : `/${locale}`}${path}`);
  };
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      {t.rich('consent', {
        terms: (c) => <Link href="/terms" onClick={out('/terms')} className={A}>{c}</Link>,
        privacy: (c) => <Link href="/privacy" onClick={out('/privacy')} className={A}>{c}</Link>,
      })}
    </p>
  );
}
