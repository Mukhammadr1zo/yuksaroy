/**
 * Obyekt tomonidagi tashkilotlar: qaysi a'zolik buyurtmani ko'rish va unga qaror
 * qilish huquqini beradi.
 *
 * Tashkilot TURI bu yerda so'ralmaydi. Qator kimniki ekani terminalning o'z orgId
 * sida turadi; tur esa faqat yangi terminal OCHISH yo'lida tekshiriladi. Ilgari
 * shart kinds.includes('TERMINAL') edi va shahobchasini da'vo qilib olgan korxona
 * o'z obyektiga kelgan buyurtmani umuman ko'rmasdi: bunday korxona ASSET_OWNER
 * turida bo'ladi, ASSET_OWNER turidagi tashkilotda esa TERMINAL_ADMIN roli ham
 * bo'lmaydi, ya'ni shartning ikkala yarmi birdan yiqilardi.
 */
export const TERMINAL_SIDE_ROLES = ['TERMINAL_ADMIN', 'TERMINAL_OPERATOR', 'ASSET_OWNER'] as const;

export function terminalSideOrgIds(
  ms: readonly { orgId: string; isOwner: boolean; roles: readonly string[] }[],
): string[] {
  const allowed: readonly string[] = TERMINAL_SIDE_ROLES;
  return ms.filter((m) => m.isOwner || m.roles.some((r) => allowed.includes(r))).map((m) => m.orgId);
}
