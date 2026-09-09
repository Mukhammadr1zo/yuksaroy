// Arms-length: terminal egasi o'z terminaliga o'zi baho qo'ya olmasin. Sof funksiya, DB yo'q.

/** Ikki tomon bir xilmi: bitta tashkilot yoki a'zolari kesishsa. Terminal egasiz bo'lsa (orgId null) tekshiruv yo'q. */
export function isRelatedParty(
  shipper: { orgId: string; memberIds: readonly string[] },
  terminal: { orgId: string | null; memberIds: readonly string[] },
): boolean {
  if (terminal.orgId === null) return false;
  if (shipper.orgId === terminal.orgId) return true;
  return shipper.memberIds.some((id) => terminal.memberIds.includes(id));
}
