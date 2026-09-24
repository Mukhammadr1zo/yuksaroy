'use client';
// Terminalni boshqarish: egasi ro'yxatidan (GET /terminals/mine) id bo'yicha topiladi (ommaviy GET faqat ACTIVE va slug bilan).
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { MyTerminal } from '@/lib/types-kabinet';
import { TerminalEditor } from '@/components/terminal/TerminalForm';
import { QuickOffer } from '@/components/terminal/QuickOffer';

export default function EditTerminalPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('terminalsAdmin.form');
  const tc = useTranslations('kabinet.common');
  const [term, setTerm] = useState<MyTerminal | null | undefined>(undefined);

  useEffect(() => {
    api<MyTerminal[]>('/terminals/mine').then((xs) => setTerm(xs.find((x) => x.id === id) ?? null)).catch(() => setTerm(null));
  }, [id]);

  return (
    <main className="mx-auto max-w-4xl">
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/dashboard/terminals" className="hover:text-navy">{t('backToList')}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold">{term?.name ?? t('titleEdit')}</h1>
      {term ? <div className="mt-6"><QuickOffer term={term} /></div> : null}
      <div className="mt-6">
        {term === undefined ? <p className="text-sm text-muted">{tc('loading')}</p> : term === null ? <p className="text-muted">{t('notFound')}</p> : <TerminalEditor initial={term} />}
      </div>
    </main>
  );
}
