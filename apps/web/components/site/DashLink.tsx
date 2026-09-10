'use client';
// Marketing sahifalaridagi harakat tugmasi: kirgan foydalanuvchi kabinetga, mehmon ro'yxatdan o'tishga boradi.
// Mehmonga kabinet manzili ko'rsatilmaydi (tugma bosilganda bo'sh sahifaga tushmaydi).
import { Link } from '@/i18n/navigation';
import { useAuthed } from './AuthOnly';

export function DashLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const authed = useAuthed();
  const to = authed ? href : `/signup?next=${encodeURIComponent(href)}`;
  return <Link href={to} className={className}>{children}</Link>;
}
