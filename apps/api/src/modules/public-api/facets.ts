// Ochiq facets: faol obyektlar bo'yicha sonlar. Sof funksiya, har bir enum kaliti 0 bilan ham chiqadi (barqaror shakl).
import { DEAL_KINDS, LISTING_KINDS, REGIONS, SERVICE_CODES, TERMINAL_KINDS, type ServiceCode } from '@yuksaroy/domain';

export interface FacetTerminal { kind: string; regionCode: string | null; services: { serviceCode: ServiceCode; isEnabled: boolean }[] }
export interface FacetListing { kind: string; regionCode: string; deal: string | null }

const zeroed = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;
const bump = (m: Record<string, number>, k: string | null) => { if (k !== null && k in m) m[k]!++; };

export function facets(terminals: FacetTerminal[], listings: FacetListing[]) {
  const t = { total: terminals.length, kind: zeroed(TERMINAL_KINDS), region: zeroed(REGIONS), service: zeroed(SERVICE_CODES) };
  for (const x of terminals) {
    bump(t.kind, x.kind); bump(t.region, x.regionCode);
    for (const s of x.services) if (s.isEnabled) bump(t.service, s.serviceCode);
  }
  const l = { total: listings.length, kind: zeroed(LISTING_KINDS), region: zeroed(REGIONS), deal: zeroed(DEAL_KINDS) };
  for (const x of listings) { bump(l.kind, x.kind); bump(l.region, x.regionCode); bump(l.deal, x.deal); }
  return { terminals: t, listings: l };
}
