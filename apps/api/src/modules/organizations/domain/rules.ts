// Tashkilot qoidalari: tur -> rollar, admin telefonlari. Sof funksiyalar, DB yo'q.
import { ORG_KIND_ROLES, normalizeUzPhone, type OrgKind, type Role } from '@yuksaroy/domain';

/** Tashkilot turlari bo'yicha ruxsat etilgan rollar birlashmasi. */
export function rolesForKinds(kinds: readonly OrgKind[]): Role[] {
  return [...new Set(kinds.flatMap((k) => ORG_KIND_ROLES[k]))];
}

/** So'ralgan rollardan faqat tur ruxsat berganlari; bo'sh so'rov = hammasi. */
export function filterRoles(requested: readonly Role[] | undefined, kinds: readonly OrgKind[]): Role[] {
  const allowed = rolesForKinds(kinds);
  return requested?.length ? requested.filter((r) => allowed.includes(r)) : allowed;
}

/** PLATFORM_ADMIN_PHONES="+998901234567, 90 765 43 21" -> E.164 to'plam; notanish qiymatlar tashlanadi. */
export function parseAdminPhones(csv: string | undefined): Set<string> {
  return new Set((csv ?? '').split(',').map((s) => normalizeUzPhone(s.trim())).filter((p): p is string => p !== null));
}
