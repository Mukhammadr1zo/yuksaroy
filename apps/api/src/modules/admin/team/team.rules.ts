/** Platforma jamoasi: sof qoidalar (DB yo'q), shuning uchun sinovdan o'tkazish oson. */
import type { Role } from '@prisma/client';

/** Panelga kira oladigan ikki daraja. Nomi mijoz tilida: "ega" va "moderator". */
export const TEAM_LEVELS = ['owner', 'moderator'] as const;
export type TeamLevel = (typeof TEAM_LEVELS)[number];

/** Platforma huquqini beradigan rollar. Boshqa rollar (CLIENT, CARRIER...) bu yerga aralashmaydi. */
export const PLATFORM_ROLES: readonly Role[] = ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'];

export const roleOf = (level: TeamLevel): Role => (level === 'owner' ? 'PLATFORM_ADMIN' : 'PLATFORM_OPERATOR');

/** Qatorda ikkalasi ham bo'lsa kuchliroq daraja g'olib: huquqni kam ko'rsatish xavfli. */
export const levelOf = (roles: readonly Role[]): TeamLevel | null =>
  roles.includes('PLATFORM_ADMIN') ? 'owner' : roles.includes('PLATFORM_OPERATOR') ? 'moderator' : null;

/** Boshqa rollarni saqlab, faqat platforma rollarini olib tashlaydi. */
export const withoutPlatformRoles = (roles: readonly Role[]): Role[] => roles.filter((r) => !PLATFORM_ROLES.includes(r));

export type TeamDenial = 'SELF' | 'FROM_ENV' | null;

/**
 * Jamoani o'zgartirishga ruxsat.
 *
 * `SELF`: odam o'zining darajasini pasaytira yoki o'zini o'chira olmaydi. Aks holda yagona
 * ega tasodifan o'zini chiqarib yuborib, panelga hech kim kira olmay qolardi (qaytarish
 * yo'li faqat serverdagi .env orqali).
 *
 * `FROM_ENV`: huquqi PLATFORM_ADMIN_PHONES dan kelgan odamni paneldan olib bo'lmaydi,
 * chunki u rol jadvalida emas, server sozlamasida turibdi: o'chirsak ham qaytib kelardi.
 */
export function teamDenial(actorId: string, targetId: string, targetFromEnv: boolean): TeamDenial {
  if (actorId === targetId) return 'SELF';
  if (targetFromEnv) return 'FROM_ENV';
  return null;
}
