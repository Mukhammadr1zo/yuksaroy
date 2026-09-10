'use client';
// Kabinet havolasi: kirgan foydalanuvchi to'g'ri manzilga, mehmon ro'yxatdan o'tishga boradi.
// Ochiq manzil (masalan /terminals) hamma uchun oddiy havola bo'lib qoladi.
// signupLabel berilsa mehmonga kabinet amali ("Terminal qo'shish") emas, ro'yxat taklifi ko'rinadi.
import { Link } from '@/i18n/navigation';
import { useAuthed } from './AuthOnly';

export function DashLink({ href, className, children, signupLabel }: {
  href: string; className?: string; children: React.ReactNode; signupLabel?: string;
}) {
  const authed = useAuthed();
  if (!href.startsWith('/dashboard')) return <Link href={href} className={className}>{children}</Link>;
  if (authed === undefined) return null;
  if (authed) return <Link href={href} className={className}>{children}</Link>;
  return <Link href={`/signup?next=${encodeURIComponent(href)}`} className={className}>{signupLabel ?? children}</Link>;
}
