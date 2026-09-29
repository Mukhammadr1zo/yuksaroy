'use client';
// Admin qobig'ining umumiy holati: kim kirgan (me/isOwner), yon menyu sanoqlari, nonushta yo'li va paletani ochish.
// Ekranlar /auth/me ni qayta so'ramaydi va AdminShell ga prop uzatmaydi: hammasi shu kontekstdan olinadi.
// Bu fayl C va D agentlari uchun shartnoma (contracts.md 4-bo'lim): imzolar o'zgarmaydi.
import { createContext, useContext, useEffect } from 'react';
import type { Me } from '@/lib/types-auth';

export type AdminCtx = {
  me: Me;
  isOwner: boolean;
  /** Yon menyu nishonlari: pending, ordersPending, urgentOpen (AdminShell to'ldiradi). */
  counts: Record<string, number>;
  /** Topbar dagi nonushta yo'lining oxirgi bo'g'ini: obyekt sahifasi nomini shu yerga yozadi. */
  crumb: string | null;
  setCrumb: (l: string | null) => void;
  openPalette: (mode?: 'search' | 'keys') => void;
};

export const AdminContext = createContext<AdminCtx | null>(null);

/** Provider yo'q bo'lsa jim ishlamaydi: admin ekrani qobiqdan tashqarida chizilgani darhol bilinsin. */
export function useAdminShell(): AdminCtx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdminShell: AdminShell provider yo\'q');
  return ctx;
}

export function useAdminMe(): { me: Me; isOwner: boolean } {
  const { me, isOwner } = useAdminShell();
  return { me, isOwner };
}

/** Sahifa nomini nonushta yo'liga yozadi; sahifadan chiqqanda tozalaydi, aks holda eski nom keyingi sahifada qoladi. */
export function useAdminCrumb(label: string | null | undefined): void {
  const { setCrumb } = useAdminShell();
  useEffect(() => {
    setCrumb(label ?? null);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}
