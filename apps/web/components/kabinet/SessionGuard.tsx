'use client';
// Sessiya bekor qilingan bo'lsa kabinet sahifalari abadiy "yuklab bo'lmadi" ko'rsatardi.
// Bitta joyda tekshiriladi: 401 bo'lsa kirish sahifasiga, qaytib kelish manzili bilan.
import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api, clearAuthedCache } from '@/lib/api';

export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    api('/auth/me').catch(() => { clearAuthedCache(); router.replace(`/login?next=${encodeURIComponent(pathname)}`); });
  }, [pathname, router]);
  return null;
}
