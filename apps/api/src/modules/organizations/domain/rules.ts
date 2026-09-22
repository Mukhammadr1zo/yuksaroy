// Tashkilot qoidalari: tur -> rollar, admin telefonlari. Sof funksiyalar, DB yo'q.
import { ORG_KIND_ROLES, normalizePhone, type OrgKind, type Role } from '@yuksaroy/domain';

/**
 * Platforma rollari o'z-o'ziga xizmat yo'lidan hech qachon berilmaydi: ular faqat
 * platforma egasi orqali (admin panelidagi Jamoa) beriladi.
 *
 * Bularsiz moderator o'z tashkilotini ochib, uni PLATFORM deb belgilab, o'zini
 * PLATFORM_ADMIN qilib taklif qila olardi va to'liq ega huquqini olardi.
 */
const PLATFORM_ONLY: readonly Role[] = ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'];

/** Tashkilot turlari bo'yicha ruxsat etilgan rollar birlashmasi (platforma rollarisiz). */
export function rolesForKinds(kinds: readonly OrgKind[]): Role[] {
  return [...new Set(kinds.flatMap((k) => ORG_KIND_ROLES[k]))].filter((r) => !PLATFORM_ONLY.includes(r));
}

/** So'ralgan rollardan faqat tur ruxsat berganlari; bo'sh so'rov = hammasi. */
export function filterRoles(requested: readonly Role[] | undefined, kinds: readonly OrgKind[]): Role[] {
  const allowed = rolesForKinds(kinds);
  return requested?.length ? requested.filter((r) => allowed.includes(r)) : allowed;
}

/** PLATFORM_ADMIN_PHONES="+998901234567, 90 765 43 21" -> E.164 to'plam; notanish qiymatlar tashlanadi. */
export function parseAdminPhones(csv: string | undefined): Set<string> {
  return new Set((csv ?? '').split(',').map((s) => normalizePhone(s.trim())).filter((p): p is string => p !== null));
}
