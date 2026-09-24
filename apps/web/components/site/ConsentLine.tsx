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
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const A = 'font-semibold text-teal-ink hover:underline';

export function ConsentLine({ className = '' }: { className?: string }) {
  const t = useTranslations('nav2');
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      {t.rich('consent', {
        terms: (c) => <Link href="/terms" className={A}>{c}</Link>,
        privacy: (c) => <Link href="/privacy" className={A}>{c}</Link>,
      })}
    </p>
  );
}
