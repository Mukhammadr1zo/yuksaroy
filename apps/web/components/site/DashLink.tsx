'use client';
// Kabinet havolasi: kirgan foydalanuvchi to'g'ri manzilga, mehmon ro'yxatdan o'tishga boradi.
// Ochiq manzil (masalan /terminals) hamma uchun oddiy havola bo'lib qoladi.
// signupLabel berilsa mehmonga kabinet amali ("Terminal qo'shish") emas, ro'yxat taklifi ko'rinadi.
import { Link } from '@/i18n/navigation';
import { useAuthed } from './AuthOnly';

export function DashLink({ href, className, children, signupLabel, onClick }: {
  href: string; className?: string; children: React.ReactNode; signupLabel?: string; onClick?: () => void;
}) {
  const authed = useAuthed();
  if (!href.startsWith('/dashboard')) return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
  if (authed === undefined) return null;
  if (authed) return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
  return <Link href={`/signup?next=${encodeURIComponent(href)}`} className={className} onClick={onClick}>{signupLabel ?? children}</Link>;
}
