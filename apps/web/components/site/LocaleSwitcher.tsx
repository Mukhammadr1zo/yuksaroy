'use client';
// Til almashtirgich: tanlov NEXT_LOCALE cookie'siga yoziladi va URL prefiksi almashadi.
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

const LABEL: Record<Locale, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };
const SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const ta = useTranslations('a11y');
  const [pending, startTransition] = useTransition();
  const current = (params?.locale as Locale) ?? routing.defaultLocale;

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-line bg-white p-0.5" role="group" aria-label={ta('locale')}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          title={LABEL[l]}
          aria-current={l === current ? 'true' : undefined}
          disabled={pending}
          onClick={() =>
            // query va hash saqlanadi (filtrlar yo'qolmasin)
            startTransition(() => router.replace(pathname + window.location.search + window.location.hash, { locale: l }))
          }
          className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors duration-200 ${
            l === current ? 'bg-navy text-white' : 'text-muted hover:text-navy'
          }`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
