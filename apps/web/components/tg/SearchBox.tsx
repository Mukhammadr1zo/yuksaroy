'use client';
// Qidiruv qatori: yuborilganda /tg/search?q= (toifa saqlanadi). Server sahifa ichidagi kichik mijoz oroli.
import { useState } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useRouter } from '@/i18n/navigation';
import { haptic } from './TgProvider';

export function SearchBox({ initial, cat, placeholder }: { initial: string; cat?: string; placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); haptic(); router.push(`/tg/search?q=${encodeURIComponent(q.trim())}${cat ? `&cat=${cat}` : ''}`); }} className="relative">
      <MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} enterKeyHint="search" aria-label={placeholder} className="min-h-12 w-full rounded-full border border-field bg-white pl-10 pr-4 text-base text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/25" />
    </form>
  );
}
