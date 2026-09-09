'use client';
// Yangi terminal: forma saqlangach o'z sahifasiga (/dashboard/terminals/[id]) o'tadi.
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TerminalEditor } from '@/components/terminal/TerminalForm';

export default function NewTerminalPage() {
  const t = useTranslations('terminalsAdmin.form');
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/dashboard/terminals" className="hover:text-navy">{t('backToList')}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold">{t('titleNew')}</h1>
      <div className="mt-6"><TerminalEditor /></div>
    </main>
  );
}
