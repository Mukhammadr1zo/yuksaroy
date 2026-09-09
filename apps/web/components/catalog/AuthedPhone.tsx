'use client';
// Telefon faqat kirganlarga (1A): server fetch cookie yubormaydi, shuning uchun brauzerdan olinadi (muddati o'tgan access lib/api da yangilanadi).
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function AuthedPhone({ path, field, none }: { path: string; field: string; none: string }) {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      await api('/auth/me').catch(() => null);
      const d = await api<Record<string, unknown>>(path).catch(() => null);
      setPhone(typeof d?.[field] === 'string' ? (d[field] as string) : null);
    })();
  }, [path, field]);
  if (phone === undefined) return <span className="font-mono text-sm text-muted">...</span>;
  return phone ? <a href={`tel:${phone}`} className="font-mono text-sm font-semibold text-navy hover:text-teal-ink">{phone}</a> : <span className="text-sm text-muted">{none}</span>;
}
