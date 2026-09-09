// Ochiq ontologiya: domen lug'atlari uch tilda. Sof funksiya, framework yo'q.
import {
  CONDITIONS, DEAL_KINDS, LISTING_KINDS, LISTING_LABELS, ORG_KINDS, ORG_KIND_LABELS, PRICE_UNITS, PUBLIC_API, REGIONS,
  SEARCH_LABELS, SERVICE_CODES, TERMINAL_KINDS, TRUCK_TYPES, WAGON_TYPES, type SearchLang,
} from '@yuksaroy/domain';

const LANGS: readonly SearchLang[] = ['uz', 'ru', 'en'];

/** [{ code, uz, ru, en }] : har bir kod uchun uch til yorlig'i. */
const tri = <K extends string>(codes: readonly K[], labels: (lang: SearchLang) => Record<K, string>) =>
  codes.map((code) => ({ code, ...Object.fromEntries(LANGS.map((l) => [l, labels(l)[code]])) }) as { code: K } & Record<SearchLang, string>);

export function buildOntology() {
  return {
    version: PUBLIC_API.version,
    regions: tri(REGIONS, (l) => SEARCH_LABELS[l].region),
    services: tri(SERVICE_CODES, (l) => SEARCH_LABELS[l].service),
    terminalKinds: tri(TERMINAL_KINDS, (l) => SEARCH_LABELS[l].kind),
    listingKinds: tri(LISTING_KINDS, (l) => LISTING_LABELS[l].kind),
    deals: tri(DEAL_KINDS, (l) => SEARCH_LABELS[l].deal),
    conditions: tri(CONDITIONS, (l) => LISTING_LABELS[l].condition),
    wagonTypes: tri(WAGON_TYPES, (l) => LISTING_LABELS[l].wagonType),
    truckTypes: tri(TRUCK_TYPES, (l) => LISTING_LABELS[l].truckType),
    priceUnits: tri(PRICE_UNITS, (l) => LISTING_LABELS[l].priceUnit),
    orgKinds: tri(ORG_KINDS, (l) => ORG_KIND_LABELS[l]),
  };
}
export type Ontology = ReturnType<typeof buildOntology>;

/** O'zgarishlar tarixi: statik; yangi versiya chiqsa boshiga qo'shiladi. */
export const CHANGELOG = [
  {
    version: PUBLIC_API.version, date: '2026-09-09',
    notes: {
      uz: ['Birinchi ochiq versiya: listings, terminals, facets, ontology.', `IP bo'yicha limit: daqiqasiga ${PUBLIC_API.ratePerMinute} so'rov.`],
      ru: ['Первая открытая версия: listings, terminals, facets, ontology.', `Лимит по IP: ${PUBLIC_API.ratePerMinute} запросов в минуту.`],
      en: ['First public version: listings, terminals, facets, ontology.', `Per-IP limit: ${PUBLIC_API.ratePerMinute} requests per minute.`],
    },
  },
] as const;
