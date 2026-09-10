'use client';
// Platformaning umumiy raqamlari: nima bor. Har son bitta savolga javob beradi, bezak emas.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { num } from '@/lib/format';

type Overview = { users: number; blocked: number; orgs: number; terminals: number; sidings: number; listings: number; orders: number; inquiries: number; messages: number; reviews: number };
const KEYS: (keyof Overview)[] = ['users', 'blocked', 'orgs', 'terminals', 'sidings', 'listings', 'orders', 'inquiries', 'messages', 'reviews'];

export function AdminOverview() {
  const t = useTranslations('admin.overview');
  const locale = useLocale();
  const [d, setD] = useState<Overview | null>(null);
  useEffect(() => { api<Overview>('/admin/overview').then(setD).catch(() => {}); }, []);
  if (!d) return null;
  return (
    <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {KEYS.map((k) => (
        <div key={k} className="rounded-card border border-line bg-white px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{t(k)}</dt>
          <dd className={`font-display text-lg font-bold tabular-nums ${k === 'blocked' && d[k] ? 'text-red-700' : 'text-navy'}`}>{num(d[k], locale)}</dd>
        </div>
      ))}
    </dl>
  );
}
