'use client';
// Sarlavhaning o'ng tomoni: mehmonga "Kirish", kirgan foydalanuvchiga qo'shish, bildirishnoma va menyu.
// Sayt qobig'i o'zgarmaydi, faqat shu qism almashadi.
import { useTranslations } from 'next-intl';
// Mehmonning "Kirish" tugmasi ham sarlavhada, har sahifada: oldindan yuklash faqat niyat bilinganda
import { IntentLink as Link } from './IntentLink';
import { AddMenu } from './AddMenu';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { useMe } from './useMe';

export function AuthArea() {
  const t = useTranslations('nav');
  const me = useMe();
  if (me === undefined) return <span className="h-9 w-9" aria-hidden="true" />;
  if (!me) return <Link href="/login" className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-ink">{t('login')}</Link>;
  return (
    <>
      <AddMenu />
      <NotificationBell />
      <UserMenu />
    </>
  );
}
