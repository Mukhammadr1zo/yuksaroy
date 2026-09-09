import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CaretDownIcon, CheckCircleIcon, InfoIcon } from '@phosphor-icons/react/dist/ssr';
import {
  CONDITIONS, DEAL_KINDS, LISTING_KINDS, LISTING_LABELS, ORG_KINDS, ORG_KIND_LABELS, PRICE_UNITS, PUBLIC_API, REGIONS,
  SEARCH_LABELS, SERVICE_CODES, TERMINAL_KINDS, TRUCK_TYPES, WAGON_TYPES, type SearchLang,
} from '@yuksaroy/domain';
import { sapi } from '@/lib/server-api';
import { alt } from '@/lib/seo';

export const revalidate = 60;
type Params = { params: Promise<{ locale: string }> };
const BASE = `${(process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '')}/v1/public`;
const LANGS: readonly SearchLang[] = ['uz', 'ru', 'en'];
const HEADERS = ['version', 'limit', 'remaining'] as const;
const RULES = ['get', 'active', 'limit', 'version'] as const;
const TERMS = ['attribution', 'resale', 'contact', 'limit', 'guarantee'] as const;
/** Endpoint jadvali; sample: jonli namuna uchun so'rov (limit 1: sahifa yengil qolsin). */
const ENDPOINTS = [
  { key: 'listings', path: '/listings', sample: '/listings?limit=1' },
  { key: 'terminals', path: '/terminals', sample: '/terminals?limit=1' },
  { key: 'facets', path: '/facets', sample: '/facets' },
  { key: 'ontology', path: '/ontology', sample: '/ontology' },
  { key: 'changelog', path: '/changelog', sample: '/changelog' },
] as const;
const MAX_JSON = 1600;

type Row = { code: string } & Record<SearchLang, string>;
type Ontology = { version: string } & Record<string, Row[] | string>;
type Changelog = { version: string; date: string; notes: Record<SearchLang, string[]> }[];

/** Ontologiya API'dagi bilan bir xil manbadan (domain yorliqlari): API javob bermasa ham ko'rinish bo'sh qolmaydi. */
const tri = <K extends string>(codes: readonly K[], labels: (l: SearchLang) => Record<K, string>): Row[] =>
  codes.map((code) => ({ code, ...Object.fromEntries(LANGS.map((l) => [l, labels(l)[code]])) }) as unknown as Row);
const localOntology = (): Ontology => ({
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
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'developers.meta' });
  return { ...{ title: `${t('title')} · YukSaroy`, description: t('description') }, ...alt(locale, '/developers') };
}

/**
 * /developers: ochiq API hujjati. Namunalar so'rov vaqtida API dan olinadi (60 s kesh), shuning uchun eskirmaydi;
 * API javob bermasa jadval va qoidalar qoladi, namuna o'rniga izoh chiqadi. Ontologiya uchun mahalliy zaxira bor.
 */
export default async function DevelopersPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = (LANGS as readonly string[]).includes(locale) ? (locale as SearchLang) : 'uz';
  const [t, ...samples] = await Promise.all([
    getTranslations('developers'),
    ...ENDPOINTS.map((e) => sapi<unknown>(`/public${e.sample}`, 60).catch(() => null)),
  ]);
  const live = Object.fromEntries(ENDPOINTS.map((e, i) => [e.key, samples[i]])) as Record<(typeof ENDPOINTS)[number]['key'], unknown>;
  const ontology = (live.ontology as Ontology | null) ?? localOntology();
  const groups = Object.entries(ontology).filter((x): x is [string, Row[]] => Array.isArray(x[1]));
  const codeCount = groups.reduce((n, [, rows]) => n + rows.length, 0);
  const changelog = Array.isArray(live.changelog) ? (live.changelog as Changelog) : null;
  const facts = [
    t('facts.version', { version: PUBLIC_API.version }),
    t('facts.rate', { n: PUBLIC_API.ratePerMinute }),
    t('facts.auth'),
    t('facts.cache'),
  ];
  const Code = ({ children }: { children: string }) => <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-[13px] text-navy">{children}</code>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-navy md:text-4xl">{t('title')}</h1>
      <p className="mt-3 max-w-[64ch] text-lg text-muted">{t('lead')}</p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {facts.map((f) => <li key={f} className="rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs text-navy tabular-nums">{f}</li>)}
      </ul>

      {/* Boshlash: asosiy manzil, qoidalar, sarlavhalar */}
      <section className="mt-10 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0 rounded-card border border-line bg-white p-5">
          <h2 className="font-display text-lg font-bold text-navy">{t('start.heading')}</h2>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('start.base')}</p>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-navy px-4 py-3 font-mono text-sm text-white"><code>{BASE}</code></pre>
          <ul className="mt-4 space-y-2 text-sm">
            {RULES.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                <span>{t(`start.rules.${r}`, { code: 'RATE_LIMITED' })}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 rounded-card border border-line bg-white p-5">
          <h2 className="font-display text-lg font-bold text-navy">{t('start.headers')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {HEADERS.map((h) => (
              <div key={h} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line/70 pt-2 first:border-t-0 first:pt-0">
                <dt><Code>{`x-${h === 'version' ? 'contract-version' : `ratelimit-${h}`}`}</Code></dt>
                <dd className="text-muted">{t(`start.header.${h}`)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-card border border-amber/40 bg-amber-soft px-3 py-2 text-xs text-ink/85">
            <InfoIcon size={16} className="mt-0.5 shrink-0 text-amber-ink" aria-hidden="true" />{t('terms.contact')}
          </p>
        </div>
      </section>

      {/* Endpointlar: jadval + har biriga jonli namuna (details) */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-navy">{t('endpoints.heading')}</h2>
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left font-mono text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-normal">{t('endpoints.col.path')}</th>
                <th className="px-4 py-2.5 font-normal">{t('endpoints.col.params')}</th>
                <th className="px-4 py-2.5 font-normal">{t('endpoints.col.desc')}</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => {
                const params = t(`endpoints.${e.key}.params`);
                return (
                  <tr key={e.key} className="border-b border-line/70 align-top last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3"><span className="mr-2 font-mono text-[11px] font-semibold text-teal-ink">GET</span><Code>{e.path}</Code></td>
                    <td className="px-4 py-3 text-muted">{params || t('endpoints.none')}</td>
                    <td className="px-4 py-3">{t(`endpoints.${e.key}.desc`)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {ENDPOINTS.map((e) => {
            const data = live[e.key];
            const json = data == null ? null : JSON.stringify(data, null, 2);
            const cut = json != null && json.length > MAX_JSON;
            return (
              <details key={e.key} className="group min-w-0 rounded-card border border-line bg-white open:border-teal">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
                  <span>{t('example.show')}: <Code>{`GET ${e.sample}`}</Code></span>
                  <CaretDownIcon size={16} className="shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-line px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('example.curl')}</p>
                  <pre className="mt-1 overflow-x-auto rounded-xl bg-navy px-4 py-3 font-mono text-xs text-white"><code>{`curl "${BASE}${e.sample}"`}</code></pre>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('example.json')}{cut ? ` (${t('example.truncated')})` : ''}</p>
                  {json == null
                    ? <p className="mt-1 text-sm text-amber-ink">{t('example.unavailable')}</p>
                    : <pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-sand px-4 py-3 font-mono text-xs text-ink"><code>{cut ? `${json.slice(0, MAX_JSON)}\n...` : json}</code></pre>}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* Ontologiya: yig'iladigan to'liq lug'at, joriy til yorlig'i bilan */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-navy">{t('ontology.heading')}</h2>
        <p className="mt-1 max-w-[64ch] text-sm text-muted">{t('ontology.lead')}</p>
        <details className="group mt-3 rounded-card border border-line bg-white open:border-teal">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
            <span>{t('ontology.open', { count: codeCount })} <span className="ml-2 font-mono text-xs font-normal text-muted">{ontology.version}</span></span>
            <CaretDownIcon size={16} className="shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-5 border-t border-line px-4 py-4 md:grid-cols-2">
            {groups.map(([key, rows]) => (
              <div key={key}>
                <h3 className="text-sm font-bold text-navy">{t(`ontology.groups.${key as 'regions'}`)} <span className="font-mono text-xs font-normal text-muted">{rows.length}</span></h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {rows.map((r) => (
                    <li key={r.code} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
                      <span className="font-mono font-semibold text-teal-ink">{r.code}</span><span className="text-ink/80">{r[lang]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* O'zgarishlar tarixi va shartlar */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-card border border-line bg-white p-5">
          <h2 className="font-display text-lg font-bold text-navy">{t('changelog.heading')}</h2>
          {changelog?.length ? (
            <ol className="mt-3 space-y-3">
              {changelog.map((c) => (
                <li key={c.version} className="border-t border-line/70 pt-3 first:border-t-0 first:pt-0">
                  <p className="font-mono text-sm text-navy tabular-nums"><span className="font-semibold">{c.version}</span> <span className="text-muted">{c.date}</span></p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink/85">{(c.notes[lang] ?? c.notes.uz ?? []).map((n) => <li key={n}>{n}</li>)}</ul>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-amber-ink">{t('changelog.unavailable', { version: PUBLIC_API.version })}</p>}
        </div>
        <div className="min-w-0 rounded-card border border-line bg-white p-5">
          <h2 className="font-display text-lg font-bold text-navy">{t('terms.heading')}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {TERMS.map((k) => (
              <li key={k} className="flex items-start gap-2">
                <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                <span>{t(`terms.${k}`, { n: PUBLIC_API.ratePerMinute })}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white p-6">
        <p className="max-w-[56ch] text-sm text-muted">{t('cta.body')}</p>
        <a href="https://t.me/yuksaroy_bot" target="_blank" rel="noreferrer" className="rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('cta.telegram')}</a>
      </section>
    </div>
  );
}
