import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { QuickQuote } from '@/components/catalog/QuickQuote';
import { sapiOrNull } from '@/lib/server-api';
import type { TerminalDetail } from '@/lib/types';
import { alt } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.quote' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/quote') };
}

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ terminal?: string }> }) {
  const { terminal } = await searchParams;
  const t = await getTranslations('quote');
  // ponytail: terminal nomi uchun id → slug qidiruvi yo'q; ro'yxatdan topamiz (≤ 200 obyekt)
  const tt = terminal ? await sapiOrNull<{ items: TerminalDetail[] }>('/terminals?limit=50').then((r) => r?.items.find((x) => x.id === terminal) ?? null) : null;
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('heading')}</h1>
      <p className="mt-2 text-muted">{t('lead.prefix')} <span className="font-mono">{t('lead.formula')}</span>{t('lead.suffix')}</p>
      <div className="mt-6 rounded-card border border-line bg-white p-5">
        <QuickQuote terminalId={tt?.id} terminalName={tt?.name} />
      </div>
      <p className="mt-4 text-xs text-muted">{t('disclaimer')}</p>
    </div>
  );
}
