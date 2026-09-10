'use client';
// Buyurtmalar: uch navbat bitta sahifada - menga kelgan talabnomalar, men bergan buyurtmalar,
// shoshilinch so'rovlar. Ilgari bular uchta alohida yo'l edi va menyudan ko'rinmasdi.
// Terminal bandi faqat terminali borlarga chiqadi: boshqasiga bo'sh navbat ko'rsatishdan foyda yo'q.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { CHIP } from '@/components/kabinet/bits';
import { MyOrders } from '@/components/kabinet/work/MyOrders';
import { TerminalBoard } from '@/components/kabinet/work/TerminalBoard';
import { UrgentMine } from '@/components/kabinet/work/UrgentMine';

type Tab = 'incoming' | 'mine' | 'urgent';
type Summary = { terminals: number; byStatus: Record<string, number> };
const isTab = (v: string | null): v is Tab => v === 'incoming' || v === 'mine' || v === 'urgent';

export default function WorkPage() {
  const t = useTranslations('kabinet.work');
  const tc = useTranslations('kabinet.common');
  const router = useRouter();
  const q = useSearchParams().get('tab');
  const [summary, setSummary] = useState<Summary | null>(null);

  // Terminal bormi va nechta talabnoma kutmoqda: shu bitta so'rov bandlar ro'yxatini ham, nishonni ham beradi
  useEffect(() => {
    api<Summary>('/orders/summary').then(setSummary).catch(() => setSummary({ terminals: 0, byStatus: {} }));
  }, []);

  const hasTerminal = (summary?.terminals ?? 0) > 0;
  const tabs: Tab[] = hasTerminal ? ['incoming', 'mine', 'urgent'] : ['mine', 'urgent'];
  // Havoladagi ?tab= ustun turadi; bo'lmasa terminal egasi kelgan talabnomalardan boshlaydi
  const tab: Tab = isTab(q) && (q !== 'incoming' || hasTerminal) ? q : hasTerminal ? 'incoming' : 'mine';
  const pending = summary?.byStatus?.PENDING ?? 0;

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>

      {summary ? (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {tabs.map((k) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => router.replace(`?tab=${k}`, { scroll: false })} className={CHIP(tab === k)}>
                {t(`tab.${k}`)}
                {k === 'incoming' && pending ? <span className={`ml-1.5 font-mono text-xs ${tab === k ? 'text-white/70' : 'text-amber-ink'}`}>{pending}</span> : null}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === 'incoming' ? <TerminalBoard /> : null}
            {tab === 'mine' ? <MyOrders /> : null}
            {tab === 'urgent' ? <UrgentMine /> : null}
          </div>
        </>
      ) : <p className="mt-6 text-sm text-muted">{tc('loading')}</p>}
    </>
  );
}
